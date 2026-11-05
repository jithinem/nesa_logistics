import { Types } from "mongoose";
import {
  findOptimalRoute,
  type RouteGraph,
  type RouteHub,
} from "../../../algorithms/dijkstra.algorithm";
import { ApiError } from "../../../utils/ApiError";
import { HubModel } from "../../hubs/models/hub.model";
import { RouteModel } from "../models/route.model";
import { RouteStatus } from "../../../shared/types/logistics";
import type { RouteOptimizationRequest } from "../routes.validation";
import { environment } from "../../../config/environment";

interface RouteGraphContext {
  graph: RouteGraph;
  hubsById: Map<
    string,
    {
      _id: Types.ObjectId;
      name: string;
      code: string;
      location: { latitude: number; longitude: number };
    }
  >;
  routesById: Map<
    string,
    {
      _id: Types.ObjectId;
      sourceHub: Types.ObjectId;
      destinationHub: Types.ObjectId;
      distance: number;
      travelTime: number;
      fuelCost: number;
      trafficCondition: string;
      trafficMultiplier: number;
      status: string;
    }
  >;
}

export interface OptimizedHubResponse {
  id: string;
  name: string;
  code: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface OptimizedRouteResponse {
  id: string;
  sourceHub: string;
  destinationHub: string;
  distance: number;
  travelTime: number;
  fuelCost: number;
  trafficCondition: string;
  trafficMultiplier: number;
  status: string;
}

export interface RouteOptimizationResponse {
  hubs: OptimizedHubResponse[];
  routes: OptimizedRouteResponse[];
  totalDistance: number;
  totalTravelTime: number;
  totalFuelCost: number;
  totalCalculatedCost: number;
}

const loadRouteGraphFromDatabase = async (): Promise<RouteGraphContext> => {
  const hubs = await HubModel.find({ isActive: true })
    .select("_id name code location")
    .lean()
    .exec();
  const hubsById = new Map(hubs.map((hub) => [hub._id.toString(), hub]));

  const activeHubIds = hubs.map((hub) => hub._id);
  const routes = await RouteModel.find({
    status: RouteStatus.AVAILABLE,
    sourceHub: { $in: activeHubIds },
    destinationHub: { $in: activeHubIds },
  })
    .select(
      "_id sourceHub destinationHub distance travelTime fuelCost trafficCondition trafficMultiplier status",
    )
    .sort({ _id: 1 })
    .lean()
    .exec();

  const graph: RouteGraph = {
    hubs: hubs.map(
      (hub): RouteHub => ({
        id: hub._id.toString(),
        name: hub.name,
      }),
    ),
    routes: routes.map((route) => ({
      id: route._id.toString(),
      sourceHubId: route.sourceHub.toString(),
      destinationHubId: route.destinationHub.toString(),
      distance: route.distance,
      travelTime: route.travelTime,
      fuelCost: route.fuelCost,
      trafficCondition: route.trafficCondition,
      trafficMultiplier: route.trafficMultiplier,
      status: route.status,
    })),
  };

  return {
    graph,
    hubsById,
    routesById: new Map(routes.map((route) => [route._id.toString(), route])),
  };
};

interface CachedRouteGraph {
  context: RouteGraphContext;
  expiresAt: number;
}

let cachedRouteGraph: CachedRouteGraph | undefined;
let routeGraphLoad: Promise<RouteGraphContext> | undefined;
let routeGraphRevision = 0;

export const invalidateRouteGraphCache = (): void => {
  routeGraphRevision += 1;
  cachedRouteGraph = undefined;
  routeGraphLoad = undefined;
};

export const loadRouteGraph = async (): Promise<RouteGraphContext> => {
  if (cachedRouteGraph && cachedRouteGraph.expiresAt > Date.now()) {
    return cachedRouteGraph.context;
  }

  if (routeGraphLoad) {
    return routeGraphLoad;
  }

  const revision = routeGraphRevision;
  const loading = loadRouteGraphFromDatabase();
  routeGraphLoad = loading;

  try {
    const context = await loading;
    if (revision !== routeGraphRevision) {
      return await loadRouteGraph();
    }

    if (environment.routeGraphCacheTtlMs > 0) {
      cachedRouteGraph = {
        context,
        expiresAt: Date.now() + environment.routeGraphCacheTtlMs,
      };
    }
    return context;
  } finally {
    if (routeGraphLoad === loading) {
      routeGraphLoad = undefined;
    }
  }
};

export const findOptimizedRouteInGraph = (
  context: RouteGraphContext,
  originHubId: string,
  destinationHubId: string,
): RouteOptimizationResponse | null => {
  const optimized = findOptimalRoute(context.graph, originHubId, destinationHubId);
  if (!optimized) {
    return null;
  }

  return {
    hubs: optimized.hubs.map((hub) => {
      const document = context.hubsById.get(hub.id);

      if (!document) {
        throw new Error(`Optimized path references unknown hub "${hub.id}".`);
      }

      return {
        id: document._id.toString(),
        name: document.name,
        code: document.code,
        location: document.location,
      };
    }),
    routes: optimized.selectedRouteIds.map((routeId) => {
      const route = context.routesById.get(routeId);

      if (!route) {
        throw new Error(`Optimized path references unknown route "${routeId}".`);
      }

      return {
        id: route._id.toString(),
        sourceHub: route.sourceHub.toString(),
        destinationHub: route.destinationHub.toString(),
        distance: route.distance,
        travelTime: route.travelTime,
        fuelCost: route.fuelCost,
        trafficCondition: route.trafficCondition,
        trafficMultiplier: route.trafficMultiplier,
        status: route.status,
      };
    }),
    totalDistance: optimized.totalDistance,
    totalTravelTime: optimized.totalEffectiveTravelTime,
    totalFuelCost: optimized.totalFuelCost,
    totalCalculatedCost: optimized.totalOptimizationScore,
  };
};

export const optimizeRoute = async (
  request: RouteOptimizationRequest,
): Promise<RouteOptimizationResponse> => {
  const originHubId = request.originHub;
  const destinationHubId = request.destinationHub;
  const context = await loadRouteGraph();

  if (!context.hubsById.has(originHubId)) {
    throw new ApiError(404, "Origin hub was not found or is inactive.");
  }

  if (!context.hubsById.has(destinationHubId)) {
    throw new ApiError(404, "Destination hub was not found or is inactive.");
  }

  const result = findOptimizedRouteInGraph(context, originHubId, destinationHubId);

  if (!result) {
    throw new ApiError(404, "No available route found between the selected hubs.");
  }

  return result;
};
