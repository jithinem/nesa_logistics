import type { Types } from "mongoose";

export enum TrafficCondition {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum RouteStatus {
  AVAILABLE = "AVAILABLE",
  BLOCKED = "BLOCKED",
}

export enum DeliveryStatus {
  PLANNED = "PLANNED",
  IN_TRANSIT = "IN_TRANSIT",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum UserRole {
  ADMIN = "ADMIN",
  OPERATOR = "OPERATOR",
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export enum RouteOptimizationStatus {
  OPTIMIZED = "OPTIMIZED",
  NO_AVAILABLE_PATH = "NO_AVAILABLE_PATH",
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface Hub {
  name: string;
  code: string;
  location: LocationCoordinates;
  isActive: boolean;
}

export interface Route {
  sourceHub: Types.ObjectId;
  destinationHub: Types.ObjectId;
  distance: number;
  travelTime: number;
  fuelCost: number;
  trafficCondition: TrafficCondition;
  trafficMultiplier: number;
  status: RouteStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Delivery {
  originHub: Types.ObjectId;
  destinationHub: Types.ObjectId;
  currentRoute: Types.ObjectId[];
  totalDistance: number;
  totalTravelTime: number;
  totalFuelCost: number;
  totalCalculatedCost: number;
  status: DeliveryStatus;
  routeOptimizationStatus: RouteOptimizationStatus;
}
