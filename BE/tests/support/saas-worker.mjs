import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SaasModule } from "../../dist/src/saas/saas.module.js";
import { ProvisioningWorker } from "../../dist/src/saas/provisioning.worker.js";
import { ProvisioningBroker } from "../../dist/src/saas/broker.js";
import { LocalNeonBackend, LocalConnections, localPolicy } from "./local-saas-backend.mjs";
import { closeLogger } from "../../dist/logger/index.js";
const context = JSON.parse(process.env.SAAS_TEST_CONTEXT);
const broker = new ProvisioningBroker(context.topology, context.rabbit);
const app = await NestFactory.createApplicationContext(
  SaasModule.register({
    backend: new LocalNeonBackend(context),
    connections: new LocalConnections(context),
    policy: localPolicy(context),
    broker,
  }),
  { logger: false },
);
const worker = app.get(ProvisioningWorker);
await broker.consume((message) => worker.handle(message, broker));
process.send?.({ ready: true });
async function shutdown() {
  worker.stop();
  await broker.close();
  await app.close();
  await closeLogger();
  process.exit(0);
}
process.on("message", (message) => {
  if (message?.stop) void shutdown();
});
process.on("SIGTERM", () => void shutdown());
