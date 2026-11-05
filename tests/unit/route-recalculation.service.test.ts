import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  DeliveryStatus,
  RouteOptimizationStatus,
  RouteStatus,
  TrafficCondition,
} from "../../src/shared/types/logistics";

const mocks = vi.hoisted(() => ({
  deliveryFind: vi.fn(),
  deliveryBulkWrite: vi.fn(),
  routeFindById: vi.fn(),
  loadRouteGraph: vi.fn(),
  findOptimizedRouteInGraph: vi.fn(),
  invalidateRouteGraphCache: vi.fn(),
  emitDeliveryRouteRecalculated: vi.fn(),
  emitRouteAvailabilityChanged: vi.fn(),
  emitRouteTrafficUpdated: vi.fn(),
}));

vi.mock("../../src/modules/deliveries/models/delivery.model", () => ({
  DeliveryModel: {
    find: mocks.deliveryFind,
    bulkWrite: mocks.deliveryBulkWrite,
  },
}));

vi.mock("../../src/modules/routes/models/route.model", () => ({
  RouteModel: { findById: mocks.routeFindById },
}));

vi.mock("../../src/modules/routes/services/route-optimization.service", () => ({
  loadRouteGraph: mocks.loadRouteGraph,
  findOptimizedRouteInGraph: mocks.findOptimizedRouteInGraph,
  invalidateRouteGraphCache: mocks.invalidateRouteGraphCache,
}));

vi.mock("../../src/sockets/socket", () => ({
  emitDeliveryRouteRecalculated: mocks.emitDeliveryRouteRecalculated,
  emitRouteAvailabilityChanged: mocks.emitRouteAvailabilityChanged,
  emitRouteTrafficUpdated: mocks.emitRouteTrafficUpdated,
}));

import {
  recalculateActiveDeliveries,
  updateRouteStatusAndRecalculate,
  updateRouteTrafficAndRecalculate,
} from "../../src/modules/routes/services/route-recalculation.service";

const routeId = new Types.ObjectId();
const deliveryId = new Types.ObjectId();
const originHubId = new Types.ObjectId();
const destinationHubId = new Types.ObjectId();

const existingDelivery = () => ({
  _id: deliveryId,
  originHub: originHubId,
  destinationHub: destinationHubId,
  status: DeliveryStatus.PLANNED,
  currentRoute: [routeId],
  totalDistance: 100,
  totalTravelTime: 100,
  totalFuelCost: 100,
  totalCalculatedCost: 100,
  routeOptimizationStatus: RouteOptimizationStatus.OPTIMIZED,
});

let initialRouteStatus = RouteStatus.AVAILABLE;

const routeDocument = () => ({
  _id: routeId,
  trafficCondition: TrafficCondition.LOW,
  trafficMultiplier: 1,
  status: initialRouteStatus,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  save: vi.fn().mockResolvedValue(undefined),
});

const availableOptimization = () => ({
  routes: [{ id: routeId.toString() }],
  totalDistance: 10,
  totalTravelTime: 20,
  totalFuelCost: 5,
  totalCalculatedCost: 15,
});

describe("dynamic delivery recalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialRouteStatus = RouteStatus.AVAILABLE;
    const records = [existingDelivery()];
    mocks.deliveryFind.mockReturnValue({
      select: () => ({
        sort: () => ({
          lean: () => ({ exec: async () => records }),
        }),
      }),
    });
    mocks.deliveryBulkWrite.mockResolvedValue({ modifiedCount: 1 });
    mocks.loadRouteGraph.mockResolvedValue({
      graph: { hubs: [], routes: [] },
      hubsById: new Map([
        [originHubId.toString(), {}],
        [destinationHubId.toString(), {}],
      ]),
      routesById: new Map(),
    });
    mocks.routeFindById.mockReturnValue({
      exec: async () => routeDocument(),
    });
    mocks.findOptimizedRouteInGraph.mockReturnValue(availableOptimization());
  });

  it("recalculates deliveries and emits the changed traffic condition", async () => {
    const result = await updateRouteTrafficAndRecalculate(routeId.toString(), {
      trafficCondition: TrafficCondition.HIGH,
      trafficMultiplier: 1.8,
    });

    expect(result.route.trafficCondition).toBe(TrafficCondition.HIGH);
    expect(result.deliveries[0]).toMatchObject({
      routeOptimizationStatus: RouteOptimizationStatus.OPTIMIZED,
      currentRoute: [routeId.toString()],
      totalTravelTime: 20,
    });
    expect(mocks.invalidateRouteGraphCache).toHaveBeenCalledOnce();
    expect(mocks.emitRouteTrafficUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: routeId.toString(),
        trafficCondition: TrafficCondition.HIGH,
        trafficMultiplier: 1.8,
      }),
    );
    expect(mocks.deliveryBulkWrite).toHaveBeenCalledOnce();
    expect(mocks.emitDeliveryRouteRecalculated).toHaveBeenCalledOnce();
  });

  it("clears the delivery path when a route is blocked and no alternative exists", async () => {
    mocks.findOptimizedRouteInGraph.mockReturnValue(null);

    const result = await updateRouteStatusAndRecalculate(routeId.toString(), {
      status: RouteStatus.BLOCKED,
    });

    expect(result.deliveries[0]).toMatchObject({
      routeOptimizationStatus: RouteOptimizationStatus.NO_AVAILABLE_PATH,
      currentRoute: [],
      totalDistance: 0,
      totalTravelTime: 0,
    });
    expect(mocks.emitRouteAvailabilityChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: RouteStatus.BLOCKED }),
    );
    expect(mocks.deliveryBulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            update: {
              $set: expect.objectContaining({
                currentRoute: [],
                routeOptimizationStatus:
                  RouteOptimizationStatus.NO_AVAILABLE_PATH,
              }),
            },
          }),
        }),
      ],
      { ordered: true },
    );
  });

  it("restores the optimized path when a route becomes available", async () => {
    initialRouteStatus = RouteStatus.BLOCKED;
    const result = await updateRouteStatusAndRecalculate(routeId.toString(), {
      status: RouteStatus.AVAILABLE,
    });

    expect(result.deliveries[0]).toMatchObject({
      routeOptimizationStatus: RouteOptimizationStatus.OPTIMIZED,
      currentRoute: [routeId.toString()],
    });
    expect(mocks.emitRouteAvailabilityChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: RouteStatus.AVAILABLE }),
    );
    expect(mocks.deliveryBulkWrite).toHaveBeenCalledOnce();
  });

  it("does not persist or publish an invalid path when no alternative exists", async () => {
    mocks.findOptimizedRouteInGraph.mockReturnValue(null);
    const onDeliveryRecalculated = vi.fn();

    const deliveries = await recalculateActiveDeliveries({
      triggeringRouteId: routeId.toString(),
      onDeliveryRecalculated,
    });

    expect(deliveries[0]?.currentRoute).toEqual([]);
    expect(deliveries[0]?.routeOptimizationStatus).toBe(
      RouteOptimizationStatus.NO_AVAILABLE_PATH,
    );
    expect(mocks.deliveryBulkWrite).toHaveBeenCalledOnce();
    expect(onDeliveryRecalculated).toHaveBeenCalledWith(
      expect.objectContaining({
        triggeringRouteId: routeId.toString(),
        routeIds: [],
      }),
    );
  });
});
