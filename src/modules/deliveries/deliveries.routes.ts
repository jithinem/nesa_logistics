import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";
import { UserRole } from "../../shared/types/logistics";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  createDeliverySchemas,
  getDeliverySchemas,
  listDeliveriesSchemas,
} from "./deliveries.validation";
import {
  createDeliveryController,
  getDeliveryController,
  listDeliveriesController,
} from "./controllers/deliveries.controller";

const router = Router();

router.use(
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.OPERATOR),
);

router.post("/", validateRequest(createDeliverySchemas), createDeliveryController);
router.get("/", validateRequest(listDeliveriesSchemas), listDeliveriesController);
router.get(
  "/:deliveryId",
  validateRequest(getDeliverySchemas),
  getDeliveryController,
);

export default router;
