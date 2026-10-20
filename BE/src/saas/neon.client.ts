import { z } from "zod";
import { PipelineError } from "./contracts.js";
const database = z.object({
  id: z.number().int().or(z.string()),
  name: z.string(),
  branch_id: z.string(),
  owner_name: z.string(),
});
export type NeonDatabase = z.infer<typeof database>;
export class NeonClient {
  constructor(
    private readonly token: string,
    private readonly project: string,
    private readonly branch: string,
    private readonly request: typeof fetch = fetch,
    private readonly origin = "https://console.neon.tech/api/v2",
  ) {
    if (!/^[a-z0-9-]{1,60}$/.test(project) || !/^br-[a-z0-9-]{1,57}$/.test(branch))
      throw new PipelineError("NEON_TARGET_INVALID");
    // Production callers cannot configure an alternate endpoint. Tests inject fetch directly.
    if (origin !== "https://console.neon.tech/api/v2")
      throw new PipelineError("NEON_ENDPOINT_INVALID");
  }
  private async call(
    method: string,
    path: string,
    body: unknown,
    signal: AbortSignal,
    missing = false,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.request(this.origin + path, {
        method,
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
        headers: {
          authorization: "Bearer " + this.token,
          "content-type": "application/json",
          accept: "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new PipelineError(
        method === "POST" ? "NEON_CREATION_AMBIGUOUS" : "NEON_UNAVAILABLE",
        method !== "POST",
      );
    }
    if (response.status === 404 && missing) return null;
    if (response.status === 401 || response.status === 403)
      throw new PipelineError("NEON_PERMISSION_DENIED");
    if (response.status === 429) throw new PipelineError("NEON_RATE_LIMITED", true);
    if (response.status === 409) throw new PipelineError("NEON_RESOURCE_CONFLICT");
    if (!response.ok)
      throw new PipelineError(
        method === "POST" ? "NEON_CREATION_AMBIGUOUS" : "NEON_UNAVAILABLE",
        method !== "POST",
      );
    try {
      return await response.json();
    } catch {
      throw new PipelineError("NEON_RESPONSE_INVALID");
    }
  }
  private base() {
    return (
      "/projects/" +
      encodeURIComponent(this.project) +
      "/branches/" +
      encodeURIComponent(this.branch)
    );
  }
  async target(signal: AbortSignal) {
    const project = z
      .object({ project: z.object({ id: z.string() }) })
      .parse(await this.call("GET", "/projects/" + this.project, undefined, signal));
    const branch = z
      .object({ branch: z.object({ id: z.string(), project_id: z.string() }) })
      .parse(await this.call("GET", this.base(), undefined, signal));
    if (
      project.project.id !== this.project ||
      branch.branch.id !== this.branch ||
      branch.branch.project_id !== this.project
    )
      throw new PipelineError("NEON_TARGET_MISMATCH");
  }
  async inspect(name: string, signal: AbortSignal): Promise<NeonDatabase | null> {
    const result = await this.call(
      "GET",
      this.base() + "/databases/" + encodeURIComponent(name),
      undefined,
      signal,
      true,
    );
    if (result === null) return null;
    const parsed = z.object({ database }).safeParse(result);
    if (
      !parsed.success ||
      parsed.data.database.name !== name ||
      parsed.data.database.branch_id !== this.branch
    )
      throw new PipelineError("NEON_RESOURCE_IDENTITY_MISMATCH");
    return parsed.data.database;
  }
  async create(name: string, owner: string, signal: AbortSignal): Promise<NeonDatabase> {
    const result = await this.call(
      "POST",
      this.base() + "/databases",
      { database: { name, owner_name: owner } },
      signal,
    );
    const parsed = z.object({ database }).safeParse(result);
    if (
      !parsed.success ||
      parsed.data.database.name !== name ||
      parsed.data.database.branch_id !== this.branch ||
      parsed.data.database.owner_name !== owner
    )
      throw new PipelineError("NEON_RESOURCE_IDENTITY_MISMATCH");
    return parsed.data.database;
  }
  async connection(name: string, role: string, signal: AbortSignal): Promise<string> {
    const params = new URLSearchParams({
      branch_id: this.branch,
      database_name: name,
      role_name: role,
      pooled: "false",
    });
    const result = z
      .object({ uri: z.string() })
      .safeParse(
        await this.call(
          "GET",
          "/projects/" + this.project + "/connection_uri?" + params,
          undefined,
          signal,
        ),
      );
    if (!result.success) throw new PipelineError("NEON_RESPONSE_INVALID");
    return result.data.uri;
  }
}
