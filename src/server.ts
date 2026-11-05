import { createServer } from "node:http";
import mongoose from "mongoose";
import app from "./app";
import { connectDatabase } from "./config/database";
import { environment } from "./config/environment";
import {
  closeSocketService,
  initializeSocketService,
} from "./sockets/socket";

const startServer = async (): Promise<void> => {
  let shutdownPromise: Promise<void> | undefined;
  let shuttingDown = false;
  const shutdown = (reason: string, exitCode: number): Promise<void> => {
    shuttingDown = true;
    if (shutdownPromise) {
      return shutdownPromise;
    }

    console.info(`Shutting down server (${reason}).`);
    process.exitCode = exitCode;
    const forceExitTimer = setTimeout(() => {
      console.error("Graceful shutdown timed out.");
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    shutdownPromise = closeSocketService()
      .then(() => mongoose.disconnect())
      .then(() => {
        clearTimeout(forceExitTimer);
      })
      .catch((error: unknown) => {
        clearTimeout(forceExitTimer);
        console.error("Failed to shut down server cleanly.", error);
        process.exitCode = 1;
      });

    return shutdownPromise;
  };

  process.once("SIGINT", () => void shutdown("SIGINT", 0));
  process.once("SIGTERM", () => void shutdown("SIGTERM", 0));
  process.on("uncaughtException", (error: Error) => {
    console.error("Uncaught exception.", error);
    void shutdown("uncaught exception", 1);
  });
  process.on("unhandledRejection", (reason: unknown) => {
    console.error("Unhandled promise rejection.", reason);
    void shutdown("unhandled rejection", 1);
  });

  try {
    await connectDatabase();
    if (shuttingDown) {
      await mongoose.disconnect();
      return;
    }

    const httpServer = createServer(app);
    initializeSocketService(httpServer);
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => reject(error);
      httpServer.once("error", onError);
      httpServer.listen(environment.port, () => {
        httpServer.off("error", onError);
        resolve();
      });
    });
    httpServer.on("error", (error: Error) => {
      console.error("HTTP server error.", error);
      void shutdown("HTTP server error", 1);
    });
    console.info(`Server listening on port ${environment.port}.`);
  } catch (error: unknown) {
    console.error("Failed to start server.", error);
    await closeSocketService().catch((shutdownError: unknown) => {
      console.error(
        "Failed to close Socket.IO after startup failure.",
        shutdownError,
      );
    });
    await mongoose.disconnect().catch((shutdownError: unknown) => {
      console.error("Failed to close MongoDB after startup failure.", shutdownError);
    });
    process.exitCode = 1;
  }
};

void startServer();
