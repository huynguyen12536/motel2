import { test, expect } from "@jest/globals";
import { assertTestTarget, inspectOwnedContainer } from "../../scripts/lib/test-owned-postgres.mjs";
const ownership = {
  containerId: "0".repeat(64),
  runId: "a".repeat(36),
  port: 65432,
  databases: ["phase2_registry"],
};
test.each([
  "postgresql://phase2_test:test@ep-example.neon.tech:65432/phase2_registry",
  "postgresql://phase2_test:test@localhost:65432/phase2_registry",
  "postgresql://phase2_test:test@127.0.0.1:5432/phase2_registry",
  "postgresql://phase2_test:test@127.0.0.1:65432/production",
  "postgresql://phase2_test:test@127.0.0.1:65432/postgres",
  "postgresql://postgres:test@127.0.0.1:65432/phase2_registry",
  "postgresql://phase2_test@127.0.0.1:65432/phase2_registry",
])("test runner rejects unsafe target before attempting a connection: %s", async (url) => {
  await expect(assertTestTarget(url, ownership)).rejects.toThrow(
    "not an explicit owned local test URL",
  );
});
test("missing ownership evidence is rejected before Docker inspection", () => {
  expect(() => inspectOwnedContainer(undefined)).toThrow("Missing test ownership evidence");
});
