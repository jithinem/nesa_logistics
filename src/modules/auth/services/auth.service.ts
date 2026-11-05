import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { environment } from "../../../config/environment";
import { ApiError } from "../../../utils/ApiError";
import { UserRole } from "../../../shared/types/logistics";
import type { AuthenticatedUser } from "../../../shared/types/logistics";
import { UserModel } from "../models/user.model";
import type { LoginRequest, RegisterRequest } from "../auth.validation";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_LIFETIME,
  ACCESS_TOKEN_LIFETIME_SECONDS,
} from "../token.constants";

const PASSWORD_HASH_ROUNDS = 12;

export interface AuthResult {
  user: AuthenticatedUser;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

const toAuthenticatedUser = (
  user: {
    _id: { toString(): string };
    name: string;
    email: string;
    role: UserRole;
  },
): AuthenticatedUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

const issueAccessToken = (user: AuthenticatedUser): string =>
  jwt.sign(
    { role: user.role },
    environment.jwtSecret,
    {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: ACCESS_TOKEN_LIFETIME,
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    },
  );

const toAuthResult = (user: AuthenticatedUser): AuthResult => ({
  user,
  accessToken: issueAccessToken(user),
  tokenType: "Bearer",
  expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
});

export const registerUser = async (
  request: RegisterRequest,
): Promise<AuthResult> => {
  const passwordHash = await bcrypt.hash(request.password, PASSWORD_HASH_ROUNDS);
  const user = await UserModel.create({
    name: request.name,
    email: request.email,
    passwordHash,
    role: UserRole.OPERATOR,
  });

  return toAuthResult(toAuthenticatedUser(user));
};

export const loginUser = async (
  request: LoginRequest,
): Promise<AuthResult> => {
  const user = await UserModel.findOne({
    email: request.email,
    isActive: true,
  })
    .select("+passwordHash")
    .exec();
  const passwordMatches = user
    ? await bcrypt.compare(request.password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  return toAuthResult(toAuthenticatedUser(user));
};
