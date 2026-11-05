import { Router } from "express";
import { optimizeRouteController } from "./controllers/route-optimization.controller";
import { validateRequest } from "../../middleware/validation.middleware";
import { routeOptimizationRequestSchemas } from "./routes.validation";
import {
  updateRouteStatusController,
  updateRouteTrafficController,
} from "./controllers/route-recalculation.controller";
import {
  routeStatusUpdateSchemas,
  trafficUpdateSchemas,
} from "./route-recalculation.validation";
import { getRouteCyclesController } from "./controllers/route-cycle.controller";
import { noRequestSchemas } from "../../middleware/validation.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";
import { UserRole } from "../../shared/types/logistics";

const router = Router();

router.get(
  "/cycles",
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.OPERATOR),
  validateRequest(noRequestSchemas),
  getRouteCyclesController,
);
router.post(
  "/optimize",
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.OPERATOR),
  validateRequest(routeOptimizationRequestSchemas),
  optimizeRouteController,
);
router.patch(
  "/:routeId/traffic",
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  validateRequest(trafficUpdateSchemas),
  updateRouteTrafficController,
);
router.patch(
  "/:routeId/status",
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  validateRequest(routeStatusUpdateSchemas),
  updateRouteStatusController,
);

export default router;
