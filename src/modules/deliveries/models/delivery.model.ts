import mongoose, { Schema } from "mongoose";
import type { HydratedDocument } from "mongoose";
import { HubModel } from "../../hubs/models/hub.model";
import { RouteModel } from "../../routes/models/route.model";
import {
  DeliveryStatus,
  RouteOptimizationStatus,
} from "../../../shared/types/logistics";
import type { Delivery } from "../../../shared/types/logistics";

const deliverySchema = new Schema<Delivery>(
  {
    originHub: {
      type: Schema.Types.ObjectId,
      ref: "Hub",
      required: true,
    },
    destinationHub: {
      type: Schema.Types.ObjectId,
      ref: "Hub",
      required: true,
    },
    currentRoute: [
      {
        type: Schema.Types.ObjectId,
        ref: "Route",
      },
    ],
    totalDistance: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isFinite,
        message: "totalDistance must be a finite number.",
      },
    },
    totalTravelTime: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isFinite,
        message: "totalTravelTime must be a finite number.",
      },
    },
    totalFuelCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isFinite,
        message: "totalFuelCost must be a finite number.",
      },
    },
    totalCalculatedCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isFinite,
        message: "totalCalculatedCost must be a finite number.",
      },
    },
    status: {
      type: String,
      enum: Object.values(DeliveryStatus),
      required: true,
      default: DeliveryStatus.PLANNED,
    },
    routeOptimizationStatus: {
      type: String,
      enum: Object.values(RouteOptimizationStatus),
      required: true,
      default: RouteOptimizationStatus.OPTIMIZED,
    },
  },
  { timestamps: true },
);

deliverySchema.index({ status: 1, _id: 1 });
deliverySchema.index({ originHub: 1, destinationHub: 1 });

deliverySchema.pre(
  "validate",
  async function (this: HydratedDocument<Delivery>) {
    const [originExists, destinationExists] = await Promise.all([
      HubModel.exists({ _id: this.originHub }),
      HubModel.exists({ _id: this.destinationHub }),
    ]);

    if (!originExists) {
      this.invalidate("originHub", "Referenced origin hub does not exist.");
    }

    if (!destinationExists) {
      this.invalidate(
        "destinationHub",
        "Referenced destination hub does not exist.",
      );
    }

    const routeIds = [
      ...new Set((this.currentRoute ?? []).map((routeId) => routeId.toString())),
    ];

    if (routeIds.length > 0) {
      const existingRouteCount = await RouteModel.countDocuments({
        _id: { $in: routeIds },
      });

      if (existingRouteCount !== routeIds.length) {
        this.invalidate(
          "currentRoute",
          "One or more referenced routes do not exist.",
        );
      }
    }
  },
);

export const DeliveryModel: mongoose.Model<Delivery> =
  mongoose.models.Delivery ?? mongoose.model<Delivery>("Delivery", deliverySchema);

export default DeliveryModel;
