import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import type { ValidationLocals } from "../../../middleware/validation.middleware";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  createDeliverySchemas,
  getDeliverySchemas,
  listDeliveriesSchemas,
} from "../deliveries.validation";
import {
  createDelivery,
  getDeliveryById,
  listDeliveries,
} from "../services/deliveries.service";

type CreateDeliveryLocals = ValidationLocals<typeof createDeliverySchemas>;
type ListDeliveriesLocals = ValidationLocals<typeof listDeliveriesSchemas>;
type GetDeliveryLocals = ValidationLocals<typeof getDeliverySchemas>;

export const createDeliveryController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  CreateDeliveryLocals
> = asyncHandler<CreateDeliveryLocals>(async (_request, response, next) => {
  try {
    const delivery = await createDelivery(
      response.locals.validatedRequest.body,
    );
    response
      .status(201)
      .json(ApiResponse.success("Delivery created successfully.", delivery));
  } catch (error: unknown) {
    next(error);
  }
});

export const listDeliveriesController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  ListDeliveriesLocals
> = asyncHandler<ListDeliveriesLocals>(async (_request, response, next) => {
  try {
    const result = await listDeliveries(
      response.locals.validatedRequest.query,
    );
    response
      .status(200)
      .json(ApiResponse.success("Deliveries retrieved successfully.", result));
  } catch (error: unknown) {
    next(error);
  }
});

export const getDeliveryController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  GetDeliveryLocals
> = asyncHandler<GetDeliveryLocals>(async (_request, response, next) => {
  try {
    const delivery = await getDeliveryById(
      response.locals.validatedRequest.params,
    );
    response
      .status(200)
      .json(ApiResponse.success("Delivery retrieved successfully.", delivery));
  } catch (error: unknown) {
    next(error);
  }
});
