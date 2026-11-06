import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import mongoose, { Types } from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../../src/app";
import { environment } from "../../src/config/environment";
import { HubModel } from "../../src/modules/hubs/models/hub.model";
import { RouteModel } from "../../src/modules/routes/models/route.model";
import { UserModel } from "../../src/modules/auth/models/user.model";
import { DeliveryModel } from "../../src/modules/deliveries/models/delivery.model";
import {
  closeSocketService,
  initializeSocketService,
} from "../../src/sockets/socket";
import {
  RouteStatus,
  TrafficCondition,
  UserRole,
} from "../../src/shared/types/logistics";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
} from "../../src/modules/auth/token.constants";

const testMongoUri = process.env.MONGODB_TEST_URI;
describe.skipIf(!testMongoUri)("API integration (test MongoDB)", () => {
  let operatorToken: string;
  let originHubId: Types.ObjectId;
  let middleHubId: Types.ObjectId;
  let destinationHubId: Types.ObjectId;
  let routeIds: Types.ObjectId[];
  let userIds: Types.ObjectId[];
  let adminToken: string;
  let additionalHubIds: Types.ObjectId[] = [];
  let additionalRouteIds: Types.ObjectId[] = [];
  let deliveryIds: Types.ObjectId[] = [];

  beforeAll(async () => {
    if (!testMongoUri) {
      return;
    }

    const databaseName = new URL(testMongoUri).pathname.slice(1);
    if (!databaseName.toLowerCase().endsWith("_test")) {
      throw new Error(
        "MONGODB_TEST_URI must point to a database whose name ends with _test.",
      );
    }

    await mongoose.connect(testMongoUri);
    initializeSocketService(createServer(app));
    originHubId = new Types.ObjectId();
    middleHubId = new Types.ObjectId();
    destinationHubId = new Types.ObjectId();
    routeIds = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ];

    await HubModel.create([
      {
        _id: originHubId,
        name: "Integration Origin",
        code: `IT${originHubId.toString().slice(-8)}A`,
        location: { latitude: 10, longitude: 10 },
        isActive: true,
      },
      {
        _id: middleHubId,
        name: "Integration Middle",
        code: `IT${middleHubId.toString().slice(-8)}B`,
        location: { latitude: 11, longitude: 11 },
        isActive: true,
      },
      {
        _id: destinationHubId,
        name: "Integration Destination",
        code: `IT${destinationHubId.toString().slice(-8)}C`,
        location: { latitude: 12, longitude: 12 },
        isActive: true,
      },
    ]);

    await RouteModel.create([
      {
        _id: routeIds[0],
        sourceHub: originHubId,
        destinationHub: middleHubId,
        distance: 10,
        travelTime: 10,
        fuelCost: 5,
        trafficCondition: TrafficCondition.LOW,
        trafficMultiplier: 1,
        status: RouteStatus.AVAILABLE,
      },
      {
        _id: routeIds[1],
        sourceHub: middleHubId,
        destinationHub: destinationHubId,
        distance: 10,
        travelTime: 10,
        fuelCost: 5,
        trafficCondition: TrafficCondition.LOW,
        trafficMultiplier: 1,
        status: RouteStatus.AVAILABLE,
      },
      {
        _id: routeIds[2],
        sourceHub: destinationHubId,
        destinationHub: originHubId,
        distance: 15,
        travelTime: 15,
        fuelCost: 8,
        trafficCondition: TrafficCondition.MEDIUM,
        trafficMultiplier: 1.2,
        status: RouteStatus.AVAILABLE,
      },
    ]);

    const operator = await UserModel.create({
      name: "Integration Operator",
      email: `operator-${originHubId.toString()}@example.test`,
      passwordHash: "not-used-by-token-tests",
      role: UserRole.OPERATOR,
    });
    const admin = await UserModel.create({
      name: "Integration Admin",
      email: `admin-${originHubId.toString()}@example.test`,
      passwordHash: "not-used-by-token-tests",
      role: UserRole.ADMIN,
    });
    userIds = [operator._id, admin._id];
    operatorToken = createToken(operator._id, UserRole.OPERATOR);
    adminToken = createToken(admin._id, UserRole.ADMIN);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (deliveryIds.length) {
        await DeliveryModel.deleteMany({ _id: { $in: deliveryIds } });
      }
      if (additionalRouteIds.length) {
        await RouteModel.deleteMany({ _id: { $in: additionalRouteIds } });
      }
      if (routeIds?.length) {
        await RouteModel.deleteMany({ _id: { $in: routeIds } });
      }
      if (additionalHubIds.length) {
        await HubModel.deleteMany({ _id: { $in: additionalHubIds } });
      }
      if (originHubId && middleHubId && destinationHubId) {
        await HubModel.deleteMany({
          _id: { $in: [originHubId, middleHubId, destinationHubId] },
        });
      }
      if (userIds?.length) {
        await UserModel.deleteMany({ _id: { $in: userIds } });
      }
      await closeSocketService();
      await mongoose.disconnect();
    }
  });

  const tokenHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  it("optimizes a route using the test database graph", async () => {
    const response = await request(app)
      .post("/api/routes/optimize")
      .set(tokenHeader(operatorToken))
      .send({
        originHub: originHubId.toString(),
        destinationHub: destinationHubId.toString(),
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Route optimized successfully",
      data: {
        hubs: [
          { id: originHubId.toString() },
          { id: middleHubId.toString() },
          { id: destinationHubId.toString() },
        ],
        routes: [{ id: routeIds[0].toString() }, { id: routeIds[1].toString() }],
        totalDistance: 20,
        totalTravelTime: 20,
        totalFuelCost: 10,
      },
    });
  });

  it("returns a validation error for malformed hub identifiers", async () => {
    const response = await request(app)
      .post("/api/routes/optimize")
      .set(tokenHeader(operatorToken))
      .send({
        originHub: "not-an-object-id",
        destinationHub: destinationHubId.toString(),
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("rejects unauthenticated route optimization requests", async () => {
    const response = await request(app).post("/api/routes/optimize").send({
      originHub: originHubId.toString(),
      destinationHub: destinationHubId.toString(),
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication is required.");
  });

  it("forbids an operator from changing route status", async () => {
    const response = await request(app)
      .patch(`/api/routes/${routeIds[0].toString()}/status`)
      .set(tokenHeader(operatorToken))
      .send({ status: RouteStatus.BLOCKED });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to perform this action.",
    );
  });

  it("returns fastest available routes from MongoDB aggregation", async () => {
    const response = await request(app)
      .get("/api/analytics/fastest-routes")
      .set(tokenHeader(operatorToken));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.length).toBeLessThanOrEqual(5);
    expect(response.body.data[0]).toMatchObject({
      sourceHub: { id: expect.any(String), name: expect.any(String) },
      destinationHub: { id: expect.any(String), name: expect.any(String) },
      effectiveTravelTime: expect.any(Number),
    });
    expect(response.body.data).toEqual(
      [...response.body.data].sort(
        (left: { effectiveTravelTime: number }, right: { effectiveTravelTime: number }) =>
          left.effectiveTravelTime - right.effectiveTravelTime,
      ),
    );
  });

  it("returns the cycle through the integration hubs", async () => {
    const response = await request(app)
      .get("/api/routes/cycles")
      .set(tokenHeader(operatorToken));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.hasCycle).toBe(true);
    const cycle = response.body.data.cycles.find(
      (candidate: { hubs: string[]; routes: string[] }) =>
        candidate.hubs.length === 4 &&
        candidate.hubs[0] === candidate.hubs[3] &&
        new Set(candidate.hubs.slice(0, -1)).size === 3 &&
        new Set(candidate.hubs.slice(0, -1)).has(originHubId.toString()),
    );
    expect(cycle).toBeDefined();
    expect([...cycle.hubs.slice(0, -1)].sort()).toEqual(
      [
        originHubId.toString(),
        middleHubId.toString(),
        destinationHubId.toString(),
      ].sort(),
    );
    expect([...cycle.routes].sort()).toEqual(
      routeIds.map((id) => id.toString()).sort(),
    );
  });

  it("creates, paginates, and retrieves hubs for admins", async () => {
    const created = await request(app)
      .post("/api/hubs")
      .set(tokenHeader(adminToken))
      .send({
        name: "Integration API Hub",
        code: `API${new Types.ObjectId().toString().slice(-8)}`,
        location: { latitude: 35, longitude: -80 },
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: "Integration API Hub",
      isActive: true,
    });
    const hubId = new Types.ObjectId(created.body.data._id);
    additionalHubIds.push(hubId);

    const page = await request(app)
      .get("/api/hubs?page=1&limit=1")
      .set(tokenHeader(adminToken));
    expect(page.status).toBe(200);
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.pagination).toMatchObject({
      page: 1,
      limit: 1,
    });

    const found = await request(app)
      .get(`/api/hubs/${hubId.toString()}`)
      .set(tokenHeader(adminToken));
    expect(found.status).toBe(200);
    expect(found.body.data._id).toBe(hubId.toString());
  });

  it("creates and lists routes, and retains the admin-only status update", async () => {
    const created = await request(app)
      .post("/api/routes")
      .set(tokenHeader(adminToken))
      .send({
        sourceHub: originHubId.toString(),
        destinationHub: destinationHubId.toString(),
        distance: 5,
        travelTime: 8,
        fuelCost: 3,
        trafficCondition: TrafficCondition.LOW,
        trafficMultiplier: 1,
      });

    expect(created.status).toBe(201);
    const routeId = new Types.ObjectId(created.body.data._id);
    additionalRouteIds.push(routeId);

    const page = await request(app)
      .get("/api/routes?page=1&limit=1")
      .set(tokenHeader(operatorToken));
    expect(page.status).toBe(200);
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.items[0].sourceHub).toMatchObject({
      name: expect.any(String),
      code: expect.any(String),
    });
    expect(page.body.data.items[0].destinationHub).toMatchObject({
      name: expect.any(String),
      code: expect.any(String),
    });
    expect(page.body.data.pagination.totalItems).toBeGreaterThanOrEqual(4);

    const blocked = await request(app)
      .patch(`/api/routes/${routeId.toString()}/status`)
      .set(tokenHeader(adminToken))
      .send({ status: RouteStatus.BLOCKED });
    expect(blocked.status).toBe(200);
    expect(blocked.body.data.route.status).toBe(RouteStatus.BLOCKED);

    const available = await request(app)
      .patch(`/api/routes/${routeId.toString()}/status`)
      .set(tokenHeader(adminToken))
      .send({ status: RouteStatus.AVAILABLE });
    expect(available.status).toBe(200);
    expect(available.body.data.route.status).toBe(RouteStatus.AVAILABLE);
  });

  it("creates, paginates, and retrieves deliveries for authenticated users", async () => {
    const created = await request(app)
      .post("/api/deliveries")
      .set(tokenHeader(operatorToken))
      .send({
        originHub: originHubId.toString(),
        destinationHub: destinationHubId.toString(),
      });

    expect(created.status).toBe(201);
    expect(created.body.data.routeOptimizationStatus).toBe("OPTIMIZED");
    expect(created.body.data.currentRoute.length).toBeGreaterThan(0);
    const deliveryId = new Types.ObjectId(created.body.data._id);
    deliveryIds.push(deliveryId);

    const page = await request(app)
      .get("/api/deliveries?page=1&limit=1")
      .set(tokenHeader(operatorToken));
    expect(page.status).toBe(200);
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.items[0].originHub).toMatchObject({
      name: expect.any(String),
      code: expect.any(String),
    });
    expect(page.body.data.items[0].destinationHub).toMatchObject({
      name: expect.any(String),
      code: expect.any(String),
    });
    expect(page.body.data.items[0].currentRoute[0].sourceHub).toMatchObject({
      name: expect.any(String),
      code: expect.any(String),
    });
    expect(page.body.data.pagination).toMatchObject({
      page: 1,
      limit: 1,
    });
    expect(page.body.data.pagination.totalItems).toBeGreaterThanOrEqual(1);

    const found = await request(app)
      .get(`/api/deliveries/${deliveryId.toString()}`)
      .set(tokenHeader(operatorToken));
    expect(found.status).toBe(200);
    expect(found.body.data._id).toBe(deliveryId.toString());
    expect(found.body.data.originHub).toMatchObject({
      name: "Integration Origin",
      code: expect.any(String),
    });
    expect(found.body.data.destinationHub).toMatchObject({
      name: "Integration Destination",
      code: expect.any(String),
    });
    expect(found.body.data.currentRoute[0].destinationHub).toMatchObject({
      name: expect.any(String),
      code: expect.any(String),
    });
  });
});

function createToken(userId: Types.ObjectId, role: UserRole): string {
  return jwt.sign(
    { role },
    environment.jwtSecret,
    {
      algorithm: "HS256",
      subject: userId.toString(),
      expiresIn: "5m",
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    },
  );
}
