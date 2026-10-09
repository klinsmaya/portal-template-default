import { ArrowRight, CircleCheck } from "lucide-react";
import { Link } from "react-router";

import { StatusBadge, StatusDot } from "@/components/dingze/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STEP_ARTIFACTS, nextStep, stageProgress, todosFor, workspacePath } from "@/lib/dingze/progress";
import { cn } from "@/lib/utils";

import { useProjectContext } from "./project-context";

const TODO_STYLES = {
  confirm: "bg-status-confirm text-status-confirm-foreground",
  review: "bg-status-review text-status-review-foreground",
  stale: "bg-status-stale text-status-stale-foreground",
  returned: "bg-status-stale text-status-stale-foreground",
} as const;

const TODO_LABELS = { confirm: "待你确认", review: "待你复核", stale: "上游已变更", returned: "已退回" } as const;

export default function ProjectOverviewPage() {
  const { project, overview } = useProjectContext();
  const artifacts = overview.artifacts;
  const byCode = new Map(artifacts.map((a) => [a.code, a]));
  const next = nextStep(artifacts);
  const stages = stageProgress(artifacts);
  const todos = todosFor(artifacts, overview.projectRole);

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-6 md:px-7">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {project.year} 年度 · {project.scene === "camp" ? "训练营" : "企业内训"}
          </p>
          <h1 className="font-heading text-3xl font-bold text-brand">往哪打 · 怎么走 · 谁负责</h1>
        </div>
        {next ? (
          <Link
            to={workspacePath(project.id, next.code)}
            className="ml-auto flex min-w-64 flex-col rounded-xl bg-primary px-5 py-3 text-primary-foreground hover:bg-primary/90"
          >
            <span className="text-xs opacity-80">下一步</span>
            <span className="flex items-center gap-2 font-bold">
              继续：{next.specId} {next.name} <ArrowRight className="size-4" />
            </span>
          </Link>
        ) : null}
      </div>

      <section aria-label="三阶段进度" className="grid gap-4 lg:grid-cols-3">
        {stages.map((stage) => (
          <Card key={stage.stage} className={cn(stage.open && !stage.complete && "border-primary ring-3 ring-accent")}>
            <CardHeader className="gap-2">
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-lg text-brand">{stage.name}</CardTitle>
                <span className="text-xs text-muted-foreground">{stage.goal}</span>
                <span className="ml-auto text-xs font-semibold text-muted-foreground">
                  {stage.complete ? "已完成" : stage.open ? "进行中" : "待解锁"}
                </span>
              </div>
              <Progress value={(stage.locked / stage.gateTotal) * 100} aria-label={`${stage.name}定版进度`} />
              <p className="text-xs text-muted-foreground">
                P0 成果已定版 {stage.locked} / {stage.gateTotal}
                {stage.open ? "" : " · 上一阶段全部定版后开启"}
              </p>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1">
                {STEP_ARTIFACTS.filter((a) => a.stage === stage.stage).map((def) => {
                  const a = byCode.get(def.code);
                  const status = a?.status ?? "not_started";
                  return (
                    <li key={def.code}>
                      <Link
                        to={workspacePath(project.id, def.code)}
                        className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted"
                      >
                        <StatusDot status={status} />
                        <span className="min-w-0 flex-1 truncate">
                          {def.specId} {def.name}
                          {def.priority === "P1" ? <span className="ml-1 text-xs text-muted-foreground">（可选）</span> : null}
                        </span>
                        {a?.unlock.unlocked ? (
                          <StatusBadge status={status} stale={a.stale} />
                        ) : (
                          <span className="text-xs text-muted-foreground">待解锁</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">需要你处理 · {todos.length}</CardTitle>
        </CardHeader>
        <CardContent>
          {todos.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleCheck className="size-4 text-status-done-foreground" /> 目前没有等你处理的事项。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todos.map((todo) => (
                <li key={`${todo.kind}-${todo.code}`}>
                  <Link
                    to={workspacePath(project.id, todo.code)}
                    className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 hover:border-primary"
                  >
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", TODO_STYLES[todo.kind])}>
                      {TODO_LABELS[todo.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{todo.title}</span>
                      <span className="block text-xs text-muted-foreground">{todo.description}</span>
                    </span>
                    <ArrowRight className="size-4 text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

