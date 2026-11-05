import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import type { ValidationLocals } from "../../../middleware/validation.middleware";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  createHubSchemas,
  getHubSchemas,
  listHubsSchemas,
} from "../hubs.validation";
import { createHub, getHubById, listHubs } from "../services/hubs.service";

type CreateHubLocals = ValidationLocals<typeof createHubSchemas>;
type ListHubsLocals = ValidationLocals<typeof listHubsSchemas>;
type GetHubLocals = ValidationLocals<typeof getHubSchemas>;

export const createHubController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  CreateHubLocals
> = asyncHandler<CreateHubLocals>(async (_request, response, next) => {
  try {
    const hub = await createHub(response.locals.validatedRequest.body);
    response
      .status(201)
      .json(ApiResponse.success("Hub created successfully.", hub));
  } catch (error: unknown) {
    next(error);
  }
});

export const listHubsController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  ListHubsLocals
> = asyncHandler<ListHubsLocals>(async (_request, response, next) => {
  try {
    const result = await listHubs(response.locals.validatedRequest.query);
    response
      .status(200)
      .json(ApiResponse.success("Hubs retrieved successfully.", result));
  } catch (error: unknown) {
    next(error);
  }
});

export const getHubController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  GetHubLocals
> = asyncHandler<GetHubLocals>(async (_request, response, next) => {
  try {
    const hub = await getHubById(response.locals.validatedRequest.params);
    response
      .status(200)
      .json(ApiResponse.success("Hub retrieved successfully.", hub));
  } catch (error: unknown) {
    next(error);
  }
});
