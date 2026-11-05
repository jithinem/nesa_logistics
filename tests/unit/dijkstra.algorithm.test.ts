import { describe, expect, it } from "vitest";
import {
  findOptimalRoute,
  type RouteConnection,
  type RouteGraph,
} from "../../src/algorithms/dijkstra.algorithm";

const makeRoute = (
  id: string,
  sourceHubId: string,
  destinationHubId: string,
  overrides: Partial<RouteConnection> = {},
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
  ...overrides,
});

const makeGraph = (...routes: RouteConnection[]): RouteGraph => ({
  hubs: [
    { id: "A", name: "Alpha" },
    { id: "B", name: "Bravo" },
    { id: "C", name: "Charlie" },
    { id: "D", name: "Delta" },
  ],
  routes,
});

describe("Dijkstra route optimization", () => {
  it("chooses the lowest weighted path from multiple alternatives", () => {
    const result = findOptimalRoute(
      makeGraph(
        makeRoute("direct", "A", "D", {
          distance: 100,
          travelTime: 120,
          fuelCost: 50,
        }),
        makeRoute("ab", "A", "B", {
          distance: 10,
          travelTime: 10,
          fuelCost: 5,
        }),
        makeRoute("bd", "B", "D", {
          distance: 10,
          travelTime: 10,
          fuelCost: 5,
        }),
        makeRoute("ac", "A", "C", {
          distance: 15,
          travelTime: 30,
          fuelCost: 20,
        }),
        makeRoute("cd", "C", "D", {
          distance: 15,
          travelTime: 30,
          fuelCost: 20,
        }),
      ),
      "A",
      "D",
    );

    expect(result?.hubs.map((hub) => hub.id)).toEqual(["A", "B", "D"]);
    expect(result?.selectedRouteIds).toEqual(["ab", "bd"]);
    expect(result?.totalDistance).toBe(20);
    expect(result?.totalEffectiveTravelTime).toBe(20);
    expect(result?.totalFuelCost).toBe(10);
    expect(result?.totalOptimizationScore).toBe(18);
  });

  it("excludes blocked routes when an available alternative exists", () => {
    const result = findOptimalRoute(
      makeGraph(
        makeRoute("blocked-direct", "A", "D", {
          status: "BLOCKED",
          distance: 1,
          travelTime: 1,
          fuelCost: 1,
        }),
        makeRoute("available", "A", "D"),
      ),
      "A",
      "D",
    );

    expect(result?.selectedRouteIds).toEqual(["available"]);
  });

  it("returns null when no available path exists", () => {
    const result = findOptimalRoute(
      makeGraph(makeRoute("blocked", "A", "D", { status: "BLOCKED" })),
      "A",
      "D",
    );

    expect(result).toBeNull();
  });

  it("returns a zero-cost path when origin and destination are the same", () => {
    expect(findOptimalRoute(makeGraph(), "A", "A")).toEqual({
      hubs: [{ id: "A", name: "Alpha" }],
      selectedRouteIds: [],
      totalDistance: 0,
      totalEffectiveTravelTime: 0,
      totalFuelCost: 0,
      totalOptimizationScore: 0,
    });
  });
});
