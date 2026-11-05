import { z } from "zod";
import { emptyRequestPartSchema } from "../../middleware/validation.middleware";

const mongoObjectIdSchema = (field: string) =>
  z
    .string()
    .regex(
      /^[0-9a-fA-F]{24}$/,
      `${field} must be a valid MongoDB ObjectId.`,
    )
    .transform((value) => value.toLowerCase());

export const routeOptimizationRequestSchemas = {
  body: z
    .object({
      originHub: mongoObjectIdSchema("originHub"),
      destinationHub: mongoObjectIdSchema("destinationHub"),
    })
    .strict(),
  params: emptyRequestPartSchema,
  query: emptyRequestPartSchema,
};

export type RouteOptimizationRequest = z.infer<
  typeof routeOptimizationRequestSchemas.body
>;
