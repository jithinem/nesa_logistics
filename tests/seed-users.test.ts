import assert from "node:assert/strict";
import { test } from "node:test";
import { getSeedUsers } from "../src/seed/seed-users";
import { UserRole } from "../src/shared/types/logistics";

test("builds deterministic admin and operator seed accounts", () => {
  const users = getSeedUsers({
    SEED_ADMIN_PASSWORD: "Admin-test-password-2026",
    SEED_OPERATOR_PASSWORD: "Operator-test-password-2026",
  });

  assert.deepEqual(
    users.map(({ email, role }) => ({ email, role })),
    [
      { email: "admin@nesa.local", role: UserRole.ADMIN },
      { email: "operator@nesa.local", role: UserRole.OPERATOR },
    ],
  );
  assert.equal(users.length, 2);
});

test("normalizes configured emails and rejects identical accounts", () => {
  const users = getSeedUsers({
    SEED_ADMIN_EMAIL: " ADMIN@example.com ",
    SEED_ADMIN_PASSWORD: "Admin-test-password-2026",
    SEED_OPERATOR_EMAIL: "operator@example.com",
    SEED_OPERATOR_PASSWORD: "Operator-test-password-2026",
  });

  assert.equal(users[0]?.email, "admin@example.com");
  assert.throws(
    () =>
      getSeedUsers({
        SEED_ADMIN_EMAIL: "same@example.com",
        SEED_ADMIN_PASSWORD: "Admin-test-password-2026",
        SEED_OPERATOR_EMAIL: "SAME@example.com",
        SEED_OPERATOR_PASSWORD: "Operator-test-password-2026",
      }),
    /Seed users require valid/,
  );
});

test("requires strong seed passwords and excludes bcrypt-overlong values", () => {
  assert.throws(
    () =>
      getSeedUsers({
        SEED_ADMIN_PASSWORD: "short",
        SEED_OPERATOR_PASSWORD: "Operator-test-password-2026",
      }),
    /Seed users require valid/,
  );

  assert.throws(
    () =>
      getSeedUsers({
        SEED_ADMIN_PASSWORD: "é".repeat(37),
        SEED_OPERATOR_PASSWORD: "Operator-test-password-2026",
      }),
    /Seed users require valid/,
  );
});
