import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-plugin-react-hooks 7.1 (via eslint-config-next 16.4) gör två React
  // Compiler-regler till fel. De pekar ut befintlig kod i ChurchGrid,
  // ChurchGridFilter och AdminCandidatesPanel som fungerade likadant innan.
  // Varning tills de fem ställena är omskrivna, så att Next-uppgraderingen
  // (säkerhet) inte blockeras av stil.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
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
