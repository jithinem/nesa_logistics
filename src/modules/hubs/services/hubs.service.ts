import { HubModel } from "../models/hub.model";
import { invalidateRouteGraphCache } from "../../routes/services/route-optimization.service";
import { ApiError } from "../../../utils/ApiError";
import type {
  CreateHubRequest,
  HubIdParams,
  ListHubsQuery,
} from "../hubs.validation";
import {
  createPaginationMetadata,
  type PaginatedResult,
} from "../../../shared/types/pagination";

export const createHub = async (input: CreateHubRequest) => {
  const hub = await HubModel.create(input);
  invalidateRouteGraphCache();
  return hub;
};

export const listHubs = async (query: ListHubsQuery) => {
  const filter = {};
  const [items, totalItems] = await Promise.all([
    HubModel.find(filter)
      .select("_id name code location isActive createdAt updatedAt")
      .sort({ _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    HubModel.countDocuments(filter).exec(),
  ]);

  return {
    items,
    pagination: createPaginationMetadata(query.page, query.limit, totalItems),
  } satisfies PaginatedResult<(typeof items)[number]>;
};

export const getHubById = async ({ hubId }: HubIdParams) => {
  const hub = await HubModel.findById(hubId)
    .select("_id name code location isActive createdAt updatedAt")
    .lean()
    .exec();
  if (!hub) {
    throw new ApiError(404, "Hub not found.");
  }
  return hub;
};
