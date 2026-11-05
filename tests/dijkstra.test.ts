import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findOptimalRoute,
  type RouteConnection,
  type RouteGraph,
} from "../src/algorithms/dijkstra.algorithm";

const route = (
  id: string,
  sourceHubId: string,
  destinationHubId: string,
  values: Partial<RouteConnection> = {},
): RouteConnection => ({
  id,
  sourceHubId,
  destinationHubId,
  distance: 10,
  travelTime: 10,
  fuelCost: 10,
  trafficCondition: "LOW",
  trafficMultiplier: 1,
  status: "AVAILABLE",
  ...values,
});

const graph = (...routes: RouteConnection[]): RouteGraph => ({
  hubs: [
    { id: "A", name: "Alpha" },
    { id: "B", name: "Bravo" },
    { id: "C", name: "Charlie" },
  ],
  routes,
});

test("finds the lowest weighted score and returns path totals", () => {
  const result = findOptimalRoute(
    graph(
      route("direct", "A", "C", {
        distance: 10,
        travelTime: 100,
        fuelCost: 20,
      }),
      route("ab", "A", "B", {
        distance: 20,
        travelTime: 10,
        fuelCost: 1,
      }),
      route("bc", "B", "C", {
        distance: 20,
        travelTime: 10,
        fuelCost: 1,
      }),
    ),
    "A",
    "C",
  );

  assert.deepEqual(result?.hubs.map((hub) => hub.id), ["A", "B", "C"]);
  assert.deepEqual(result?.selectedRouteIds, ["ab", "bc"]);
  assert.equal(result?.totalDistance, 40);
  assert.equal(result?.totalEffectiveTravelTime, 20);
  assert.equal(result?.totalFuelCost, 2);
  assert.equal(result?.totalOptimizationScore, 22.4);
});

test("configurable weights can change which path is selected", () => {
  const routes = graph(
    route("direct", "A", "C", {
      distance: 10,
      travelTime: 100,
      fuelCost: 20,
    }),
    route("ab", "A", "B", {
      distance: 20,
      travelTime: 10,
      fuelCost: 1,
    }),
    route("bc", "B", "C", {
      distance: 20,
      travelTime: 10,
      fuelCost: 1,
    }),
  );

  const result = findOptimalRoute(routes, "A", "C", {
    distance: 1,
    travelTime: 0,
    fuelCost: 0,
  });

  assert.deepEqual(result?.selectedRouteIds, ["direct"]);
  assert.equal(result?.totalOptimizationScore, 10);
});

test("traffic multiplier is applied to travel time and blocked routes are excluded", () => {
  const result = findOptimalRoute(
    graph(
      route("blocked", "A", "C", {
        status: "BLOCKED",
        distance: 1,
        travelTime: 1,
        fuelCost: 1,
      }),
      route("traffic", "A", "B", {
        trafficCondition: "HIGH",
        trafficMultiplier: 1.5,
        travelTime: 10,
      }),
      route("last-mile", "B", "C", {
        travelTime: 5,
        trafficMultiplier: 2,
      }),
    ),
    "A",
    "C",
  );

  assert.deepEqual(result?.selectedRouteIds, ["traffic", "last-mile"]);
  assert.equal(result?.totalEffectiveTravelTime, 25);
});

test("returns a zero-cost path when origin and destination are the same", () => {
  const result = findOptimalRoute(graph(), "A", "A");

  assert.deepEqual(result, {
    hubs: [{ id: "A", name: "Alpha" }],
    selectedRouteIds: [],
    totalDistance: 0,
    totalEffectiveTravelTime: 0,
    totalFuelCost: 0,
    totalOptimizationScore: 0,
  });
});

test("throws when either requested hub does not exist", () => {
  const routes = graph();

  assert.throws(() => findOptimalRoute(routes, "missing", "A"), /Origin hub/);
  assert.throws(() => findOptimalRoute(routes, "A", "missing"), /Destination hub/);
});

test("returns null when no available path exists", () => {
  const result = findOptimalRoute(
    graph(route("closed", "A", "C", { status: "BLOCKED" })),
    "A",
    "C",
  );

  assert.equal(result, null);
});

test("rejects negative edge costs and weights", () => {
  assert.throws(
    () => findOptimalRoute(graph(route("negative", "A", "C", { distance: -1 })), "A", "C"),
    /distance must be a finite non-negative number/,
  );
  assert.throws(
    () => findOptimalRoute(graph(), "A", "C", { travelTime: -1 }),
    /weight must be a finite non-negative number/,
  );
});
