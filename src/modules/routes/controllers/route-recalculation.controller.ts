import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  updateRouteStatusAndRecalculate,
  updateRouteTrafficAndRecalculate,
} from "../services/route-recalculation.service";
import {
  routeStatusUpdateSchemas,
  trafficUpdateSchemas,
} from "../route-recalculation.validation";
import type { ValidationLocals } from "../../../middleware/validation.middleware";

type TrafficUpdateLocals = ValidationLocals<typeof trafficUpdateSchemas>;
type RouteStatusUpdateLocals = ValidationLocals<
  typeof routeStatusUpdateSchemas
>;

export const updateRouteTrafficController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  TrafficUpdateLocals
> = asyncHandler<TrafficUpdateLocals>(async (_request, response, next) => {
  try {
    const { params, body } = response.locals.validatedRequest;
    const data = await updateRouteTrafficAndRecalculate(params.routeId, body);

    response
      .status(200)
      .json(
        ApiResponse.success(
          "Route traffic updated and active deliveries recalculated.",
          data,
        ),
      );
  } catch (error: unknown) {
    next(error);
  }
});

export const updateRouteStatusController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  RouteStatusUpdateLocals
> = asyncHandler<RouteStatusUpdateLocals>(async (_request, response, next) => {
  try {
    const { params, body } = response.locals.validatedRequest;
    const data = await updateRouteStatusAndRecalculate(params.routeId, body);

    response
      .status(200)
      .json(
        ApiResponse.success(
          "Route status updated and active deliveries recalculated.",
          data,
        ),
      );
  } catch (error: unknown) {
    next(error);
  }
});
