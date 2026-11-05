import { Router } from "express";
import authRouter from "../modules/auth/auth.routes";
import hubsRouter from "../modules/hubs/hubs.routes";
import routesRouter from "../modules/routes/routes.routes";
import deliveriesRouter from "../modules/deliveries/deliveries.routes";
import analyticsRouter from "../modules/analytics/analytics.routes";
import { validateRequest } from "../middleware/validation.middleware";
import { noRequestSchemas } from "../middleware/validation.middleware";
import { ApiResponse } from "../utils/ApiResponse";

const router = Router();

router.get(
  "/health",
  validateRequest(noRequestSchemas),
  (_request, response) => {
    response.status(200).json(ApiResponse.success("Service is healthy."));
  },
);

router.use("/auth", authRouter);
router.use("/hubs", hubsRouter);
router.use("/routes", routesRouter);
router.use("/deliveries", deliveriesRouter);
router.use("/analytics", analyticsRouter);

export default router;
