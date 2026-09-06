import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Existing data-loading effects are valid but need a dedicated refactor.
    // Keep the framework upgrade focused and preserve the previous lint baseline.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
