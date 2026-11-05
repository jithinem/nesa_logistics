import { z } from "zod";
import {
  emptyRequestPartSchema,
  noRequestBodySchema,
} from "../../middleware/validation.middleware";

const objectIdSchema = (name: string) =>
  z
    .string()
    .regex(new RegExp("^[0-9a-fA-F]{24}$"), `${name} must be a valid MongoDB ObjectId.`)
    .transform((value) => value.toLowerCase());

const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const createHubSchemas = {
  body: z
    .object({
      name: z.string().trim().min(2).max(120),
      code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/),
      location: z
        .object({
          latitude: z.number().finite().min(-90).max(90),
          longitude: z.number().finite().min(-180).max(180),
        })
        .strict(),
      isActive: z.boolean().optional(),
    })
    .strict(),
  params: emptyRequestPartSchema,
  query: emptyRequestPartSchema,
};

export const listHubsSchemas = {
  body: noRequestBodySchema,
  params: emptyRequestPartSchema,
  query: paginationQuerySchema,
};

export const getHubSchemas = {
  body: noRequestBodySchema,
  params: z.object({ hubId: objectIdSchema("hubId") }).strict(),
  query: emptyRequestPartSchema,
};

export type CreateHubRequest = z.infer<typeof createHubSchemas.body>;
export type ListHubsQuery = z.infer<typeof paginationQuerySchema>;
export type HubIdParams = z.infer<typeof getHubSchemas.params>;
