import { History, Lock, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { toast } from "sonner";

import {
  type Actor,
  type StrategyContent,
  emptyStrategyContent,
  getArtifactDef,
  isArtifactCode,
  validateArtifact,
} from "@dingze/shared";

import { StatusBadge } from "@/components/dingze/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { nextStep, workspacePath } from "@/lib/dingze/progress";
import { useArtifactDetail, useSaveArtifact } from "@/lib/dingze/queries";

import { errorMessage } from "@/lib/dingze/errors";

import { ArtifactActions, DissentList } from "./components/artifact-actions";
import { StepBar } from "./components/step-bar";
import { ValidationBar } from "./components/validation-bar";
import { StrategyContentEditor } from "./editors/strategy-content-editor";
import { useProjectContext } from "./project-context";

const EDITABLE_CODES = new Set(["S1-01"]);
const ENTERPRISE_ROLES = ["ent_lead", "dept_head", "member"];
const CONSULTANT_ROLES = ["lead_consultant", "co_consultant"];

export default function WorkspacePage() {
  const { project, overview } = useProjectContext();
  const params = useParams();

  if (!params.code) {
    const next = nextStep(overview.artifacts);
    return <Navigate to={workspacePath(project.id, next?.code ?? "S1-01")} replace />;
  }
  if (!isArtifactCode(params.code)) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>没有这张成果表</AlertTitle>
          <AlertDescription>
            <Link to={workspacePath(project.id, "S1-01")} className="underline">回到第一张表</Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return <Workspace key={params.code} code={params.code} />;
}

function emptyPayload(code: string, primary: "house" | "sixfold"): unknown {
  if (code === "S1-01") return emptyStrategyContent(primary);
  return null;
}

function Workspace({ code }: { code: string }) {
  const { project, overview } = useProjectContext();
  const def = getArtifactDef(code);
  const detail = useArtifactDetail(project, code);
  const save = useSaveArtifact(project, code);

  const artifact = detail.data?.artifact ?? null;
  const serverPayload = artifact?.currentVersion?.payload ?? emptyPayload(code, project.primaryExpression);
  const serverRev = artifact?.currentRev ?? 0;
  const [draft, setDraft] = useState<unknown>(serverPayload);
  const [baseRev, setBaseRev] = useState(serverRev);
  const dirty = JSON.stringify(draft) !== JSON.stringify(serverPayload);

  // Adopt the server version when it changes and nothing local is pending.
  useEffect(() => {
    if (!dirty || serverRev !== baseRev) {
      setDraft(serverPayload);
      setBaseRev(serverRev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRev, detail.dataUpdatedAt]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const issues = useMemo(() => (draft ? validateArtifact(code, draft) : []), [code, draft]);
  const blocking = issues.filter((i) => i.level === "error").length;

  const role = overview.projectRole;
  const actor: Actor = { projectRole: role, isConsultAdmin: overview.isConsultAdmin };
  const status = artifact?.status ?? "not_started";
  const unlocked = detail.data?.unlock.unlocked ?? false;
  const canEditRole = !!role && (ENTERPRISE_ROLES.includes(role) || CONSULTANT_ROLES.includes(role));
  const consultantInReview = status === "in_review" && !!role && CONSULTANT_ROLES.includes(role);
  const readOnly =
    !canEditRole || !unlocked || status === "locked" || status === "archived" || (status === "in_review" && !consultantInReview);

  const onSave = () =>
    save.mutate(
      { payload: draft, baseRev },
      {
        onSuccess: (result) => {
          setBaseRev(result.rev);
          toast.success(`已保存 v${result.rev}`);
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );

  return (
    <div className="flex flex-1 flex-wrap items-stretch">
      <aside className="w-full border-b bg-card p-4 md:w-[300px] md:border-r md:border-b-0">
        <StepBar projectId={project.id} artifacts={overview.artifacts} stage={def.stage} activeCode={code} />
      </aside>

      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-4 md:p-6">
        <div className="text-xs text-muted-foreground">
          {def.task} › {def.step}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-heading text-2xl font-bold text-brand">《{def.name}》</h1>
          <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            {def.specId} · {def.bookRef}
          </span>
          {artifact ? <StatusBadge status={status} stale={artifact.stale} /> : null}
          {artifact?.currentRev ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <History className="size-3.5" /> 当前 v{artifact.currentRev}
              {artifact.lockedVersion ? ` · 定版 v${artifact.lockedVersion.rev}` : ""}
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            {!readOnly && EDITABLE_CODES.has(code) ? (
              <Button variant="outline" onClick={onSave} disabled={!dirty || save.isPending}>
                <Save /> {dirty ? "保存" : "已保存"}
              </Button>
            ) : null}
            {detail.data ? (
              <ArtifactActions
                project={project}
                code={code}
                title={def.name}
                detail={detail.data}
                actor={actor}
                dirty={dirty}
                blocking={blocking}
              />
            ) : null}
          </div>
        </div>

        {detail.isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : detail.error ? (
          <Alert variant="destructive">
            <AlertTitle>成果加载失败</AlertTitle>
            <AlertDescription>{errorMessage(detail.error)}</AlertDescription>
          </Alert>
        ) : !unlocked ? (
          <Alert>
            <Lock />
            <AlertTitle>这一步还没解锁</AlertTitle>
            <AlertDescription>{detail.data?.unlock.waitingFor}</AlertDescription>
          </Alert>
        ) : (
          <>
            {artifact?.stale ? (
              <Alert className="border-destructive/30 bg-status-stale text-status-stale-foreground">
                <AlertTitle>上游已变更</AlertTitle>
                <AlertDescription className="text-status-stale-foreground">
                  {artifact.staleReason}。核对后保存一次，即视为已按新版本更新。
                </AlertDescription>
              </Alert>
            ) : null}
            {status === "locked" ? (
              <Alert className="border-brand bg-brand text-brand-foreground">
                <Lock />
                <AlertTitle>已定版 v{artifact?.lockedVersion?.rev}</AlertTitle>
                <AlertDescription className="text-brand-foreground/85">
                  只读。修改需由主咨询师解锁重开，下游会标“上游已变更”。
                </AlertDescription>
              </Alert>
            ) : status === "pending_confirm" && !readOnly ? (
              <Alert>
                <AlertTitle>正在等企业确认</AlertTitle>
                <AlertDescription>现在修改会生成新版本，需要重新提交复核。</AlertDescription>
              </Alert>
            ) : null}

            {code === "S1-01" ? (
              <StrategyContentEditor
                value={draft as StrategyContent}
                onChange={setDraft}
                readOnly={readOnly}
                issues={issues}
                canChangePrimary={role === "ent_lead" || role === "lead_consultant"}
              />
            ) : (
              <Alert>
                <AlertTitle>这张表的编辑器在后续里程碑交付</AlertTitle>
                <AlertDescription>
                  当前里程碑先打通定战略责第一张表（S1-01）的完整流程；其余成果表按计划在 M1–M3 交付。
                </AlertDescription>
              </Alert>
            )}

            {EDITABLE_CODES.has(code) ? <ValidationBar issues={issues} hasRules /> : null}
            {detail.data && (status === "pending_confirm" || status === "locked" || detail.data.dissents.length > 0) ? (
              <DissentList detail={detail.data} project={project} code={code} />
            ) : null}
          </>
        )}
      </main>

      <aside aria-label="书中方法" className="w-full border-t bg-card p-4 lg:w-[340px] lg:border-t-0 lg:border-l">
        <div className="rounded-xl border border-book-border bg-book p-4 text-sm text-book-foreground">
          <div className="font-heading text-base font-bold">书中方法</div>
          <dl className="mt-2 flex flex-col gap-2">
            <div>
              <dt className="text-xs opacity-80">工作任务</dt>
              <dd>{def.task}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-80">实施步骤</dt>
              <dd>{def.step}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-80">工具 / 成果</dt>
              <dd>{def.bookRef}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
