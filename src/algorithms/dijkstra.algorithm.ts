export type RouteTrafficCondition = "LOW" | "MEDIUM" | "HIGH";
export type RouteAvailability = "AVAILABLE" | "BLOCKED";

export interface RouteHub {
  id: string;
  name?: string;
}

export interface RouteConnection {
  id: string;
  sourceHubId: string;
  destinationHubId: string;
  distance: number;
  travelTime: number;
  fuelCost: number;
  trafficCondition: RouteTrafficCondition;
  trafficMultiplier: number;
  status: RouteAvailability;
}

export interface RouteGraph {
  hubs: readonly RouteHub[];
  routes: readonly RouteConnection[];
}

export interface OptimizationWeights {
  distance: number;
  travelTime: number;
  fuelCost: number;
}

export interface OptimizedRoute {
  hubs: RouteHub[];
  selectedRouteIds: string[];
  totalDistance: number;
  totalEffectiveTravelTime: number;
  totalFuelCost: number;
  totalOptimizationScore: number;
}

interface QueueEntry {
  hubId: string;
  score: number;
  order: number;
}

const DEFAULT_WEIGHTS: Readonly<OptimizationWeights> = {
  distance: 0.3,
  travelTime: 0.5,
  fuelCost: 0.2,
};

class MinPriorityQueue {
  private readonly entries: QueueEntry[] = [];

  public get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  public push(entry: QueueEntry): void {
    this.entries.push(entry);
    let index = this.entries.length - 1;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.entries[parentIndex];
      const current = this.entries[index];

      if (!parent || !current || this.compare(parent, current) <= 0) {
        break;
      }

      this.entries[parentIndex] = current;
      this.entries[index] = parent;
      index = parentIndex;
    }
  }

  public pop(): QueueEntry | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();

    if (!first || this.entries.length === 0 || !last) {
      return first;
    }

    this.entries[0] = last;
    let index = 0;

    while (true) {
      const leftIndex = 2 * index + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = index;
      const smallest = this.entries[smallestIndex];
      const left = this.entries[leftIndex];
      const right = this.entries[rightIndex];

      if (smallest && left && this.compare(left, smallest) < 0) {
        smallestIndex = leftIndex;
      }

      const currentSmallest = this.entries[smallestIndex];
      if (currentSmallest && right && this.compare(right, currentSmallest) < 0) {
        smallestIndex = rightIndex;
      }

      if (smallestIndex === index) {
        break;
      }

      const current = this.entries[index];
      const next = this.entries[smallestIndex];

      if (!current || !next) {
        break;
      }

      this.entries[index] = next;
      this.entries[smallestIndex] = current;
      index = smallestIndex;
    }

    return first;
  }

  private compare(left: QueueEntry, right: QueueEntry): number {
    return left.score - right.score || left.order - right.order;
  }
}

const getWeights = (
  configured: Partial<OptimizationWeights>,
): OptimizationWeights => {
  const weights = { ...DEFAULT_WEIGHTS, ...configured };

  for (const [name, value] of Object.entries(weights)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} weight must be a finite non-negative number.`);
    }
  }

  return weights;
};

const assertNonNegativeFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number.`);
  }
};

/**
 * Finds the minimum weighted-cost path in a directed route graph.
 *
 * With a binary min-heap the running time is O((V + E) log(E + 1)), and
 * the auxiliary space is O(V + E), including the adjacency list.
 * The score uses raw distance and fuel cost plus traffic-adjusted travel time.
 */
export const findOptimalRoute = (
  graph: RouteGraph,
  originHubId: string,
  destinationHubId: string,
  configuredWeights: Partial<OptimizationWeights> = {},
): OptimizedRoute | null => {
  const weights = getWeights(configuredWeights);
  const hubsById = new Map<string, RouteHub>();

  for (const hub of graph.hubs) {
    if (!hub.id || hubsById.has(hub.id)) {
      throw new TypeError("Graph hub IDs must be non-empty and unique.");
    }

    hubsById.set(hub.id, hub);
  }

  if (!hubsById.has(originHubId)) {
    throw new RangeError(`Origin hub "${originHubId}" does not exist in graph.`);
  }

  if (!hubsById.has(destinationHubId)) {
    throw new RangeError(
      `Destination hub "${destinationHubId}" does not exist in graph.`,
    );
  }

  if (originHubId === destinationHubId) {
    const originHub = hubsById.get(originHubId);

    if (!originHub) {
      throw new Error("Origin hub disappeared from the graph.");
    }

    return {
      hubs: [originHub],
      selectedRouteIds: [],
      totalDistance: 0,
      totalEffectiveTravelTime: 0,
      totalFuelCost: 0,
      totalOptimizationScore: 0,
    };
  }

  const routeIds = new Set<string>();
  const outgoingRoutes = new Map<string, RouteConnection[]>();

  for (const hubId of hubsById.keys()) {
    outgoingRoutes.set(hubId, []);
  }

  for (const route of graph.routes) {
    if (!route.id || routeIds.has(route.id)) {
      throw new TypeError("Graph route IDs must be non-empty and unique.");
    }
    if (!hubsById.has(route.sourceHubId)) {
      throw new RangeError(
        `Route "${route.id}" references unknown source hub "${route.sourceHubId}".`,
      );
    }
    if (!hubsById.has(route.destinationHubId)) {
      throw new RangeError(
        `Route "${route.id}" references unknown destination hub "${route.destinationHubId}".`,
      );
    }
    if (!["LOW", "MEDIUM", "HIGH"].includes(route.trafficCondition)) {
      throw new TypeError(`Route "${route.id}" has an invalid traffic condition.`);
    }
    if (route.status !== "AVAILABLE" && route.status !== "BLOCKED") {
      throw new TypeError(`Route "${route.id}" has an invalid availability status.`);
    }

    assertNonNegativeFinite(route.distance, `Route "${route.id}" distance`);
    assertNonNegativeFinite(route.travelTime, `Route "${route.id}" travel time`);
    assertNonNegativeFinite(route.fuelCost, `Route "${route.id}" fuel cost`);
    assertNonNegativeFinite(
      route.trafficMultiplier,
      `Route "${route.id}" traffic multiplier`,
    );

    routeIds.add(route.id);
    if (route.status === "AVAILABLE") {
      outgoingRoutes.get(route.sourceHubId)?.push(route);
    }
  }

  const bestScores = new Map<string, number>([[originHubId, 0]]);
  const previousRoutes = new Map<string, RouteConnection>();
  const queue = new MinPriorityQueue();
  let queueOrder = 0;
  queue.push({ hubId: originHubId, score: 0, order: queueOrder++ });

  while (!queue.isEmpty) {
    const current = queue.pop();

    if (!current || current.score !== bestScores.get(current.hubId)) {
      continue;
    }

    if (current.hubId === destinationHubId) {
      break;
    }

    for (const route of outgoingRoutes.get(current.hubId) ?? []) {
      const effectiveTravelTime = route.travelTime * route.trafficMultiplier;
      const edgeScore =
        route.distance * weights.distance +
        effectiveTravelTime * weights.travelTime +
        route.fuelCost * weights.fuelCost;
      const nextScore = current.score + edgeScore;

      assertNonNegativeFinite(edgeScore, `Route "${route.id}" optimization score`);
      assertNonNegativeFinite(nextScore, "Accumulated optimization score");

      if (nextScore < (bestScores.get(route.destinationHubId) ?? Infinity)) {
        bestScores.set(route.destinationHubId, nextScore);
        previousRoutes.set(route.destinationHubId, route);
        queue.push({
          hubId: route.destinationHubId,
          score: nextScore,
          order: queueOrder++,
        });
      }
    }
  }

  if (!bestScores.has(destinationHubId)) {
    return null;
  }

  const pathHubIds = [destinationHubId];
  const pathRoutes: RouteConnection[] = [];
  let currentHubId = destinationHubId;

  while (currentHubId !== originHubId) {
    const route = previousRoutes.get(currentHubId);

    if (!route) {
      throw new Error("Unable to reconstruct the optimized route.");
    }

    pathRoutes.push(route);
    currentHubId = route.sourceHubId;
    pathHubIds.push(currentHubId);
  }

  pathHubIds.reverse();
  pathRoutes.reverse();

  const totals = pathRoutes.reduce(
    (result, route) => {
      result.distance += route.distance;
      result.effectiveTravelTime += route.travelTime * route.trafficMultiplier;
      result.fuelCost += route.fuelCost;

      assertNonNegativeFinite(result.distance, "Total distance");
      assertNonNegativeFinite(result.effectiveTravelTime, "Total effective travel time");
      assertNonNegativeFinite(result.fuelCost, "Total fuel cost");

      return result;
    },
    { distance: 0, effectiveTravelTime: 0, fuelCost: 0 },
  );

  return {
    hubs: pathHubIds.map((hubId) => {
      const hub = hubsById.get(hubId);

      if (!hub) {
        throw new Error(`Hub "${hubId}" disappeared during path reconstruction.`);
      }

      return hub;
    }),
    selectedRouteIds: pathRoutes.map((route) => route.id),
    totalDistance: totals.distance,
    totalEffectiveTravelTime: totals.effectiveTravelTime,
    totalFuelCost: totals.fuelCost,
    totalOptimizationScore: bestScores.get(destinationHubId) ?? 0,
  };
};
