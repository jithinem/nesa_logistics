import mongoose, { Schema } from "mongoose";
import type { HydratedDocument } from "mongoose";
import { HubModel } from "../../hubs/models/hub.model";
import {
  RouteStatus,
  TrafficCondition,
} from "../../../shared/types/logistics";
import type { Route } from "../../../shared/types/logistics";

const routeSchema = new Schema<Route>(
  {
    sourceHub: {
      type: Schema.Types.ObjectId,
      ref: "Hub",
      required: true,
    },
    destinationHub: {
      type: Schema.Types.ObjectId,
      ref: "Hub",
      required: true,
    },
    distance: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "distance must be a finite number.",
      },
    },
    travelTime: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "travelTime must be a finite number.",
      },
    },
    fuelCost: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "fuelCost must be a finite number.",
      },
    },
    trafficCondition: {
      type: String,
      enum: Object.values(TrafficCondition),
      required: true,
    },
    trafficMultiplier: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "trafficMultiplier must be a finite number.",
      },
    },
    status: {
      type: String,
      enum: Object.values(RouteStatus),
      required: true,
      default: RouteStatus.AVAILABLE,
    },
  },
  { timestamps: true },
);

routeSchema.index({ sourceHub: 1, destinationHub: 1 });
routeSchema.index({ status: 1, sourceHub: 1, destinationHub: 1 });

routeSchema.pre(
  "validate",
  async function (this: HydratedDocument<Route>) {
    const [sourceExists, destinationExists] = await Promise.all([
      HubModel.exists({ _id: this.sourceHub }),
      HubModel.exists({ _id: this.destinationHub }),
    ]);

    if (!sourceExists) {
      this.invalidate("sourceHub", "Referenced source hub does not exist.");
    }

    if (!destinationExists) {
      this.invalidate(
        "destinationHub",
        "Referenced destination hub does not exist.",
      );
    }
  },
);

export const RouteModel: mongoose.Model<Route> =
  mongoose.models.Route ?? mongoose.model<Route>("Route", routeSchema);

export default RouteModel;
