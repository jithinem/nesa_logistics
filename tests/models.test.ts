import assert from "node:assert/strict";
import { test } from "node:test";
import { DeliveryModel } from "../src/modules/deliveries/models/delivery.model";
import { HubModel } from "../src/modules/hubs/models/hub.model";
import { RouteModel } from "../src/modules/routes/models/route.model";
import { RouteStatus } from "../src/shared/types/logistics";

test("hub schema rejects coordinates outside geographic bounds", () => {
  const hub = new HubModel({
    name: "Central",
    code: "central",
    location: { latitude: 91, longitude: 0 },
  });

  assert.equal(hub.validateSync()?.errors["location.latitude"]?.kind, "max");
  assert.equal(hub.code, "CENTRAL");
  assert.equal(hub.isActive, true);
});

test("route schema rejects negative values and invalid enums", () => {
  const route = new RouteModel({
    sourceHub: "507f1f77bcf86cd799439011",
    destinationHub: "507f1f77bcf86cd799439012",
    distance: -1,
    travelTime: 10,
    fuelCost: 2,
    trafficCondition: "SEVERE",
    trafficMultiplier: 1,
  });

  const validation = route.validateSync();

  assert.equal(validation?.errors.distance?.kind, "min");
  assert.equal(validation?.errors.trafficCondition?.kind, "enum");
  assert.equal(route.status, RouteStatus.AVAILABLE);
});

test("delivery schema rejects negative totals and invalid statuses", () => {
  const delivery = new DeliveryModel({
    originHub: "507f1f77bcf86cd799439011",
    destinationHub: "507f1f77bcf86cd799439012",
    totalDistance: 0,
    totalTravelTime: 0,
    totalFuelCost: -1,
    totalCalculatedCost: 0,
    status: "DELAYED",
  });

  const validation = delivery.validateSync();

  assert.equal(validation?.errors.totalFuelCost?.kind, "min");
  assert.equal(validation?.errors.status?.kind, "enum");
});
