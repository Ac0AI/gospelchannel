import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    ".npm-cache/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design handoff is mock JSX shipped for reference (window.X
    // assignments, no imports, embedded react). Not production code.
    "design_handoff_gospelchannel/**",
  ]),
]);

export default eslintConfig;
