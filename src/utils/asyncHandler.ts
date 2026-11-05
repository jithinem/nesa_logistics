import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

type AsyncController<Locals extends Record<string, unknown>> = (
  request: Request<ParamsDictionary, unknown, unknown, ParsedQs, Locals>,
  response: Response<unknown, Locals>,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler = <Locals extends Record<string, unknown>>(
  controller: AsyncController<Locals>,
): RequestHandler<ParamsDictionary, unknown, unknown, ParsedQs, Locals> =>
  (request, response, next): void => {
    void controller(request, response, next).catch(next);
  };
