import type { PipelineStage } from "mongoose";
import { HubModel } from "../../hubs/models/hub.model";
import { RouteModel } from "../../routes/models/route.model";
import { RouteStatus } from "../../../shared/types/logistics";

export interface FastestRouteAnalytics {
  sourceHub: {
    id: string;
    name: string;
    code: string;
  };
  destinationHub: {
    id: string;
    name: string;
    code: string;
  };
  distance: number;
  travelTime: number;
  effectiveTravelTime: number;
  fuelCost: number;
  trafficCondition: string;
}

interface FastestRouteAggregationResult {
  sourceHub: {
    id: string;
    name: string;
    code: string;
  };
  destinationHub: {
    id: string;
    name: string;
    code: string;
  };
  distance: number;
  travelTime: number;
  effectiveTravelTime: number;
  fuelCost: number;
  trafficCondition: string;
}

export const getFastestRoutes = async (): Promise<FastestRouteAnalytics[]> => {
  const pipeline: PipelineStage[] = [
    { $match: { status: RouteStatus.AVAILABLE } },
    {
      $addFields: {
        effectiveTravelTime: {
          $multiply: ["$travelTime", "$trafficMultiplier"],
        },
      },
    },
    { $sort: { effectiveTravelTime: 1, _id: 1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: HubModel.collection.name,
        localField: "sourceHub",
        foreignField: "_id",
        as: "sourceHub",
      },
    },
    {
      $lookup: {
        from: HubModel.collection.name,
        localField: "destinationHub",
        foreignField: "_id",
        as: "destinationHub",
      },
    },
    { $unwind: "$sourceHub" },
    { $unwind: "$destinationHub" },
    {
      $project: {
        _id: 0,
        sourceHub: {
          id: { $toString: "$sourceHub._id" },
          name: "$sourceHub.name",
          code: "$sourceHub.code",
        },
        destinationHub: {
          id: { $toString: "$destinationHub._id" },
          name: "$destinationHub.name",
          code: "$destinationHub.code",
        },
        distance: 1,
        travelTime: 1,
        effectiveTravelTime: 1,
        fuelCost: 1,
        trafficCondition: 1,
      },
    },
  ];

  const routes =
    await RouteModel.aggregate<FastestRouteAggregationResult>(pipeline).exec();

  return routes.map((route) => ({
    sourceHub: route.sourceHub,
    destinationHub: route.destinationHub,
    distance: route.distance,
    travelTime: route.travelTime,
    effectiveTravelTime: route.effectiveTravelTime,
    fuelCost: route.fuelCost,
    trafficCondition: route.trafficCondition,
  }));
};
