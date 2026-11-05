import { z } from "zod";
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

export const createDeliverySchemas = {
  body: z
    .object({
      originHub: objectIdSchema("originHub"),
      destinationHub: objectIdSchema("destinationHub"),
    })
    .strict(),
  params: emptyRequestPartSchema,
  query: emptyRequestPartSchema,
};

export const listDeliveriesSchemas = {
  body: noRequestBodySchema,
  params: emptyRequestPartSchema,
  query: paginationQuerySchema,
};

export const getDeliverySchemas = {
  body: noRequestBodySchema,
  params: z
    .object({ deliveryId: objectIdSchema("deliveryId") })
    .strict(),
  query: emptyRequestPartSchema,
};

export type CreateDeliveryRequest = z.infer<typeof createDeliverySchemas.body>;
export type ListDeliveriesQuery = z.infer<typeof paginationQuerySchema>;
export type DeliveryIdParams = z.infer<typeof getDeliverySchemas.params>;
