import assert from "node:assert/strict";
import { test } from "node:test";
import { RouteStatus, TrafficCondition } from "../src/shared/types/logistics";
import { seedHubs, seedRoutes } from "../src/seed/seed-data";

const availableRoutes = seedRoutes.filter(
  (route) => route.status === RouteStatus.AVAILABLE,
);

const hasPath = (source: string, destination: string): boolean => {
  const pending = [source];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.shift();

    if (!current || visited.has(current)) {
      continue;
    }

    if (current === destination) {
      return true;
    }

    visited.add(current);
    for (const route of availableRoutes) {
      if (route.sourceCode === current && !visited.has(route.destinationCode)) {
        pending.push(route.destinationCode);
      }
    }
  }

  return false;
};

test("seed data has unique hubs and at least twenty directed routes", () => {
  const hubCodes = seedHubs.map((hub) => hub.code);
  const routeIds = seedRoutes.map((route) => route.id);
  const routePairs = seedRoutes.map(
    (route) => `${route.sourceCode}->${route.destinationCode}`,
  );

  assert.ok(seedHubs.length >= 10);
  assert.equal(new Set(hubCodes).size, hubCodes.length);
  assert.ok(seedRoutes.length >= 20);
  assert.equal(new Set(routeIds).size, routeIds.length);
  assert.equal(new Set(routePairs).size, routePairs.length);
  assert.ok(seedRoutes.every((route) => route.sourceCode !== route.destinationCode));
  assert.ok(seedRoutes.every((route) => hubCodes.includes(route.sourceCode)));
  assert.ok(seedRoutes.every((route) => hubCodes.includes(route.destinationCode)));
});

test("seed graph includes alternate paths, a cycle, and multiple outgoing routes", () => {
  const outgoingCounts = new Map<string, number>();

  for (const route of availableRoutes) {
    outgoingCounts.set(
      route.sourceCode,
      (outgoingCounts.get(route.sourceCode) ?? 0) + 1,
    );
  }

  assert.ok((outgoingCounts.get("EWR") ?? 0) >= 2);
  assert.equal(hasPath("EWR", "PHL"), true);
  assert.equal(
    availableRoutes.some(
      (route) => route.sourceCode === "EWR" && route.destinationCode === "PHL",
    ),
    true,
  );
  assert.ok(
    availableRoutes.some(
      (route) => route.sourceCode === "EWR" && route.destinationCode === "NYC",
    ),
  );
  assert.ok(
    availableRoutes.some(
      (route) => route.sourceCode === "NYC" && route.destinationCode === "PHL",
    ),
  );
  assert.equal(hasPath("EWR", "NYC"), true);
  assert.equal(hasPath("NYC", "PHL"), true);
  assert.equal(hasPath("PHL", "EWR"), true);
});

test("seed routes cover traffic conditions and available and blocked states", () => {
  assert.ok(
    seedRoutes.some((route) => route.trafficCondition === TrafficCondition.HIGH),
  );
  assert.ok(
    seedRoutes.some((route) => route.trafficCondition === TrafficCondition.MEDIUM),
  );
  assert.ok(
    seedRoutes.some((route) => route.trafficCondition === TrafficCondition.LOW),
  );
  assert.ok(seedRoutes.some((route) => route.status === RouteStatus.AVAILABLE));
  assert.ok(seedRoutes.some((route) => route.status === RouteStatus.BLOCKED));
  assert.ok(
    seedRoutes.every(
      (route) =>
        Number.isFinite(route.distance) &&
        route.distance > 0 &&
        Number.isFinite(route.travelTime) &&
        route.travelTime > 0 &&
        Number.isFinite(route.fuelCost) &&
        route.fuelCost > 0,
    ),
  );
});
