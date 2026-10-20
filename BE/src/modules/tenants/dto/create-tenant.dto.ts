import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";
export const tenantNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => Array.from(value).every((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127),
    "Control characters are not allowed",
  );
export const createTenantSchema = z.strictObject({
  name: tenantNameSchema,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9_]*$/),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export class CreateTenantDto {
  @ApiProperty({ maxLength: 200, example: "Company A" }) name!: string;
  @ApiProperty({ maxLength: 64, pattern: "^[A-Z0-9][A-Z0-9_]*$", example: "COMPANY_A" })
  code!: string;
  @ApiProperty({ maxLength: 63, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", example: "company-a" })
  slug!: string;
}
