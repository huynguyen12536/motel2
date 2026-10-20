import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from "@nestjs/common";
import { MasterPrismaService } from "../../infrastructure/database/master/master-prisma.service.js";
import type { Prisma } from "../../generated/master-authorized/client.js";
import { logger } from "../../../logger/index.js";
import type { CreateTenantInput } from "./dto/create-tenant.dto.js";
import type { UpdateTenantInput } from "./dto/update-tenant.dto.js";
import type { ListTenantsInput } from "./dto/list-tenants-query.dto.js";

const summary = {
  id: true,
  name: true,
  code: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,
  suspendedAt: true,
} as const;
const detail = {
  ...summary,
  database: {
    select: {
      id: true,
      provider: true,
      databaseName: true,
      neonProjectId: true,
      neonBranchId: true,
      neonDatabaseId: true,
      schemaVersion: true,
      provisionedAt: true,
    },
  },
  provisioning: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      id: true,
      status: true,
      attemptCount: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      completedAt: true,
    },
  },
} satisfies Prisma.TenantSelect;

@Injectable()
export class TenantsRepository {
  constructor(@Inject(MasterPrismaService) private readonly master: MasterPrismaService) {}
  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
      if (code === "P2002") throw new ConflictException("Tenant code or slug already exists");
      if (code === "P2025") throw new NotFoundException("Tenant not found");
      if (error instanceof ServiceUnavailableException) throw error;
      // Log only an allowlisted Prisma code, never a driver message, query, or input.
      logger.error(
        {
          event: "tenant_registry.database_error",
          code: code && /^P[0-9]{4}$/.test(code) ? code : "unknown",
        },
        "Tenant registry operation failed",
      );
      if (
        code &&
        ["P1000", "P1001", "P1002", "P1008", "P1017", "P2021", "P2022", "P2024"].includes(code)
      )
        throw new ServiceUnavailableException("Tenant registry is unavailable");
      throw new InternalServerErrorException("Tenant registry operation failed");
    }
  }
  create(input: CreateTenantInput) {
    return this.execute(async () => {
      const db = await this.master.client();
      return db.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: input.name, code: input.code, slug: input.slug },
          select: summary,
        });
        await tx.tenantProvisioning.create({ data: { tenantId: tenant.id }, select: { id: true } });
        return tenant;
      });
    });
  }
  list(input: ListTenantsInput) {
    return this.execute(async () => {
      const db = await this.master.client();
      const where: Prisma.TenantWhereInput = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { code: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [items, total] = await db.$transaction(
        [
          db.tenant.findMany({
            where,
            select: summary,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (input.page - 1) * input.limit,
            take: input.limit,
          }),
          db.tenant.count({ where }),
        ],
        { isolationLevel: "RepeatableRead" },
      );
      return { items, page: input.page, limit: input.limit, total };
    });
  }
  find(id: string) {
    return this.execute(async () => {
      const db = await this.master.client();
      const row = await db.tenant.findUniqueOrThrow({ where: { id }, select: detail });
      return { ...row, provisioning: row.provisioning[0] ?? null };
    });
  }
  update(id: string, input: UpdateTenantInput) {
    return this.execute(async () => {
      const db = await this.master.client();
      return db.tenant.update({ where: { id }, data: { name: input.name }, select: summary });
    });
  }
}
