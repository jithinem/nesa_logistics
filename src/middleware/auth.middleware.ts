import type { RequestHandler } from "express";
import {
  findAuthenticatedUser,
  verifyAccessToken,
} from "../modules/auth/services/token.service";
import { ApiError } from "../utils/ApiError";

export const authMiddleware: RequestHandler = (request, _response, next) => {
  const authorization = request.get("authorization");
  const bearerMatch =
    authorization && /^Bearer ([^\s]+)$/i.exec(authorization);

  if (!bearerMatch?.[1]) {
    next(new ApiError(401, "Authentication is required."));
    return;
  }

  const claims = verifyAccessToken(bearerMatch[1]);
  if (!claims) {
    next(new ApiError(401, "Access token is invalid or expired."));
    return;
  }

  void findAuthenticatedUser(claims)
    .then((user) => {
      if (!user) {
        next(new ApiError(401, "Access token is no longer valid."));
        return;
      }

      request.authUser = user;
      next();
    })
    .catch(next);
};
