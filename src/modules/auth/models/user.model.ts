import mongoose, { Schema } from "mongoose";
import { UserRole } from "../../../shared/types/logistics";

export interface User {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
}

const userSchema = new Schema<User>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.OPERATOR,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      select: false,
    },
  },
  { timestamps: true },
);

export const UserModel: mongoose.Model<User> =
  mongoose.models.User ?? mongoose.model<User>("User", userSchema);

export default UserModel;
