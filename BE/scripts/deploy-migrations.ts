// Compatibility command. Requires explicit MASTER_DIRECT_URL; no pooled fallback.
process.argv[2] = "master";
await import("./migrate.js");
