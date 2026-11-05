import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../src/app";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(() => {
  server = app.listen(0);
  const address = server.address();

  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
});

test("health endpoint returns a successful response", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: "Service is healthy.",
  });
});

test("root liveness endpoint reports the process is running", async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    status: "live",
  });
});

test("readiness endpoint reports MongoDB is unavailable when disconnected", async () => {
  const response = await fetch(`${baseUrl}/health/ready`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    success: false,
    status: "not_ready",
  });
});

test("route optimization requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/routes/optimize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      originHub: "not-an-object-id",
      destinationHub: "507f1f77bcf86cd799439011",
    }),
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, "Authentication is required.");
});

test("route traffic update requires authentication", async () => {
  const invalidIdResponse = await fetch(
    `${baseUrl}/api/routes/not-an-id/traffic`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trafficCondition: "HIGH",
        trafficMultiplier: 1.5,
      }),
    },
  );
  assert.equal(invalidIdResponse.status, 401);
  assert.equal(
    (await invalidIdResponse.json()).message,
    "Authentication is required.",
  );

  const invalidMultiplierResponse = await fetch(
    `${baseUrl}/api/routes/507f1f77bcf86cd799439011/traffic`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trafficCondition: "HIGH",
        trafficMultiplier: -1,
      }),
    },
  );
  assert.equal(invalidMultiplierResponse.status, 401);
  assert.equal(
    (await invalidMultiplierResponse.json()).message,
    "Authentication is required.",
  );
});

test("route status update requires authentication", async () => {
  const response = await fetch(
    `${baseUrl}/api/routes/507f1f77bcf86cd799439011/status`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "DELAYED" }),
    },
  );

  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, "Authentication is required.");
});

test("cycle endpoint requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/routes/cycles?unsupported=true`);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, "Authentication is required.");
});

test("registration rejects role assignment and weak passwords", async () => {
  const roleResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: "test@example.com",
      password: "A-strong-password-123",
      role: "ADMIN",
    }),
  });
  assert.equal(roleResponse.status, 400);

  const weakPasswordResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: "test@example.com",
      password: "short",
    }),
  });
  assert.equal(weakPasswordResponse.status, 400);
});

test("hub and delivery operations require authentication", async () => {
  for (const path of ["/api/v1/hubs", "/api/v1/deliveries"]) {
    const response = await fetch(`${baseUrl}${path}`);

    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, "Authentication is required.");
  }
});

test("malformed JSON is returned as a client error", async () => {
  const response = await fetch(`${baseUrl}/api/routes/optimize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Request body contains invalid JSON.",
  });
});
