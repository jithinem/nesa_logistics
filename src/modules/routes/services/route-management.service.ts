import { Types } from "mongoose";
import { ApiError } from "../../../utils/ApiError";
import { HubModel } from "../../hubs/models/hub.model";
import { RouteModel } from "../models/route.model";
import { invalidateRouteGraphCache } from "./route-optimization.service";
import type {
  CreateRouteRequest,
  ListRoutesQuery,
} from "../route-management.validation";
import { createPaginationMetadata } from "../../../shared/types/pagination";

export const createRoute = async (input: CreateRouteRequest) => {
  const hubIds = [new Types.ObjectId(input.sourceHub), new Types.ObjectId(input.destinationHub)];
  const activeHubs = await HubModel.find({
    _id: { $in: hubIds },
    isActive: true,
  })
    .select("_id")
    .lean()
    .exec();

  if (activeHubs.length !== 2) {
    throw new ApiError(404, "Both route hubs must exist and be active.");
  }

  const route = await RouteModel.create({
    ...input,
    sourceHub: hubIds[0],
    destinationHub: hubIds[1],
  });
  invalidateRouteGraphCache();
  return route;
};

export const listRoutes = async (query: ListRoutesQuery) => {
  const filter = {};
  const [items, totalItems] = await Promise.all([
    RouteModel.find(filter)
      .select(
        "_id sourceHub destinationHub distance travelTime fuelCost trafficCondition trafficMultiplier status createdAt updatedAt",
      )
      .sort({ _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    RouteModel.countDocuments(filter).exec(),
  ]);

  return {
    items,
    pagination: createPaginationMetadata(query.page, query.limit, totalItems),
  };
};
