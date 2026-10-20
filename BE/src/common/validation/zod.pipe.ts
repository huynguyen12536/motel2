import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
const protectedFields = new Set([
  "id",
  "code",
  "slug",
  "status",
  "database",
  "databaseName",
  "tenantId",
  "neonProjectId",
  "neonBranchId",
  "neonDatabaseId",
  "schemaVersion",
  "provisioning",
  "provisioningStatus",
  "provisionedAt",
  "activatedAt",
  "suspendedAt",
  "provider",
  "createdAt",
  "updatedAt",
]);
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: ZodType<T>,
    private readonly operation: "create" | "update" | "query",
  ) {}
  transform(value: unknown): T {
    if (this.operation !== "query" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const key of Object.keys(value)) {
        if (
          protectedFields.has(key) &&
          !(this.operation === "create" && (key === "code" || key === "slug"))
        )
          throw new ForbiddenException("This operation cannot change tenant identity or lifecycle");
      }
    }
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new BadRequestException({
        statusCode: 400,
        message: "Invalid request",
        fields: [...new Set(result.error.issues.map((i) => i.path.join(".") || "body"))],
      });
    return result.data;
  }
}
