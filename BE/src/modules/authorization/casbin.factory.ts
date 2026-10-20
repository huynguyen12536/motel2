import { newEnforcer, newModel, type Adapter, type Model } from "casbin";
export const casbinModel = `[request_definition]
r = sub, dom, obj, act
[policy_definition]
p = sub, dom, obj, act
[role_definition]
g = _, _, _
[policy_effect]
e = some(where (p_eft == allow))
[matchers]
m = g(r.sub, p.sub, r.dom) && r.dom == p.dom && r.obj == p.obj && r.act == p.act
`;
export type PolicySnapshot = {
  domain: string;
  roles: { id: string; permissions: { permissionCode: string }[] }[];
  assignments: { userId: string; roleId: string }[];
};
// Relational role-permission and user-role rows are the sole authority; p/g are projections.
// There is no second independently mutable CasbinRule table to drift from these rows.
export class PrismaPolicyAdapter implements Adapter {
  constructor(private readonly snapshot: PolicySnapshot) {}
  async loadPolicy(model: Model) {
    for (const role of this.snapshot.roles)
      for (const grant of role.permissions) {
        const [resource, action] = grant.permissionCode.split(":");
        model.addPolicy("p", "p", ["role:" + role.id, this.snapshot.domain, resource, action]);
      }
    for (const a of this.snapshot.assignments)
      model.addPolicy("g", "g", ["user:" + a.userId, "role:" + a.roleId, this.snapshot.domain]);
  }
  async savePolicy(): Promise<boolean> {
    throw Error("Use transactional authorization management");
  }
  async addPolicy(): Promise<void> {
    throw Error("Direct policy writes are forbidden");
  }
  async removePolicy(): Promise<void> {
    throw Error("Direct policy writes are forbidden");
  }
  async removeFilteredPolicy(): Promise<void> {
    throw Error("Direct policy writes are forbidden");
  }
}
export async function createEnforcer(snapshot: PolicySnapshot) {
  const enforcer = await newEnforcer(newModel(casbinModel), new PrismaPolicyAdapter(snapshot));
  enforcer.enableAutoSave(false);
  return enforcer;
}
