import type { VerifyOptions } from "jsonwebtoken";

export const ACCESS_TOKEN_ISSUER = "nesa-logistics-api";
export const ACCESS_TOKEN_AUDIENCE = "nesa-logistics-client";
export const ACCESS_TOKEN_LIFETIME = "15m";
export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;

export const tokenVerificationOptions: VerifyOptions = {
  algorithms: ["HS256"],
  issuer: ACCESS_TOKEN_ISSUER,
  audience: ACCESS_TOKEN_AUDIENCE,
};
