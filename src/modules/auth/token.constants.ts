import type { VerifyOptions } from "jsonwebtoken";
import { environment } from "../../config/environment";

export const ACCESS_TOKEN_ISSUER = "nesa-logistics-api";
export const ACCESS_TOKEN_AUDIENCE = "nesa-logistics-client";
export const ACCESS_TOKEN_LIFETIME = environment.accessTokenLifetime;
export const ACCESS_TOKEN_LIFETIME_SECONDS =
  environment.accessTokenLifetimeSeconds;

export const tokenVerificationOptions: VerifyOptions = {
  algorithms: ["HS256"],
  issuer: ACCESS_TOKEN_ISSUER,
  audience: ACCESS_TOKEN_AUDIENCE,
};
