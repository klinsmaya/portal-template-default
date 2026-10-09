import type { OrgUnit } from "./ops-api";

export type OrgNode = OrgUnit & { depth: number };

/**
 * Depth-first order with depth, so the tree renders as an indented list. Units whose
 * parent is missing are shown at the top level instead of disappearing.
 */
export function flattenOrgUnits(units: OrgUnit[]): OrgNode[] {
  const ids = new Set(units.map((u) => u.id));
  const byParent = new Map<number | null, OrgUnit[]>();
  for (const unit of units) {
    const key = unit.parentId && ids.has(unit.parentId) ? unit.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), unit]);
  }
  const out: OrgNode[] = [];
  const seen = new Set<number>();
  const walk = (parentId: number | null, depth: number) => {
    for (const unit of [...(byParent.get(parentId) ?? [])].sort((a, b) => a.sort - b.sort || a.id - b.id)) {
      if (seen.has(unit.id)) continue;
      seen.add(unit.id);
      out.push({ ...unit, depth });
      walk(unit.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** “燃气运营部 › 调度中心” */
export function orgUnitPath(units: OrgUnit[], id: number | null | undefined): string {
  const byId = new Map(units.map((u) => [u.id, u]));
  const names: string[] = [];
  let current = id ? byId.get(id) : undefined;
  while (current && names.length < 10) {
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(" › ");
}
