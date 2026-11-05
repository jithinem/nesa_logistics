import mongoose, { Schema } from "mongoose";
import type { Hub } from "../../../shared/types/logistics";

const hubSchema = new Schema<Hub>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    location: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
      },
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true },
);

hubSchema.index({ isActive: 1 });

export const HubModel: mongoose.Model<Hub> =
  mongoose.models.Hub ?? mongoose.model<Hub>("Hub", hubSchema);

export default HubModel;
