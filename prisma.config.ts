import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Optional so `prisma generate` (postinstall) works on builds without a database,
    // e.g. a fresh Vercel project. Migrations and seeding still need it.
    url: process.env.DATABASE_URL ?? "",
  },
});
