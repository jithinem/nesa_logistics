import { describe, expect, it } from "vitest";
import {
  detectCycles,
  type CycleDetectionGraph,
} from "../../src/algorithms/cycle-detection.algorithm";

describe("directed cycle detection", () => {
  it("returns the route and hub path for A -> B -> C -> A", () => {
    const graph: CycleDetectionGraph = {
      hubs: [{ id: "A" }, { id: "B" }, { id: "C" }],
      routes: [
        { id: "AB", sourceHubId: "A", destinationHubId: "B" },
        { id: "BC", sourceHubId: "B", destinationHubId: "C" },
        { id: "CA", sourceHubId: "C", destinationHubId: "A" },
      ],
    };

    expect(detectCycles(graph)).toEqual({
      hasCycle: true,
      cycles: [{ hubs: ["A", "B", "C", "A"], routes: ["AB", "BC", "CA"] }],
      affectedHubs: ["A", "B", "C"],
    });
  });

  it("returns no cycles for an acyclic graph", () => {
    const result = detectCycles({
      hubs: [{ id: "A" }, { id: "B" }, { id: "C" }],
      routes: [
        { id: "AB", sourceHubId: "A", destinationHubId: "B" },
        { id: "BC", sourceHubId: "B", destinationHubId: "C" },
      ],
    });

    expect(result).toEqual({
      hasCycle: false,
      cycles: [],
      affectedHubs: [],
    });
  });

  it("checks disconnected components and finds all distinct cycles", () => {
    const result = detectCycles({
      hubs: [
        { id: "A" },
        { id: "B" },
        { id: "C" },
        { id: "X" },
        { id: "Y" },
      ],
      routes: [
        { id: "AB", sourceHubId: "A", destinationHubId: "B" },
        { id: "BC", sourceHubId: "B", destinationHubId: "C" },
        { id: "CA", sourceHubId: "C", destinationHubId: "A" },
        { id: "XY", sourceHubId: "X", destinationHubId: "Y" },
        { id: "YX", sourceHubId: "Y", destinationHubId: "X" },
      ],
    });

    expect(result.cycles).toEqual([
      { hubs: ["A", "B", "C", "A"], routes: ["AB", "BC", "CA"] },
      { hubs: ["X", "Y", "X"], routes: ["XY", "YX"] },
    ]);
    expect(result.affectedHubs).toEqual(["A", "B", "C", "X", "Y"]);
  });
});
