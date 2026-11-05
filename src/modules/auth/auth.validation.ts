import { z } from "zod";
import { emptyRequestPartSchema } from "../../middleware/validation.middleware";

const passwordSchema = z
  .string()
  .min(12, "password must be at least 12 characters.")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "password must not exceed 72 UTF-8 bytes.",
  );

export const registerRequestSchemas = {
  body: z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
      password: passwordSchema,
    })
    .strict(),
  params: emptyRequestPartSchema,
  query: emptyRequestPartSchema,
};

export const loginRequestSchemas = {
  body: z
    .object({
      email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
      password: z.string().min(1).max(72),
    })
    .strict(),
  params: emptyRequestPartSchema,
  query: emptyRequestPartSchema,
};

export type RegisterRequest = z.infer<typeof registerRequestSchemas.body>;
export type LoginRequest = z.infer<typeof loginRequestSchemas.body>;
