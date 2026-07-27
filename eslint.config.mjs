// ESLint flat config. Enforces module boundaries from docs/04-REPOSITORY-STRUCTURE.md §3
// and the admin copy lint from docs/09-ADMIN-DAD-MODE.md §2.1.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  security.configs.recommended,
  {
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Do not read process.env directly. Import validated config from '@/env' instead (see docs/03-TECHNOLOGY-STACK.md §5).",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "dangerouslySetInnerHTML is prohibited. Rich text must be rendered from validated JSON (see docs/13-SECURITY.md §4).",
        },
        {
          selector: "NewExpression[callee.name='PrismaClient']",
          message:
            "Only src/server/db.ts may instantiate PrismaClient. Import the shared singleton instead: import { db } from '@/server/db' (docs/04-REPOSITORY-STRUCTURE.md §3).",
        },
      ],
    },
  },
  {
    files: ["src/env.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["src/server/db.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "**/server/**"],
              message:
                "components/** must not import from server/** (docs/04-REPOSITORY-STRUCTURE.md §3).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "**/server/**", "@/components/*", "**/app/**"],
              message:
                "lib/** must not import from server/**, app/**, or components/** (docs/04-REPOSITORY-STRUCTURE.md §3).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["vitest.setup.ts"],
    rules: { "no-restricted-properties": "off" },
  },
];

export default config;
