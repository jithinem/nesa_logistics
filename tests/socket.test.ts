import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { after, test } from "node:test";
import { io as createSocketClient, type Socket as ClientSocket } from "socket.io-client";
import app from "../src/app";
import {
  closeSocketService,
  initializeSocketService,
} from "../src/sockets/socket";

let client: ClientSocket | undefined;

after(async () => {
  client?.disconnect();
  await closeSocketService();
});

test("Socket.IO rejects a connection with an invalid access token", async () => {
  const httpServer = createServer(app);
  initializeSocketService(httpServer);
  httpServer.listen(0);
  await once(httpServer, "listening");

  const address = httpServer.address();
  assert.ok(address && typeof address !== "string");

  client = createSocketClient(`http://127.0.0.1:${address.port}`, {
    auth: { token: "invalid-token" },
    reconnection: false,
  });

  const connectionError = await new Promise<Error>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Socket connection error was not received.")),
      3000,
    );
    client?.once("connect_error", (error) => {
      clearTimeout(timeout);
      resolve(error);
    });
    client?.once("connect", () => {
      clearTimeout(timeout);
      reject(new Error("Socket connected with an invalid token."));
    });
  });

  assert.equal(connectionError.message, "Authentication is required.");
});
