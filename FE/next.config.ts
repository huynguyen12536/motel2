import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const config: NextConfig = {
  // Isolate connected authorization E2E compilation from the developer's .next output.
  ...(/^[a-f0-9]{12}$/.test(process.env.AUTHORIZATION_E2E_RUN ?? "")
    ? {
        distDir: ".next-authz-e2e-" + process.env.AUTHORIZATION_E2E_RUN,
        typescript: {
          tsconfigPath:
            ".authz-tsconfig-" + process.env.AUTHORIZATION_E2E_RUN + ".json",
        },
      }
    : {}),
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  reactCompiler: true,
  poweredByHeader: false,
  // Hide the floating Next.js "N" badge in local/dev UI.
  devIndicators: false,
};
export default createNextIntlPlugin("./src/i18n/request.ts")(config);
