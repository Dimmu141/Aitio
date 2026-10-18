import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Not env("DATABASE_URL"): that throws when the variable is missing, which
    // breaks `prisma generate` in postinstall on a fresh clone before .env exists.
    // Commands that need the database still fail loudly on an empty URL.
    url: process.env.DATABASE_URL ?? "",
  },
});
