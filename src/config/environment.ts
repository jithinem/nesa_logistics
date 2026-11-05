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

const parseAccessTokenLifetime = (
  lifetimeValue: string | undefined,
  secondsValue: string | undefined,
): {
  lifetime: `${number}s` | `${number}m` | `${number}h` | `${number}d`;
  seconds: number;
} => {
  const configuredLifetime = lifetimeValue ?? "15m";
  const seconds = parsePositiveInteger(
    secondsValue,
    "ACCESS_TOKEN_LIFETIME_SECONDS",
    900,
    31_536_000,
  );
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(configuredLifetime);

  if (!match) {
    throw new Error(
      "ACCESS_TOKEN_LIFETIME must be a positive integer followed by s, m, h, or d.",
    );
  }

  const amount = Number(match[1]);
  let lifetime: `${number}s` | `${number}m` | `${number}h` | `${number}d`;
  let lifetimeSeconds: number;

  switch (match[2]) {
    case "s":
      lifetime = `${amount}s`;
      lifetimeSeconds = amount;
      break;
    case "m":
      lifetime = `${amount}m`;
      lifetimeSeconds = amount * 60;
      break;
    case "h":
      lifetime = `${amount}h`;
      lifetimeSeconds = amount * 3_600;
      break;
    case "d":
      lifetime = `${amount}d`;
      lifetimeSeconds = amount * 86_400;
      break;
    default:
      throw new Error(
        "ACCESS_TOKEN_LIFETIME must be a positive integer followed by s, m, h, or d.",
      );
  }

  if (
    !Number.isSafeInteger(lifetimeSeconds) ||
    lifetimeSeconds !== seconds ||
    seconds > 31_536_000
  ) {
    throw new Error(
      "ACCESS_TOKEN_LIFETIME and ACCESS_TOKEN_LIFETIME_SECONDS must describe the same duration of at most one year.",
    );
  }

  return { lifetime, seconds };
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

const accessTokenLifetime = parseAccessTokenLifetime(
  process.env.ACCESS_TOKEN_LIFETIME,
  process.env.ACCESS_TOKEN_LIFETIME_SECONDS,
);

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
  accessTokenLifetime: accessTokenLifetime.lifetime,
  accessTokenLifetimeSeconds: accessTokenLifetime.seconds,
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
