import { Injectable } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import { closeLogger } from "../../../logger/index.js";
@Injectable()
export class LifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await closeLogger();
  }
}
