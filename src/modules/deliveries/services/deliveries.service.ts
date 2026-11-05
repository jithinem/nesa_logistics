import { Types } from "mongoose";
import {
  findOptimizedRouteInGraph,
  loadRouteGraph,
} from "../../routes/services/route-optimization.service";
import { ApiError } from "../../../utils/ApiError";
import { DeliveryModel } from "../models/delivery.model";
import { HubModel } from "../../hubs/models/hub.model";
import { RouteOptimizationStatus } from "../../../shared/types/logistics";
import type {
  CreateDeliveryRequest,
  DeliveryIdParams,
  ListDeliveriesQuery,
} from "../deliveries.validation";
import { createPaginationMetadata } from "../../../shared/types/pagination";

export const createDelivery = async (input: CreateDeliveryRequest) => {
  const hubIds = [...new Set([input.originHub, input.destinationHub])].map(
    (hubId) => new Types.ObjectId(hubId),
  );
  const activeHubs = await HubModel.find({
    _id: { $in: hubIds },
    isActive: true,
  })
    .select("_id")
    .lean()
    .exec();
  const activeHubIds = new Set(activeHubs.map((hub) => hub._id.toString()));

  if (
    !activeHubIds.has(input.originHub) ||
    !activeHubIds.has(input.destinationHub)
  ) {
    throw new ApiError(404, "Both delivery hubs must exist and be active.");
  }

  const graph = await loadRouteGraph();
  const optimized = findOptimizedRouteInGraph(
    graph,
    input.originHub,
    input.destinationHub,
  );
  const delivery = await DeliveryModel.create({
    originHub: new Types.ObjectId(input.originHub),
    destinationHub: new Types.ObjectId(input.destinationHub),
    currentRoute:
      optimized?.routes.map((route) => new Types.ObjectId(route.id)) ?? [],
    totalDistance: optimized?.totalDistance ?? 0,
    totalTravelTime: optimized?.totalTravelTime ?? 0,
    totalFuelCost: optimized?.totalFuelCost ?? 0,
    totalCalculatedCost: optimized?.totalCalculatedCost ?? 0,
    routeOptimizationStatus: optimized
      ? RouteOptimizationStatus.OPTIMIZED
      : RouteOptimizationStatus.NO_AVAILABLE_PATH,
  });

  return delivery;
};

export const listDeliveries = async (query: ListDeliveriesQuery) => {
  const filter = {};
  const [items, totalItems] = await Promise.all([
    DeliveryModel.find(filter)
      .select(
        "_id originHub destinationHub currentRoute totalDistance totalTravelTime totalFuelCost totalCalculatedCost status routeOptimizationStatus createdAt updatedAt",
      )
      .sort({ _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    DeliveryModel.countDocuments(filter).exec(),
  ]);

  return {
    items,
    pagination: createPaginationMetadata(query.page, query.limit, totalItems),
  };
};

export const getDeliveryById = async ({ deliveryId }: DeliveryIdParams) => {
  const delivery = await DeliveryModel.findById(deliveryId)
    .select(
      "_id originHub destinationHub currentRoute totalDistance totalTravelTime totalFuelCost totalCalculatedCost status routeOptimizationStatus createdAt updatedAt",
    )
    .lean()
    .exec();
  if (!delivery) {
    throw new ApiError(404, "Delivery not found.");
  }
  return delivery;
};
