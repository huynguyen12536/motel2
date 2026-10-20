import { Injectable, Inject } from "@nestjs/common";
import { TenantsRepository } from "./tenants.repository.js";
import type { CreateTenantInput } from "./dto/create-tenant.dto.js";
import type { UpdateTenantInput } from "./dto/update-tenant.dto.js";
import type { ListTenantsInput } from "./dto/list-tenants-query.dto.js";
@Injectable()
export class TenantsService {
  constructor(@Inject(TenantsRepository) private readonly repository: TenantsRepository) {}
  create(input: CreateTenantInput) {
    return this.repository.create(input);
  }
  list(input: ListTenantsInput) {
    return this.repository.list(input);
  }
  find(id: string) {
    return this.repository.find(id);
  }
  update(id: string, input: UpdateTenantInput) {
    return this.repository.update(id, input);
  }
}
