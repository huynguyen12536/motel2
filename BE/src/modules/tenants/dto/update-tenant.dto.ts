import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";
import { tenantNameSchema } from "./create-tenant.dto.js";
export const updateTenantSchema = z.strictObject({ name: tenantNameSchema });
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export class UpdateTenantDto {
  @ApiProperty({ maxLength: 200, example: "Updated company name" }) name!: string;
}
