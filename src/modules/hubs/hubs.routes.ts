import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";
import { UserRole } from "../../shared/types/logistics";
import { validateRequest } from "../../middleware/validation.middleware";
import {
  createHubSchemas,
  getHubSchemas,
  listHubsSchemas,
} from "./hubs.validation";
import {
  createHubController,
  getHubController,
  listHubsController,
} from "./controllers/hubs.controller";

const router = Router();

router.use(authMiddleware, roleMiddleware(UserRole.ADMIN));

router.post("/", validateRequest(createHubSchemas), createHubController);
router.get("/", validateRequest(listHubsSchemas), listHubsController);
router.get("/:hubId", validateRequest(getHubSchemas), getHubController);

export default router;
