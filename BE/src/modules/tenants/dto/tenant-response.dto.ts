import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TenantStatus, ProvisioningStatus } from "../../../generated/master-authorized/enums.js";
export class TenantResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: TenantStatus }) status!: TenantStatus;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) activatedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) suspendedAt!: string | null;
}
export class TenantDatabaseResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() provider!: string;
  @ApiProperty({ type: String, nullable: true }) databaseName!: string | null;
  @ApiProperty({ type: String, nullable: true }) neonProjectId!: string | null;
  @ApiProperty({ type: String, nullable: true }) neonBranchId!: string | null;
  @ApiProperty({ type: String, nullable: true }) neonDatabaseId!: string | null;
  @ApiProperty({ type: String, nullable: true }) schemaVersion!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) provisionedAt!: string | null;
}
export class ProvisioningResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ProvisioningStatus }) status!: ProvisioningStatus;
  @ApiProperty({ minimum: 0 }) attemptCount!: number;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) startedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) completedAt!: string | null;
}
export class TenantDetailResponseDto extends TenantResponseDto {
  @ApiProperty({ type: TenantDatabaseResponseDto, nullable: true })
  database!: TenantDatabaseResponseDto | null;
  @ApiProperty({ type: ProvisioningResponseDto, nullable: true })
  provisioning!: ProvisioningResponseDto | null;
}
export class TenantListResponseDto {
  @ApiProperty({ type: [TenantResponseDto] }) items!: TenantResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
}
export class TenantErrorDto {
  @ApiProperty() statusCode!: number;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ type: [String] }) fields?: string[];
}
