import { Types } from "mongoose";
import {
  findOptimizedRouteInGraph,
  invalidateRouteGraphCache,
  loadRouteGraph,
} from "./route-optimization.service";
import { DeliveryModel } from "../../deliveries/models/delivery.model";
import { RouteModel } from "../models/route.model";
import {
  DeliveryStatus,
  RouteOptimizationStatus,
} from "../../../shared/types/logistics";
import { ApiError } from "../../../utils/ApiError";
import type {
  RouteStatusUpdateRequest,
  TrafficUpdateRequest,
} from "../route-recalculation.validation";
import {
  emitDeliveryRouteRecalculated,
  emitRouteAvailabilityChanged,
  emitRouteTrafficUpdated,
} from "../../../sockets/socket";
import type {
  DeliveryRouteRecalculatedEvent,
  RouteAvailabilityEvent,
  RouteTrafficUpdatedEvent,
} from "../../../sockets/socket";

export interface RecalculatedDelivery {
  id: string;
  status: DeliveryStatus;
  routeOptimizationStatus: RouteOptimizationStatus;
  currentRoute: string[];
  totalDistance: number;
  totalTravelTime: number;
  totalFuelCost: number;
  totalCalculatedCost: number;
}

export interface RouteRecalculationResult {
  route: {
    id: string;
    trafficCondition: string;
    trafficMultiplier: number;
    status: string;
  };
  deliveries: RecalculatedDelivery[];
}

export interface RecalculationOptions {
  triggeringRouteId?: string;
  onDeliveryRecalculated?: (event: DeliveryRouteRecalculatedEvent) => void;
}

const DELIVERY_WRITE_BATCH_SIZE = 500;

const getRoute = async (routeId: string) => {
  const route = await RouteModel.findById(routeId).exec();

  if (!route) {
    throw new ApiError(404, "Route not found.");
  }

  return route;
};

/**
 * Reusable recalculation entry point for synchronous requests or background jobs.
 */
export const recalculateActiveDeliveries = async (
  options: RecalculationOptions = {},
): Promise<RecalculatedDelivery[]> => {
  const activeDeliveries = await DeliveryModel.find({
    status: { $in: [DeliveryStatus.PLANNED, DeliveryStatus.IN_TRANSIT] },
  })
    .select(
      "_id originHub destinationHub status currentRoute totalDistance totalTravelTime totalFuelCost totalCalculatedCost routeOptimizationStatus",
    )
    .sort({ _id: 1 })
    .lean()
    .exec();
  const graph = await loadRouteGraph();
  const results: RecalculatedDelivery[] = [];
  let pendingWrites: Array<{
    updateOne: {
      filter: { _id: Types.ObjectId };
      update: {
        $set: {
          currentRoute: Types.ObjectId[];
          totalDistance: number;
          totalTravelTime: number;
          totalFuelCost: number;
          totalCalculatedCost: number;
          routeOptimizationStatus: RouteOptimizationStatus;
        };
      };
    };
  }> = [];
  let pendingEvents: DeliveryRouteRecalculatedEvent[] = [];

  for (const delivery of activeDeliveries) {
    const originHubId = delivery.originHub.toString();
    const destinationHubId = delivery.destinationHub.toString();
    const optimized =
      graph.hubsById.has(originHubId) && graph.hubsById.has(destinationHubId)
        ? findOptimizedRouteInGraph(graph, originHubId, destinationHubId)
        : null;

    const currentRoute =
      optimized?.routes.map((route) => new Types.ObjectId(route.id)) ?? [];
    const routeOptimizationStatus = optimized
      ? RouteOptimizationStatus.OPTIMIZED
      : RouteOptimizationStatus.NO_AVAILABLE_PATH;
    const recalculatedDelivery: RecalculatedDelivery = {
      id: delivery._id.toString(),
      status: delivery.status,
      routeOptimizationStatus,
      currentRoute: currentRoute.map((routeId) => routeId.toString()),
      totalDistance: optimized?.totalDistance ?? 0,
      totalTravelTime: optimized?.totalTravelTime ?? 0,
      totalFuelCost: optimized?.totalFuelCost ?? 0,
      totalCalculatedCost: optimized?.totalCalculatedCost ?? 0,
    };
    results.push(recalculatedDelivery);

    const changed =
      delivery.routeOptimizationStatus !== routeOptimizationStatus ||
      delivery.currentRoute.length !== currentRoute.length ||
      delivery.currentRoute.some(
        (routeId, index) => !routeId.equals(currentRoute[index]),
      ) ||
      delivery.totalDistance !== recalculatedDelivery.totalDistance ||
      delivery.totalTravelTime !== recalculatedDelivery.totalTravelTime ||
      delivery.totalFuelCost !== recalculatedDelivery.totalFuelCost ||
      delivery.totalCalculatedCost !== recalculatedDelivery.totalCalculatedCost;

    if (!changed) {
      continue;
    }

    pendingWrites.push({
      updateOne: {
        filter: { _id: delivery._id },
        update: {
          $set: {
            currentRoute,
            totalDistance: recalculatedDelivery.totalDistance,
            totalTravelTime: recalculatedDelivery.totalTravelTime,
            totalFuelCost: recalculatedDelivery.totalFuelCost,
            totalCalculatedCost: recalculatedDelivery.totalCalculatedCost,
            routeOptimizationStatus,
          },
        },
      },
    });
    pendingEvents.push({
      triggeringRouteId: options.triggeringRouteId ?? null,
      routeIds: recalculatedDelivery.currentRoute,
      delivery: recalculatedDelivery,
    });

    if (pendingWrites.length === DELIVERY_WRITE_BATCH_SIZE) {
      await persistDeliveryBatch(pendingWrites, pendingEvents, options);
      pendingWrites = [];
      pendingEvents = [];
    }
  }

  if (pendingWrites.length > 0) {
    await persistDeliveryBatch(pendingWrites, pendingEvents, options);
  }
  return results;
};

const persistDeliveryBatch = async (
  writes: Parameters<typeof DeliveryModel.bulkWrite>[0],
  events: DeliveryRouteRecalculatedEvent[],
  options: RecalculationOptions,
): Promise<void> => {
  await DeliveryModel.bulkWrite(writes, { ordered: true });

  for (const event of events) {
    options.onDeliveryRecalculated?.(event);
  }
};

const buildResult = async (
  route: Awaited<ReturnType<typeof getRoute>>,
  triggeringRouteId: string,
): Promise<RouteRecalculationResult> => {
  const deliveries = await recalculateActiveDeliveries({
    triggeringRouteId,
    onDeliveryRecalculated: emitDeliveryRouteRecalculated,
  });

  return {
    route: {
      id: route._id.toString(),
      trafficCondition: route.trafficCondition,
      trafficMultiplier: route.trafficMultiplier,
      status: route.status,
    },
    deliveries,
  };
};

export const updateRouteTrafficAndRecalculate = async (
  routeId: string,
  update: TrafficUpdateRequest,
): Promise<RouteRecalculationResult> => {
  const route = await getRoute(routeId);
  const trafficChanged =
    route.trafficCondition !== update.trafficCondition ||
    route.trafficMultiplier !== update.trafficMultiplier;
  route.trafficCondition = update.trafficCondition;
  route.trafficMultiplier = update.trafficMultiplier;
  await route.save();
  invalidateRouteGraphCache();

  if (trafficChanged) {
    const event: RouteTrafficUpdatedEvent = {
      routeId: route._id.toString(),
      trafficCondition: route.trafficCondition,
      trafficMultiplier: route.trafficMultiplier,
      status: route.status,
      updatedAt: route.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
    emitRouteTrafficUpdated(event);
  }
  return buildResult(route, route._id.toString());
};

export const updateRouteStatusAndRecalculate = async (
  routeId: string,
  update: RouteStatusUpdateRequest,
): Promise<RouteRecalculationResult> => {
  const route = await getRoute(routeId);
  const statusChanged = route.status !== update.status;
  route.status = update.status;
  await route.save();
  invalidateRouteGraphCache();

  if (statusChanged) {
    const event: RouteAvailabilityEvent = {
      routeId: route._id.toString(),
      status: route.status,
      trafficCondition: route.trafficCondition,
      trafficMultiplier: route.trafficMultiplier,
      updatedAt: route.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
    emitRouteAvailabilityChanged(event);
  }
  return buildResult(route, route._id.toString());
};
