import helmet from "helmet";
import { appConfig } from "./app.config.js";

export const securityHeaders = helmet({
  hidePoweredBy: true,
  frameguard: { action: "deny" },
  noSniff: true,
  referrerPolicy: { policy: "no-referrer" },
  hsts: appConfig.isProduction
    ? {
        maxAge: 15552000,
        includeSubDomains: true,
        preload: false,
      }
    : false,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      imgSrc: ["'none'"],
      fontSrc: ["'none'"],
      connectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
});
