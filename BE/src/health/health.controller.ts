import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { RabbitmqConnection } from "../infrastructure/messaging/rabbitmq/rabbitmq.connection.js";
import { RedisService } from "../infrastructure/cache/redis.service.js";
import { env } from "../config/env.js";
import { MasterPrismaService } from "../infrastructure/database/master/master-prisma.service.js";
@ApiTags("Infrastructure")
@Controller("health")
export class HealthController {
  constructor(
    @Inject(RabbitmqConnection) private readonly rabbit: RabbitmqConnection,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(MasterPrismaService) private readonly master: MasterPrismaService,
  ) {}
  @Get("live")
  @ApiOperation({ summary: "Process liveness; independent of external services" })
  live() {
    return { status: "ok" };
  }
  @Get("ready")
  @ApiResponse({ status: 200, description: "All configured dependencies are available" })
  @ApiResponse({ status: 503, description: "One or more dependencies are unavailable" })
  async ready() {
    const [redis, database] = await Promise.all([
      this.redis.check(),
      env.DATABASE_VERIFY ? this.master.ping().catch(() => false) : Promise.resolve(undefined),
    ]);
    const dependencies = {
      rabbitmq: this.rabbit.healthy ? "up" : "down",
      redis: redis ? "up" : "down",
      neon: database === undefined ? "skipped" : database ? "up" : "down",
    };
    const ok = this.rabbit.healthy && redis && database !== false;
    const body = { status: ok ? "ok" : "degraded", dependencies };
    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }
}
