import { HubModel } from "../../hubs/models/hub.model";
import { RouteModel } from "../models/route.model";
import {
  detectCycles,
  type CycleDetectionGraph,
} from "../../../algorithms/cycle-detection.algorithm";

export interface RouteCycleResponse {
  hasCycle: boolean;
  cycles: Array<{
    hubs: string[];
    routes: string[];
  }>;
  affectedHubs: Array<{
    id: string;
    name: string;
    code: string;
  }>;
}

export const getRouteCycles = async (): Promise<RouteCycleResponse> => {
  const hubs = await HubModel.find({ isActive: true })
    .select("_id name code")
    .sort({ _id: 1 })
    .lean()
    .exec();
  const activeHubIds = hubs.map((hub) => hub._id);
  const routes = await RouteModel.find({
    sourceHub: { $in: activeHubIds },
    destinationHub: { $in: activeHubIds },
  })
    .select("_id sourceHub destinationHub")
    .sort({ _id: 1 })
    .lean()
    .exec();

  const graph: CycleDetectionGraph = {
    hubs: hubs.map((hub) => ({ id: hub._id.toString() })),
    routes: routes.map((route) => ({
      id: route._id.toString(),
      sourceHubId: route.sourceHub.toString(),
      destinationHubId: route.destinationHub.toString(),
    })),
  };
  const result = detectCycles(graph);
  const hubsById = new Map(hubs.map((hub) => [hub._id.toString(), hub]));

  return {
    hasCycle: result.hasCycle,
    cycles: result.cycles,
    affectedHubs: result.affectedHubs.map((hubId) => {
      const hub = hubsById.get(hubId);

      if (!hub) {
        throw new Error(`Detected cycle references unknown hub "${hubId}".`);
      }

      return {
        id: hub._id.toString(),
        name: hub.name,
        code: hub.code,
      };
    }),
  };
};
