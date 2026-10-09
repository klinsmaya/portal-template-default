import { FileSpreadsheet, History } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ARTIFACTS, STAGES, STATUS_LABELS, type ArtifactStatus, type StageKey } from "@dingze/shared";

import { StatusBadge } from "@/components/dingze/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorMessage } from "@/lib/dingze/errors";
import { downloadXlsx } from "@/lib/dingze/export/xlsx";
import { workspacePath } from "@/lib/dingze/progress";
import { type RegistryFilter, aiDiffLabel, eventLabel, filterRegistry, formatTime, priorityLabel, registrySheet, versionMix } from "@/lib/dingze/records";
import { useArtifactRegistry } from "@/lib/dingze/records-queries";

import { ArtifactHistorySheet } from "./components/artifact-history";
import { useProjectContext } from "./project-context";

const STATUS_FILTERS: { value: RegistryFilter["status"]; label: string }[] = [
  { value: "all", label: "全部状态" },
  ...(["not_started", "in_progress", "step_done", "in_review", "pending_confirm", "locked"] as ArtifactStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  { value: "stale", label: "上游已变更" },
];

/** 成果与定版：every artifact of the project with state, versions, operators and AI-vs-locked difference. */
export default function ArtifactsPage() {
  const { project } = useProjectContext();
  const registry = useArtifactRegistry(project);
  const [filter, setFilter] = useState<RegistryFilter>({ stage: "all", status: "all" });
  const [historyCode, setHistoryCode] = useState<string | null>(null);
  const rows = useMemo(() => filterRegistry(registry.data ?? [], filter), [registry.data, filter]);
  const all = registry.data ?? [];
  const locked = all.filter((r) => r.status === "locked").length;

  const exportList = async () => {
    try {
      const stamp = formatTime(new Date().toISOString());
      await downloadXlsx(
        `${project.enterprise?.shortName ?? "企业"}-成果清单.xlsx`.replace(/[\\/:*?"<>|]/g, "_"),
        { title: "成果清单", subtitle: `${project.enterprise?.shortName ?? ""} · ${project.name} · 导出于 ${stamp}`, draft: false },
        [registrySheet(rows)]
      );
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand">成果与定版</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            全部 {ARTIFACTS.length} 项成果的状态、版本与操作者；AI 初稿与定版的差异用于方法和规则改进。已定版 {locked} / {ARTIFACTS.length}。
          </p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportList} disabled={rows.length === 0}>
          <FileSpreadsheet /> 导出清单
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={[filter.stage]}
          onValueChange={(v) => v[0] && setFilter((f) => ({ ...f, stage: v[0] as StageKey | "all" }))}
          variant="outline"
          size="sm"
          aria-label="按阶段筛选"
        >
          <ToggleGroupItem value="all">全部阶段</ToggleGroupItem>
          {STAGES.map((s) => (
            <ToggleGroupItem key={s.key} value={s.key}>
              {s.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <NativeSelect size="sm" aria-label="按状态筛选" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as RegistryFilter["status"] }))}>
          {STATUS_FILTERS.map((s) => (
            <NativeSelectOption key={s.value} value={s.value}>
              {s.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">{rows.length} 项</span>
      </div>

      {registry.error ? (
        <Alert variant="destructive">
          <AlertTitle>成果清单加载失败</AlertTitle>
          <AlertDescription>{errorMessage(registry.error)}</AlertDescription>
        </Alert>
      ) : registry.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">成果</th>
                <th className="px-3 py-2 text-left font-semibold">状态</th>
                <th className="px-3 py-2 text-left font-semibold">版本</th>
                <th className="px-3 py-2 text-left font-semibold">版本构成</th>
                <th className="px-3 py-2 text-left font-semibold">AI 初稿 → 定版</th>
                <th className="px-3 py-2 text-left font-semibold">最近操作</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const def = ARTIFACTS.find((a) => a.code === row.code)!;
                return (
                  <tr key={row.code} className="border-t align-top">
                    <td className="px-3 py-2">
                      <Link to={workspacePath(project.id, row.code)} className="font-medium text-brand hover:underline">
                        《{def.name}》
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {def.specId}
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">
                          {priorityLabel(def.priority)}
                        </Badge>
                        {STAGES.find((s) => s.key === def.stage)?.name}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} stale={row.stale} />
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {row.currentRev ? `当前 v${row.currentRev}` : "—"}
                      {row.lockedRev ? <div className="text-muted-foreground">定版 v{row.lockedRev}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{versionMix(row.versions)}</td>
                    <td className="px-3 py-2 text-xs">{aiDiffLabel(row.aiDiff)}</td>
                    <td className="px-3 py-2 text-xs">
                      {eventLabel(row.lastEvent)}
                      <div className="text-muted-foreground">{formatTime(row.lastEvent?.at ?? row.updatedAt)}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <Button variant="ghost" size="sm" disabled={row.versions.total === 0} onClick={() => setHistoryCode(row.code)}>
                        <History /> 历史
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    没有符合筛选条件的成果
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <ArtifactHistorySheet project={project} code={historyCode} onClose={() => setHistoryCode(null)} />
    </div>
  );
}
