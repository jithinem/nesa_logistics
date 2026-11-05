import { Router } from "express";
import { validateRequest } from "../../middleware/validation.middleware";
import { noRequestSchemas } from "../../middleware/validation.middleware";
import { getFastestRoutesController } from "./controllers/fastest-routes.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";
import { UserRole } from "../../shared/types/logistics";

const router = Router();

router.get(
  "/fastest-routes",
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.OPERATOR),
  validateRequest(noRequestSchemas),
  getFastestRoutesController,
);

export default router;
