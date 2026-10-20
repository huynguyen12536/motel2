import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next-authz-e2e-*/**",
    ".authz-tsconfig-*.json",
    "next-env.d.ts",
    "public/landing-pages/secret-pathways-assets/three.min.js",
    "public/landing-pages/secret-pathways-assets/GLTFLoader.js",
  ]),
]);
