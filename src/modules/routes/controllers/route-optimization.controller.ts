import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import { optimizeRoute } from "../services/route-optimization.service";
import { routeOptimizationRequestSchemas } from "../routes.validation";
import type { ValidationLocals } from "../../../middleware/validation.middleware";

type RouteOptimizationLocals = ValidationLocals<
  typeof routeOptimizationRequestSchemas
>;

export const optimizeRouteController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  RouteOptimizationLocals
> = asyncHandler<RouteOptimizationLocals>(async (_request, response) => {
  const data = await optimizeRoute(response.locals.validatedRequest.body);

  response
    .status(200)
    .json(ApiResponse.success("Route optimized successfully", data));
});
