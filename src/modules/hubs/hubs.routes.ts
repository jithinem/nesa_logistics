import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";
import { UserRole } from "../../shared/types/logistics";

const router = Router();

router.use(authMiddleware, roleMiddleware(UserRole.ADMIN));

export default router;
