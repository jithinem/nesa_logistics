import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import { z } from "zod";
import { ApiError } from "../utils/ApiError";

export interface RequestSchemas {
  body: z.ZodType;
  params: z.ZodType;
  query: z.ZodType;
}

export type ValidatedRequest<S extends RequestSchemas> = {
  body: z.output<S["body"]>;
  params: z.output<S["params"]>;
  query: z.output<S["query"]>;
};

export type ValidationLocals<S extends RequestSchemas> = {
  validatedRequest: ValidatedRequest<S>;
};

export const emptyRequestPartSchema = z.object({}).strict();
export const noRequestBodySchema = z.union([
  z.undefined(),
  z.object({}).strict(),
]);

export const noRequestSchemas = {
  body: noRequestBodySchema,
  params: emptyRequestPartSchema,
  query: emptyRequestPartSchema,
};

const validatePart = <Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  part: "body" | "params" | "query",
): z.output<Schema> => {
  try {
    return schema.parse(value);
  } catch (error: unknown) {
    if (!(error instanceof z.ZodError)) {
      throw error;
    }

    throw new ApiError(
      400,
      error.issues[0]?.message ?? `Invalid request ${part}.`,
    );
  }
};

export const validateRequest = <S extends RequestSchemas>(
  schemas: S,
): RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  ValidationLocals<S>
> =>
  (
    request: Request<ParamsDictionary, unknown, unknown, ParsedQs>,
    response: Response<unknown, ValidationLocals<S>>,
    next: NextFunction,
  ): void => {
    try {
      response.locals.validatedRequest = {
        body: validatePart<S["body"]>(schemas.body, request.body, "body"),
        params: validatePart<S["params"]>(schemas.params, request.params, "params"),
        query: validatePart<S["query"]>(schemas.query, request.query, "query"),
      };
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
