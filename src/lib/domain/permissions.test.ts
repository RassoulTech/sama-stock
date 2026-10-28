import { describe, expect, it } from "vitest";
import { can, type Permission, type Role } from "./permissions";

// Matrice du cahier des charges, § 2.3
const expected: Record<Permission, Role[]> = {
  "dashboard.full": ["owner", "manager"],
  "sales.create": ["owner", "manager", "seller"],
  "sales.cancel": ["owner", "manager"],
  "sales.delete": ["owner"],
  "orders.manage": ["owner", "manager", "seller"],
  "products.view": ["owner", "manager", "seller", "storekeeper"],
  "products.manage": ["owner", "manager"],
  "stock.in": ["owner", "manager", "storekeeper"],
  "stock.adjust": ["owner", "manager", "storekeeper"],
  "stock.transfer": ["owner", "manager", "storekeeper"],
  "stock.cancel": ["owner", "manager"],
  "customers.manage": ["owner", "manager", "seller"],
  "payments.cancel": ["owner", "manager"],
  "suppliers.view": ["owner", "manager", "storekeeper"],
  "suppliers.manage": ["owner", "manager"],
  "costs.view": ["owner", "manager"],
  "reports.view": ["owner", "manager"],
  "team.manage": ["owner"],
  "billing.manage": ["owner"],
  "settings.manage": ["owner"],
};

const roles: Role[] = ["owner", "manager", "seller", "storekeeper"];

describe("can", () => {
  for (const [perm, allowed] of Object.entries(expected) as [Permission, Role[]][]) {
    for (const role of roles) {
      const should = allowed.includes(role);
      it(`${role} ${should ? "can" : "cannot"} ${perm}`, () => {
        expect(can(role, perm)).toBe(should);
      });
    }
  }
});
