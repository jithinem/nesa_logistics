import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import type { ValidationLocals } from "../../../middleware/validation.middleware";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ApiResponse } from "../../../utils/ApiResponse";
import {
  loginRequestSchemas,
  registerRequestSchemas,
} from "../auth.validation";
import { loginUser, registerUser } from "../services/auth.service";

type RegisterLocals = ValidationLocals<typeof registerRequestSchemas>;
type LoginLocals = ValidationLocals<typeof loginRequestSchemas>;

export const registerController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  RegisterLocals
> = asyncHandler<RegisterLocals>(async (_request, response) => {
  const data = await registerUser(response.locals.validatedRequest.body);

  response
    .status(201)
    .json(ApiResponse.success("User registered successfully.", data));
});

export const loginController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  LoginLocals
> = asyncHandler<LoginLocals>(async (_request, response) => {
  const data = await loginUser(response.locals.validatedRequest.body);

  response
    .status(200)
    .json(ApiResponse.success("Login successful.", data));
});
