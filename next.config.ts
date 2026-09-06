import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const config: NextConfig = {
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  reactCompiler: true,
  poweredByHeader: false,
};
export default createNextIntlPlugin("./src/i18n/request.ts")(config);
