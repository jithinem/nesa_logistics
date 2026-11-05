import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import type { ValidationLocals } from "../../../middleware/validation.middleware";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  createRouteSchemas,
  listRoutesSchemas,
} from "../route-management.validation";
import { createRoute, listRoutes } from "../services/route-management.service";

type CreateRouteLocals = ValidationLocals<typeof createRouteSchemas>;
type ListRoutesLocals = ValidationLocals<typeof listRoutesSchemas>;

export const createRouteController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  CreateRouteLocals
> = asyncHandler<CreateRouteLocals>(async (_request, response, next) => {
  try {
    const route = await createRoute(response.locals.validatedRequest.body);
    response
      .status(201)
      .json(ApiResponse.success("Route created successfully.", route));
  } catch (error: unknown) {
    next(error);
  }
});

export const listRoutesController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  ListRoutesLocals
> = asyncHandler<ListRoutesLocals>(async (_request, response, next) => {
  try {
    const result = await listRoutes(response.locals.validatedRequest.query);
    response
      .status(200)
      .json(ApiResponse.success("Routes retrieved successfully.", result));
  } catch (error: unknown) {
    next(error);
  }
});
