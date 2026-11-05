import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { environment } from "../config/environment";

const isDuplicateKeyError = (
  error: unknown,
): error is { code: 11000; keyValue?: unknown } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const isMalformedJsonError = (
  error: unknown,
): error is SyntaxError & { status: 400; type: "entity.parse.failed" } =>
  error instanceof SyntaxError &&
  "status" in error &&
  error.status === 400 &&
  "type" in error &&
  error.type === "entity.parse.failed";

const normalizeError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return new ApiError(400, "Request data failed database validation.", {
      message: error.message,
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return new ApiError(400, "Request contains an invalid identifier.");
  }

  if (isDuplicateKeyError(error)) {
    return new ApiError(409, "A record with the provided unique value already exists.");
  }

  if (isMalformedJsonError(error)) {
    return new ApiError(400, "Request body contains invalid JSON.");
  }

  return new ApiError(500, "Internal server error.");
};

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
): void => {
  const apiError = normalizeError(error);

  if (apiError.statusCode >= 500 && environment.nodeEnv !== "test") {
    console.error(error);
  }

  response
    .status(apiError.statusCode)
    .json(ApiResponse.failure(apiError.message, apiError.details));
};
