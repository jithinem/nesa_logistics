export interface CycleDetectionHub {
  id: string;
}

export interface CycleDetectionRoute {
  id: string;
  sourceHubId: string;
  destinationHubId: string;
}

export interface CycleDetectionGraph {
  hubs: readonly CycleDetectionHub[];
  routes: readonly CycleDetectionRoute[];
}

export interface DetectedCycle {
  hubs: string[];
  routes: string[];
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cycles: DetectedCycle[];
  affectedHubs: string[];
}

/**
 * Enumerates directed simple cycles with depth-first search.
 *
 * A cycle is started only at its lowest-index hub, which avoids reporting
 * rotations of the same directed cycle. This reports distinct route sequences
 * separately when parallel routes create distinct cycles.
 *
 * Time: O(V + E log E + P), where P is the number of route examinations during
 * the DFS searches. P can be exponential because the number of simple paths and
 * cycles can be exponential.
 * Space: O(V + E + L), where L is the total size of the returned cycle paths.
 */
export const detectCycles = (
  graph: CycleDetectionGraph,
): CycleDetectionResult => {
  const hubIndexes = new Map<string, number>();

  graph.hubs.forEach((hub, index) => {
    if (!hub.id || hubIndexes.has(hub.id)) {
      throw new TypeError("Graph hub IDs must be non-empty and unique.");
    }

    hubIndexes.set(hub.id, index);
  });

  const routeIds = new Set<string>();
  const outgoingRoutes = new Map<string, CycleDetectionRoute[]>();

  for (const hub of graph.hubs) {
    outgoingRoutes.set(hub.id, []);
  }

  for (const route of graph.routes) {
    if (!route.id || routeIds.has(route.id)) {
      throw new TypeError("Graph route IDs must be non-empty and unique.");
    }
    if (!hubIndexes.has(route.sourceHubId)) {
      throw new RangeError(
        `Route "${route.id}" references unknown source hub "${route.sourceHubId}".`,
      );
    }
    if (!hubIndexes.has(route.destinationHubId)) {
      throw new RangeError(
        `Route "${route.id}" references unknown destination hub "${route.destinationHubId}".`,
      );
    }

    routeIds.add(route.id);
    outgoingRoutes.get(route.sourceHubId)?.push(route);
  }

  for (const routes of outgoingRoutes.values()) {
    routes.sort((left, right) => left.id.localeCompare(right.id));
  }

  const cycles: DetectedCycle[] = [];
  const cycleKeys = new Set<string>();

  for (const startHub of graph.hubs) {
    const startIndex = hubIndexes.get(startHub.id);

    if (startIndex === undefined) {
      continue;
    }

    const pathHubs = [startHub.id];
    const pathRoutes: string[] = [];
    const visited = new Set<string>([startHub.id]);
    const recursionStack = new Set<string>([startHub.id]);

    const visit = (hubId: string): void => {
      for (const route of outgoingRoutes.get(hubId) ?? []) {
        const destinationIndex = hubIndexes.get(route.destinationHubId);

        if (destinationIndex === undefined || destinationIndex < startIndex) {
          continue;
        }

        if (recursionStack.has(route.destinationHubId)) {
          if (route.destinationHubId !== startHub.id) {
            continue;
          }

          const cycleRouteIds = [...pathRoutes, route.id];
          const cycleKey = JSON.stringify(cycleRouteIds);

          if (!cycleKeys.has(cycleKey)) {
            cycleKeys.add(cycleKey);
            cycles.push({
              hubs: [...pathHubs, startHub.id],
              routes: cycleRouteIds,
            });
          }

          continue;
        }

        if (visited.has(route.destinationHubId)) {
          continue;
        }

        visited.add(route.destinationHubId);
        recursionStack.add(route.destinationHubId);
        pathHubs.push(route.destinationHubId);
        pathRoutes.push(route.id);

        visit(route.destinationHubId);

        pathRoutes.pop();
        pathHubs.pop();
        recursionStack.delete(route.destinationHubId);
        visited.delete(route.destinationHubId);
      }
    };

    visit(startHub.id);
  }

  const affectedHubIds = new Set<string>();
  for (const cycle of cycles) {
    for (const hubId of cycle.hubs.slice(0, -1)) {
      affectedHubIds.add(hubId);
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles,
    affectedHubs: graph.hubs
      .filter((hub) => affectedHubIds.has(hub.id))
      .map((hub) => hub.id),
  };
};
