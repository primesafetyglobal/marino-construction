import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // One door (Filing guide §3): object storage only through the Filing module.
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@aws-sdk/*"], message: "Use the Filing module (@/server/modules/filing/lib)." }] }],
    },
  },
  {
    files: ["src/server/modules/filing/lib/storage/**", "tests/**"],
    rules: { "no-restricted-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client and archived starter files.
    "prisma/src/generated/**",
    "legacy/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
