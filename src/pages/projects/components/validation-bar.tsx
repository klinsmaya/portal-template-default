import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

import type { Issue } from "@dingze/shared";

import { cn } from "@/lib/utils";

/** Errors block “本步完成” and confirmation; warnings never block (Q3). */
export function ValidationBar({ issues, hasRules }: { issues: Issue[]; hasRules: boolean }) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  if (!hasRules) return null;

  return (
    <section
      role="status"
      aria-label="校验结果"
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-sm",
        errors.length
          ? "border-destructive/30 bg-status-stale text-status-stale-foreground"
          : "border-status-done-foreground/20 bg-status-done text-status-done-foreground"
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        {errors.length ? <CircleAlert className="size-4" /> : <CircleCheck className="size-4" />}
        {errors.length ? `还差 ${errors.length} 处才能“本步完成”——草稿可以先保存` : "结构校验通过"}
      </div>
      {errors.length ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {errors.slice(0, 8).map((issue, i) => (
            <li key={`${issue.anchor}-${i}`}>{issue.message}</li>
          ))}
          {errors.length > 8 ? <li>……另有 {errors.length - 8} 处</li> : null}
        </ul>
      ) : null}
      {warnings.length ? (
        <div className="flex items-start gap-2 text-xs opacity-90">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>提示（不阻断）：{warnings.slice(0, 3).map((w) => w.message).join("；")}{warnings.length > 3 ? ` 等 ${warnings.length} 条` : ""}</span>
        </div>
      ) : null}
    </section>
  );
}
