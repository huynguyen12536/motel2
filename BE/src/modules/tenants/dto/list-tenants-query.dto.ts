import { ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";
import { TenantStatus } from "../../../generated/master-authorized/enums.js";
const positiveInteger = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .pipe(z.number().int().safe().positive());
export const listTenantsSchema = z.strictObject({
  page: positiveInteger.pipe(z.number().max(1000000)).optional().default(1),
  limit: positiveInteger.pipe(z.number().max(100)).optional().default(20),
  status: z.enum(TenantStatus).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListTenantsInput = z.infer<typeof listTenantsSchema>;
export class ListTenantsQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1, maximum: 1000000 }) page?: number;
  @ApiPropertyOptional({ type: Number, default: 20, minimum: 1, maximum: 100 }) limit?: number;
  @ApiPropertyOptional({ enum: TenantStatus }) status?: TenantStatus;
  @ApiPropertyOptional({
    maxLength: 100,
    description: "Case-insensitive substring of company name or tenant code",
  })
  search?: string;
}
