import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  noRequestSchemas,
  type ValidationLocals,
} from "../../../middleware/validation.middleware";
import { getRouteCycles } from "../services/route-cycle.service";

type RouteCyclesLocals = ValidationLocals<typeof noRequestSchemas>;

export const getRouteCyclesController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  RouteCyclesLocals
> = asyncHandler<RouteCyclesLocals>(async (_request, response) => {
  const data = await getRouteCycles();

  response
    .status(200)
    .json(
      ApiResponse.success(
        data.hasCycle ? "Route cycles detected." : "No route cycles detected.",
        data,
      ),
    );
});
