import { z } from "zod";
import { UserRole } from "../shared/types/logistics";

const seedUserCredentialsSchema = z
  .object({
    SEED_ADMIN_EMAIL: z.string().trim().email().max(254),
    SEED_ADMIN_PASSWORD: z
      .string()
      .min(12)
      .refine((password) => Buffer.byteLength(password, "utf8") <= 72),
    SEED_OPERATOR_EMAIL: z.string().trim().email().max(254),
    SEED_OPERATOR_PASSWORD: z
      .string()
      .min(12)
      .refine((password) => Buffer.byteLength(password, "utf8") <= 72),
  })
  .refine(
    (credentials) =>
      credentials.SEED_ADMIN_EMAIL.toLowerCase() !==
      credentials.SEED_OPERATOR_EMAIL.toLowerCase(),
    {
      message: "Seed admin and operator emails must be different.",
    },
  );

export interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export const getSeedUsers = (
  environment: Record<string, string | undefined>,
): SeedUser[] => {
  const credentials = seedUserCredentialsSchema.safeParse({
    SEED_ADMIN_EMAIL: environment.SEED_ADMIN_EMAIL ?? "admin@nesa.local",
    SEED_ADMIN_PASSWORD: environment.SEED_ADMIN_PASSWORD,
    SEED_OPERATOR_EMAIL: environment.SEED_OPERATOR_EMAIL ?? "operator@nesa.local",
    SEED_OPERATOR_PASSWORD: environment.SEED_OPERATOR_PASSWORD,
  });

  if (!credentials.success) {
    throw new Error(
      "Seed users require valid SEED_ADMIN_EMAIL/SEED_OPERATOR_EMAIL values (emails must differ) and SEED_ADMIN_PASSWORD/SEED_OPERATOR_PASSWORD values between 12 and 72 UTF-8 bytes.",
    );
  }

  return [
    {
      name: "Development Administrator",
      email: credentials.data.SEED_ADMIN_EMAIL.toLowerCase(),
      password: credentials.data.SEED_ADMIN_PASSWORD,
      role: UserRole.ADMIN,
    },
    {
      name: "Development Operator",
      email: credentials.data.SEED_OPERATOR_EMAIL.toLowerCase(),
      password: credentials.data.SEED_OPERATOR_PASSWORD,
      role: UserRole.OPERATOR,
    },
  ];
};
