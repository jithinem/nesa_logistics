import jwt, { type JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import { environment } from "../../../config/environment";
import { UserModel } from "../models/user.model";
import { tokenVerificationOptions } from "../token.constants";
import { UserRole } from "../../../shared/types/logistics";
import type { AuthenticatedUser } from "../../../shared/types/logistics";

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
}

const isUserRole = (role: unknown): role is UserRole =>
  typeof role === "string" && Object.values(UserRole).includes(role as UserRole);

const isAccessTokenPayload = (
  payload: string | JwtPayload,
): payload is JwtPayload & { sub: string; role: UserRole } =>
  typeof payload !== "string" &&
  typeof payload.sub === "string" &&
  /^[0-9a-fA-F]{24}$/.test(payload.sub) &&
  isUserRole(payload.role) &&
  typeof payload.exp === "number" &&
  typeof payload.iat === "number";

export const verifyAccessToken = (token: string): AccessTokenClaims | null => {
  let payload: string | JwtPayload;

  try {
    payload = jwt.verify(token, environment.jwtSecret, tokenVerificationOptions);
  } catch {
    return null;
  }

  if (!isAccessTokenPayload(payload)) {
    return null;
  }

  return { sub: payload.sub, role: payload.role };
};

export const findAuthenticatedUser = async (
  claims: AccessTokenClaims,
): Promise<AuthenticatedUser | null> => {
  const user = await UserModel.findOne({
    _id: new Types.ObjectId(claims.sub),
    isActive: true,
    role: claims.role,
  })
    .select("_id name email role")
    .exec();

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
};
