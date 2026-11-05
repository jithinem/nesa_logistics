import type { RequestHandler } from "express";
import { UserRole } from "../shared/types/logistics";
import { ApiError } from "../utils/ApiError";

export const roleMiddleware = (...allowedRoles: UserRole[]): RequestHandler => {
  if (allowedRoles.length === 0) {
    throw new Error("At least one authorized role must be specified.");
  }

  return (request, _response, next): void => {
    if (!request.authUser) {
      next(new ApiError(401, "Authentication is required."));
      return;
    }

    if (!allowedRoles.includes(request.authUser.role)) {
      next(new ApiError(403, "You do not have permission to perform this action."));
      return;
    }

    next();
  };
};
