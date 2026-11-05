import dotenv from "dotenv";

dotenv.config();

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
};

const parseNonNegativeInteger = (
  value: string | undefined,
  name: string,
  defaultValue: number,
  maximum: number,
): number => {
  const parsed = Number(value ?? defaultValue);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 0 and ${maximum}.`);
  }

  return parsed;
};

const parsePositiveInteger = (
  value: string | undefined,
  name: string,
  defaultValue: number,
  maximum: number,
): number => {
  const parsed = Number(value ?? defaultValue);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }

  return parsed;
};

const nodeEnv = process.env.NODE_ENV ?? "development";

if (!["development", "production", "test"].includes(nodeEnv)) {
  throw new Error("NODE_ENV must be development, production, or test.");
}

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is required.");
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters.");
}

export const environment = {
  nodeEnv,
  port: parsePort(process.env.PORT),
  mongoUri,
  mongoMaxPoolSize: parsePositiveInteger(
    process.env.MONGODB_MAX_POOL_SIZE,
    "MONGODB_MAX_POOL_SIZE",
    20,
    100,
  ),
  jwtSecret,
  routeGraphCacheTtlMs: parseNonNegativeInteger(
    process.env.ROUTE_GRAPH_CACHE_TTL_MS,
    "ROUTE_GRAPH_CACHE_TTL_MS",
    30_000,
    3_600_000,
  ),
  trustProxy: parseNonNegativeInteger(
    process.env.TRUST_PROXY,
    "TRUST_PROXY",
    0,
    10,
  ),
  corsOrigins: (process.env.CORS_ORIGIN ?? "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;
