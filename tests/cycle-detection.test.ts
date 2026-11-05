import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectCycles,
  type CycleDetectionGraph,
  type CycleDetectionRoute,
} from "../src/algorithms/cycle-detection.algorithm";

const route = (
  id: string,
  sourceHubId: string,
  destinationHubId: string,
): CycleDetectionRoute => ({ id, sourceHubId, destinationHubId });

test("returns the ordered hubs and routes for a directed cycle", () => {
  const graph: CycleDetectionGraph = {
    hubs: [{ id: "A" }, { id: "B" }, { id: "C" }],
    routes: [
      route("ROUTE_AB", "A", "B"),
      route("ROUTE_BC", "B", "C"),
      route("ROUTE_CA", "C", "A"),
    ],
  };

  assert.deepEqual(detectCycles(graph), {
    hasCycle: true,
    cycles: [
      {
        hubs: ["A", "B", "C", "A"],
        routes: ["ROUTE_AB", "ROUTE_BC", "ROUTE_CA"],
      },
    ],
    affectedHubs: ["A", "B", "C"],
  });
});

test("detects distinct cycles and cycles in disconnected components", () => {
  const graph: CycleDetectionGraph = {
    hubs: [
      { id: "A" },
      { id: "B" },
      { id: "C" },
      { id: "X" },
      { id: "Y" },
    ],
    routes: [
      route("AB", "A", "B"),
      route("BC", "B", "C"),
      route("CA", "C", "A"),
      route("AC", "A", "C"),
      route("XA", "X", "Y"),
      route("YX", "Y", "X"),
    ],
  };

  const result = detectCycles(graph);

  assert.equal(result.cycles.length, 3);
  assert.deepEqual(
    result.cycles.map((cycle) => cycle.routes),
    [["AB", "BC", "CA"], ["AC", "CA"], ["XA", "YX"]],
  );
  assert.deepEqual(result.affectedHubs, ["A", "B", "C", "X", "Y"]);
});

test("returns no cycles for an acyclic graph", () => {
  const result = detectCycles({
    hubs: [{ id: "A" }, { id: "B" }, { id: "C" }],
    routes: [route("AB", "A", "B"), route("BC", "B", "C")],
  });

  assert.deepEqual(result, {
    hasCycle: false,
    cycles: [],
    affectedHubs: [],
  });
});

test("detects self-loops and does not report cycle rotations repeatedly", () => {
  const result = detectCycles({
    hubs: [{ id: "A" }, { id: "B" }],
    routes: [
      route("AB", "A", "B"),
      route("BA", "B", "A"),
      route("AA", "A", "A"),
    ],
  });

  assert.deepEqual(result.cycles, [
    { hubs: ["A", "A"], routes: ["AA"] },
    { hubs: ["A", "B", "A"], routes: ["AB", "BA"] },
  ]);
});

test("rejects duplicated IDs and dangling route references", () => {
  assert.throws(
    () =>
      detectCycles({
        hubs: [{ id: "A" }, { id: "A" }],
        routes: [],
      }),
    /hub IDs must be non-empty and unique/,
  );
  assert.throws(
    () =>
      detectCycles({
        hubs: [{ id: "A" }],
        routes: [route("AB", "A", "B")],
      }),
    /unknown destination hub/,
  );
});
