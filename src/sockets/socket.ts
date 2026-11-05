import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import { environment } from "../config/environment";
import {
  findAuthenticatedUser,
  verifyAccessToken,
} from "../modules/auth/services/token.service";
import type {
  AuthenticatedUser,
  DeliveryStatus,
  RouteOptimizationStatus,
  RouteStatus,
  TrafficCondition,
} from "../shared/types/logistics";

export interface RouteTrafficUpdatedEvent {
  routeId: string;
  trafficCondition: TrafficCondition;
  trafficMultiplier: number;
  status: RouteStatus;
  updatedAt: string;
}

export interface RouteAvailabilityEvent {
  routeId: string;
  status: RouteStatus;
  trafficCondition: TrafficCondition;
  trafficMultiplier: number;
  updatedAt: string;
}

export interface DeliveryRouteRecalculatedEvent {
  triggeringRouteId: string | null;
  routeIds: string[];
  delivery: {
    id: string;
    status: DeliveryStatus;
    routeOptimizationStatus: RouteOptimizationStatus;
    currentRoute: string[];
    totalDistance: number;
    totalTravelTime: number;
    totalFuelCost: number;
    totalCalculatedCost: number;
  };
}

interface ClientToServerEvents {}

interface ServerToClientEvents {
  "route:traffic-updated": (event: RouteTrafficUpdatedEvent) => void;
  "route:blocked": (event: RouteAvailabilityEvent) => void;
  "route:available": (event: RouteAvailabilityEvent) => void;
  "delivery:route-recalculated": (
    event: DeliveryRouteRecalculatedEvent,
  ) => void;
}

interface InterServerEvents {}

interface SocketData {
  user: AuthenticatedUser;
}

type SocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let socketServer: SocketServer | undefined;

const getHandshakeToken = (socket: AuthenticatedSocket): string | null => {
  const handshakeToken: unknown = socket.handshake.auth.token;
  if (typeof handshakeToken === "string" && handshakeToken.length > 0) {
    return handshakeToken;
  }

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);
  return bearerMatch?.[1] ?? null;
};

const authenticateSocket = async (
  socket: AuthenticatedSocket,
): Promise<AuthenticatedUser | null> => {
  const token = getHandshakeToken(socket);
  if (!token) {
    return null;
  }

  const claims = verifyAccessToken(token);
  return claims ? findAuthenticatedUser(claims) : null;
};

export const initializeSocketService = (httpServer: HttpServer): SocketServer => {
  if (socketServer) {
    throw new Error("Socket service has already been initialized.");
  }

  const origins = environment.corsOrigins;
  const io: SocketServer = new Server(httpServer, {
    cors: {
      origin: origins.includes("*") ? "*" : origins,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    void authenticateSocket(socket)
      .then((user) => {
        if (!user) {
          next(new Error("Authentication is required."));
          return;
        }

        socket.data.user = user;
        next();
      })
      .catch(next);
  });

  socketServer = io;
  return io;
};

export const emitRouteTrafficUpdated = (
  event: RouteTrafficUpdatedEvent,
): void => {
  if (!socketServer) {
    throw new Error("Socket service has not been initialized.");
  }

  socketServer.emit("route:traffic-updated", event);
};

export const emitRouteAvailabilityChanged = (
  event: RouteAvailabilityEvent,
): void => {
  if (!socketServer) {
    throw new Error("Socket service has not been initialized.");
  }

  socketServer.emit(
    event.status === "BLOCKED" ? "route:blocked" : "route:available",
    event,
  );
};

export const emitDeliveryRouteRecalculated = (
  event: DeliveryRouteRecalculatedEvent,
): void => {
  if (!socketServer) {
    throw new Error("Socket service has not been initialized.");
  }

  socketServer.emit("delivery:route-recalculated", event);
};

export const closeSocketService = async (): Promise<void> => {
  const io = socketServer;
  socketServer = undefined;

  if (!io) {
    return;
  }

  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });
};
