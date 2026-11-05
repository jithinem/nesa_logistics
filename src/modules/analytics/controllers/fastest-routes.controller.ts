import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  noRequestSchemas,
  type ValidationLocals,
} from "../../../middleware/validation.middleware";
import { getFastestRoutes } from "../services/fastest-routes.service";

type FastestRoutesLocals = ValidationLocals<typeof noRequestSchemas>;

export const getFastestRoutesController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  FastestRoutesLocals
> = asyncHandler<FastestRoutesLocals>(async (_request, response) => {
  const data = await getFastestRoutes();

  response
    .status(200)
    .json(
      ApiResponse.success(
        data.length > 0
          ? "Fastest available routes retrieved successfully."
          : "No available routes found.",
        data,
      ),
    );
});
