import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", "src/generated/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        AbortSignal: "readonly",
      },
    },
  },
  {
    files: ["src/infrastructure/http/middleware/request-id.ts"],
    rules: { "@typescript-eslint/no-namespace": "off" },
  },
);
