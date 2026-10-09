import { X } from "lucide-react";
import { useState } from "react";

import {
  type GoalPathSystem,
  type Issue,
  type KeyProjectList,
  type RaciLetter,
  type RaciTable,
  newRowId,
  raciRowsFrom,
  toggleRaciLetter,
} from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectOrgUnit } from "@/lib/dingze/api";
import { errorAnchors, moveById, removeById } from "@/lib/dingze/rows";
import { cn } from "@/lib/utils";

import { AddButton, EditorToolbar, ImportButton, RowActions, TextCell } from "./kit";

type Props = {
  value: RaciTable;
  onChange: (next: RaciTable) => void;
  readOnly: boolean;
  issues: Issue[];
  upstream: { "S2-08"?: KeyProjectList; "S2-03"?: GoalPathSystem };
  orgUnits: ProjectOrgUnit[];
};

const LETTERS: { key: RaciLetter; title: string }[] = [
  { key: "R", title: "执行者" },
  { key: "A", title: "最终负责者（唯一）" },
  { key: "C", title: "咨询 / 协同者" },
  { key: "I", title: "知情者" },
];

const LETTER_TONE: Record<RaciLetter, string> = {
  R: "bg-brand text-brand-foreground",
  A: "bg-gold text-brand",
  C: "bg-secondary text-secondary-foreground",
  I: "bg-muted text-muted-foreground",
};

/** S2-04: rows are key projects (or key paths), columns are departments; A = 1 and R ≥ 1 per row. */
export function RaciEditor({ value, onChange, readOnly, issues, upstream, orgUnits }: Props) {
  const invalid = errorAnchors(issues);
  const [newColumn, setNewColumn] = useState("");
  const columns = value.columns ?? [];
  const rows = value.rows ?? [];
  const projects = upstream["S2-08"]?.projects ?? [];
  const rowSeed = raciRowsFrom(projects.length ? { projects } : { paths: (upstream["S2-03"]?.nodes ?? []).filter((n) => n.level <= 2) }, rows);
  const deptSeed = orgUnits
    .filter((o) => o.kind !== "company" && !columns.some((c) => c.id === `org-${o.id}`))
    .map((o) => ({ id: `org-${o.id}`, name: o.name }));

  const removeColumn = (id: string) =>
    onChange({
      columns: removeById(columns, id),
      rows: rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[id];
        return { ...r, cells };
      }),
    });

  return (
    <section aria-label="RACI 责任分解矩阵" className="flex flex-col gap-4">
      <EditorToolbar hint="R 执行者、A 最终负责者、C 咨询协同、I 知情。每行 A 必须唯一、至少一个 R；点 A 会自动从同行其他部门移走。">
        <ImportButton label="带入组织部门" count={deptSeed.length} readOnly={readOnly} onClick={() => onChange({ ...value, columns: [...columns, ...deptSeed] })} />
        <ImportButton
          label={projects.length ? "带入关键项目" : "带入一、二级路径"}
          count={rowSeed.length}
          readOnly={readOnly}
          onClick={() => onChange({ ...value, rows: [...rows, ...rowSeed] })}
        />
        {!readOnly ? (
          <AddButton label="添加行" onClick={() => onChange({ ...value, rows: [...rows, { id: newRowId("ra"), name: "", cells: {}, sourceId: null, sourceKind: "manual" }] })} />
        ) : null}
      </EditorToolbar>

      {!readOnly ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newColumn.trim()) return;
            onChange({ ...value, columns: [...columns, { id: newRowId("col"), name: newColumn.trim() }] });
            setNewColumn("");
          }}
        >
          <Input aria-label="新增责任部门或岗位" placeholder="新增部门 / 岗位列" value={newColumn} onChange={(e) => setNewColumn(e.target.value)} className="w-56" />
          <Button type="submit" variant="outline" size="sm" disabled={!newColumn.trim()}>
            添加列
          </Button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="sticky left-0 min-w-56 bg-muted px-2 py-2 text-left font-semibold">关键项目 / 路径</th>
              {columns.map((c) => (
                <th key={c.id} className={cn("min-w-32 px-2 py-2 text-center font-semibold", invalid.has(c.id) && "text-destructive")}>
                  <div className="flex items-center justify-center gap-1">
                    {c.name}
                    {!readOnly ? (
                      <button type="button" aria-label={`删除列 ${c.name}`} onClick={() => removeColumn(c.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              <th className="w-20 px-2 py-2 text-center font-semibold">A / R</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                  还没有要分配责任的项目或路径
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const a = columns.filter((c) => (row.cells?.[c.id] ?? []).includes("A")).length;
                const r = columns.filter((c) => (row.cells?.[c.id] ?? []).includes("R")).length;
                return (
                  <tr key={row.id} className={cn("border-t align-middle", invalid.has(row.id) && "bg-destructive/5")}>
                    <td className="sticky left-0 bg-card px-1 py-1">
                      <TextCell label="行名称" value={row.name} onChange={(name) => onChange({ ...value, rows: rows.map((x) => (x.id === row.id ? { ...x, name } : x)) })} readOnly={readOnly} />
                    </td>
                    {columns.map((c) => {
                      const letters = row.cells?.[c.id] ?? [];
                      return (
                        <td key={c.id} className="px-1 py-1 text-center">
                          <div className="inline-flex gap-0.5">
                            {LETTERS.map((l) => {
                              const on = letters.includes(l.key);
                              return (
                                <button
                                  key={l.key}
                                  type="button"
                                  disabled={readOnly}
                                  aria-pressed={on}
                                  aria-label={`${row.name || "行"} · ${c.name} · ${l.key} ${l.title}`}
                                  title={`${l.key} ${l.title}`}
                                  onClick={() => onChange(toggleRaciLetter(value, row.id, c.id, l.key))}
                                  className={cn(
                                    "size-7 rounded-md border text-xs font-bold transition-colors disabled:cursor-default",
                                    on ? LETTER_TONE[l.key] : "border-dashed text-muted-foreground/60 hover:border-solid hover:text-foreground"
                                  )}
                                >
                                  {l.key}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                    <td className={cn("px-2 py-1 text-center text-xs font-semibold tabular-nums", a === 1 && r >= 1 ? "text-status-done-foreground" : "text-destructive")}>
                      {a} / {r}
                    </td>
                    <td className="px-1 py-1">
                      <RowActions
                        label={row.name || "行"}
                        readOnly={readOnly}
                        onRemove={() => onChange({ ...value, rows: removeById(rows, row.id) })}
                        onMove={(delta) => onChange({ ...value, rows: moveById(rows, row.id, delta) })}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
