import { z } from "zod";
import {
  RouteStatus,
  TrafficCondition,
} from "../../shared/types/logistics";
import {
  emptyRequestPartSchema,
  noRequestBodySchema,
} from "../../middleware/validation.middleware";

const objectIdSchema = (name: string) =>
  z
    .string()
    .regex(
      /^[0-9a-fA-F]{24}$/,
      `${name} must be a valid MongoDB ObjectId.`,
    )
    .transform((value) => value.toLowerCase());

const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const createRouteSchemas = {
  body: z
    .object({
      sourceHub: objectIdSchema("sourceHub"),
      destinationHub: objectIdSchema("destinationHub"),
      distance: z.number().finite().nonnegative(),
      travelTime: z.number().finite().nonnegative(),
      fuelCost: z.number().finite().nonnegative(),
      trafficCondition: z.nativeEnum(TrafficCondition),
      trafficMultiplier: z.number().finite().positive(),
      status: z.nativeEnum(RouteStatus).optional(),
    })
    .strict()
    .refine((route) => route.sourceHub !== route.destinationHub, {
      message: "sourceHub and destinationHub must be different.",
    }),
  params: emptyRequestPartSchema,
  query: emptyRequestPartSchema,
};

export const listRoutesSchemas = {
  body: noRequestBodySchema,
  params: emptyRequestPartSchema,
  query: paginationQuerySchema,
};

export type CreateRouteRequest = z.infer<typeof createRouteSchemas.body>;
export type ListRoutesQuery = z.infer<typeof paginationQuerySchema>;
