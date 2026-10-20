import type { TenantDatabase } from "../generated/master-authorized/client.js";
export const DATABASE_BACKEND = Symbol("DATABASE_BACKEND");
export const TENANT_CONNECTIONS = Symbol("TENANT_CONNECTIONS");
export const SAAS_POLICY = Symbol("SAAS_POLICY");
export interface SaasPolicy {
  provisioningEnabled: boolean;
  bootstrapEnabled: boolean;
  rolloutEnabled: boolean;
  projectId: string;
  branchId: string;
  maxDatabases: number;
  prefix: string;
  credentialVersion: string;
}
export interface ConnectionTarget {
  url: string;
  tls: boolean;
  fingerprint: string;
}
export interface TenantConnections {
  resolve(mapping: TenantDatabase): Promise<ConnectionTarget>;
}
export interface DatabaseBackend {
  provision(mapping: TenantDatabase, signal: AbortSignal): Promise<Partial<TenantDatabase>>;
  migrate(mapping: TenantDatabase, signal: AbortSignal): Promise<string>;
  verify(mapping: TenantDatabase, signal: AbortSignal): Promise<void>;
}
export class PipelineError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(code);
  }
}
export const safeFailure = (error: unknown) =>
  error instanceof PipelineError ? error : new PipelineError("INTERNAL_PIPELINE_ERROR", true);
