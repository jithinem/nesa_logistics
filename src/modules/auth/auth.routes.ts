import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateRequest } from "../../middleware/validation.middleware";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  loginRequestSchemas,
  registerRequestSchemas,
} from "./auth.validation";
import { loginController, registerController } from "./controllers/auth.controller";

const router = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_request, response) => {
    response
      .status(429)
      .json(
        ApiResponse.failure(
          "Too many authentication attempts. Try again later.",
        ),
      );
  },
});

router.use(authRateLimiter);
router.post(
  "/register",
  validateRequest(registerRequestSchemas),
  registerController,
);
router.post("/login", validateRequest(loginRequestSchemas), loginController);

export default router;
