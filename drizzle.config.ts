import { defineConfig } from "drizzle-kit";

// Schema tooling only. Apply versioned SQL through Wrangler (pnpm db:migrate).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/d1-schema/index.ts",
  out: "./drizzle-d1",
  strict: true,
  verbose: true,
});
