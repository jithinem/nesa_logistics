import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { environment } from "./config/environment";
import { errorMiddleware } from "./middleware/error.middleware";
import { ApiError } from "./utils/ApiError";
import apiRouter from "./routes";
import routeRouter from "./modules/routes/routes.routes";
import analyticsRouter from "./modules/analytics/analytics.routes";
import authRouter from "./modules/auth/auth.routes";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", environment.trustProxy);
app.use(helmet());
app.use(
  cors({
    origin:
      environment.corsOrigins.includes("*")
        ? "*"
        : environment.corsOrigins,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.status(200).json({ success: true, status: "live" });
});
app.get("/health/ready", (_request, response) => {
  const ready = mongoose.connection.readyState === 1;
  response.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? "ready" : "not_ready",
  });
});
app.get("/health/live", (_request, response) => {
  response.status(200).json({ success: true, status: "live" });
});

app.use("/api/routes", routeRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/auth", authRouter);
app.use("/api/v1", apiRouter);
app.use((_request, _response, next) => {
  next(new ApiError(404, "Resource not found."));
});
app.use(errorMiddleware);

export default app;
