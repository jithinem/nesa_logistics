import { z } from "zod";
import {
  RouteStatus,
  TrafficCondition,
} from "../../shared/types/logistics";
import { emptyRequestPartSchema } from "../../middleware/validation.middleware";

const routeParamsSchema = z.object({
  routeId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "routeId must be a valid MongoDB ObjectId.")
    .transform((value) => value.toLowerCase()),
}).strict();

export const trafficUpdateSchemas = {
  body: z
    .object({
      trafficCondition: z.nativeEnum(TrafficCondition, {
        error: "trafficCondition must be LOW, MEDIUM, or HIGH.",
      }),
      trafficMultiplier: z
        .number()
        .finite("trafficMultiplier must be a finite number greater than zero.")
        .positive(
          "trafficMultiplier must be a finite number greater than zero.",
        ),
    })
    .strict(),
  params: routeParamsSchema,
  query: emptyRequestPartSchema,
};

export const routeStatusUpdateSchemas = {
  body: z
    .object({
      status: z.nativeEnum(RouteStatus, {
        error: "status must be AVAILABLE or BLOCKED.",
      }),
    })
    .strict(),
  params: routeParamsSchema,
  query: emptyRequestPartSchema,
};

export type TrafficUpdateRequest = z.infer<typeof trafficUpdateSchemas.body>;
export type RouteStatusUpdateRequest = z.infer<
  typeof routeStatusUpdateSchemas.body
>;
export type RouteIdParams = z.infer<typeof routeParamsSchema>;
