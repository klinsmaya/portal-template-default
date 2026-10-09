import { History, Lock, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { toast } from "sonner";

import {
  type Actor,
  getArtifactDef,
  isArtifactCode,
  validateArtifact,
} from "@dingze/shared";

import { useAIPageElementHandle } from "@/extensions/nocobase-ai/components";
import {
  AIPageContextScope,
  defineAIFrontendTool,
} from "@/extensions/nocobase-ai/providers";

import { StatusBadge } from "@/components/dingze/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { nextStep, workspacePath } from "@/lib/dingze/progress";
import { useArtifactDetail, useSaveArtifact, useUpstreamPayloads } from "@/lib/dingze/queries";

import { EDITABLE_CODES, emptyPayload } from "@/lib/dingze/artifact-payloads";
import { type ProposedChange, applyChanges } from "@/lib/dingze/changes";
import { PROPOSE_TOOL } from "@/lib/dingze/coach";
import { errorMessage } from "@/lib/dingze/errors";

import { ArtifactActions, DissentList } from "./components/artifact-actions";
import { CoachPanel } from "./components/coach-panel";
import { ExportButton } from "./components/export-button";
import { PlanBookExportButton } from "./components/plan-book-export";
import { StepBar } from "./components/step-bar";
import { ValidationBar } from "./components/validation-bar";
import { ArtifactEditor } from "./editors/artifact-editor";
import { useProjectContext } from "./project-context";

const ENTERPRISE_ROLES = ["ent_lead", "dept_head", "member"];
const CONSULTANT_ROLES = ["lead_consultant", "co_consultant"];

export default function WorkspacePage() {
  const { project, overview } = useProjectContext();
  const params = useParams();

  if (!params.code) {
    const next = nextStep(overview.artifacts);
    return (
      <Navigate to={workspacePath(project.id, next?.code ?? "S1-01")} replace />
    );
  }
  if (!isArtifactCode(params.code)) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>没有这张成果表</AlertTitle>
          <AlertDescription>
            <Link to={workspacePath(project.id, "S1-01")} className="underline">
              回到第一张表
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return <Workspace key={params.code} code={params.code} />;
}

function Workspace({ code }: { code: string }) {
  const { project, overview } = useProjectContext();
  const def = getArtifactDef(code);
  const detail = useArtifactDetail(project, code);
  const save = useSaveArtifact(project, code);
  const upstream = useUpstreamPayloads(project, def.dependsOn).payloads;

  const artifact = detail.data?.artifact ?? null;
  const serverPayload =
    artifact?.currentVersion?.payload ?? emptyPayload(code, project);
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

  const issues = useMemo(
    () => (draft ? validateArtifact(code, draft, upstream) : []),
    [code, draft, upstream],
  );
  const blocking = issues.filter((i) => i.level === "error").length;

  const role = overview.projectRole;
  const actor: Actor = {
    projectRole: role,
    isConsultAdmin: overview.isConsultAdmin,
  };
  const status = artifact?.status ?? "not_started";
  const unlocked = detail.data?.unlock.unlocked ?? false;
  const canEditRole =
    !!role &&
    (ENTERPRISE_ROLES.includes(role) || CONSULTANT_ROLES.includes(role));
  const consultantInReview =
    status === "in_review" && !!role && CONSULTANT_ROLES.includes(role);
  const readOnly =
    !canEditRole ||
    !unlocked ||
    status === "locked" ||
    status === "archived" ||
    (status === "in_review" && !consultantInReview);

  const onSave = () =>
    save.mutate(
      { payload: draft, baseRev },
      {
        onSuccess: (result) => {
          setBaseRev(result.rev);
          toast.success(`已保存 v${result.rev}`);
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  // The digital consultant reads the live draft and proposes changes through a frontend
  // tool; the change is written (as an AI-suggested version) only after the user approves.
  const latest = useRef({
    draft,
    baseRev,
    readOnly,
    editable: EDITABLE_CODES.has(code),
  });
  latest.current = {
    draft,
    baseRev,
    readOnly,
    editable: EDITABLE_CODES.has(code),
  };
  const saveRef = useRef(save.mutateAsync);
  saveRef.current = save.mutateAsync;
  const tools = useMemo(
    () => [
      defineAIFrontendTool({
        name: PROPOSE_TOOL,
        title: "建议写入成果表",
        description:
          "把与用户在对话中达成一致的内容写入当前成果表。每条 change 的 path 用点号分隔，数组条目用 id 定位，追加用 +（如 goals.y3、battlefields.b1.mustWin、battlefields.+）；label 是给用户看的格子名称。用户确认后才会写入。",
        permission: "ASK",
        inputSchema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "一句话说明这次建议写入什么",
            },
            changes: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  label: { type: "string" },
                  value: {},
                },
                required: ["path", "label", "value"],
              },
            },
          },
          required: ["summary", "changes"],
        },
        execute: async (args: unknown) => {
          const {
            draft: current,
            baseRev: rev,
            readOnly: locked,
            editable,
          } = latest.current;
          if (!editable)
            return {
              status: "error",
              content: "这张表的编辑器尚未上线，请让用户在线下记录。",
            };
          if (locked)
            return {
              status: "error",
              content: "当前用户不能修改这张表（未解锁、已定版或在复核中）。",
            };
          const changes = (args as { changes?: ProposedChange[] })?.changes;
          if (!Array.isArray(changes) || changes.length === 0)
            return { status: "error", content: "没有要写入的内容。" };
          try {
            const next = applyChanges(current, changes);
            const result = await saveRef.current({
              payload: next,
              baseRev: rev,
              aiSuggested: true,
            });
            setDraft(next);
            setBaseRev(result.rev);
            toast.success(`已按建议写入 v${result.rev}`);
            return {
              status: "success",
              content: `已写入成果表，当前版本 v${result.rev}。`,
            };
          } catch (error) {
            return { status: "error", content: errorMessage(error) };
          }
        },
      }),
    ],
    [],
  );
  const page = useAIPageElementHandle({
    id: `dingze-artifact-${code}`,
    title: `《${def.name}》`,
    kind: "record-detail",
    tools,
    getContext: () => ({
      projectId: project.id,
      projectName: project.name,
      enterprise: project.enterprise?.name,
      primaryExpression: project.primaryExpression,
      artifact: {
        code,
        name: def.name,
        stage: def.stage,
        task: def.task,
        step: def.step,
        bookRef: def.bookRef,
      },
      status,
      currentRev: latest.current.baseRev,
      userCanEdit: !latest.current.readOnly && latest.current.editable,
      projectRole: role,
      draft: latest.current.draft,
      issues: latest.current.draft
        ? validateArtifact(code, latest.current.draft, upstream)
        : [],
    }),
  });

  return (
    <AIPageContextScope context={page.context}>
      <div className="flex flex-1 flex-wrap items-stretch">
        <aside className="w-full border-b bg-card p-4 md:w-[300px] md:border-r md:border-b-0">
          <StepBar
            projectId={project.id}
            artifacts={overview.artifacts}
            stage={def.stage}
            activeCode={code}
          />
        </aside>

        <main
          ref={page.ref}
          className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-4 md:p-6"
        >
          <div className="text-xs text-muted-foreground">
            {def.task} › {def.step}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-heading text-2xl font-bold text-brand">
              《{def.name}》
            </h1>
            <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
              {def.specId} · {def.bookRef}
            </span>
            {artifact ? (
              <StatusBadge status={status} stale={artifact.stale} />
            ) : null}
            {artifact?.currentRev ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <History className="size-3.5" /> 当前 v{artifact.currentRev}
                {artifact.lockedVersion
                  ? ` · 定版 v${artifact.lockedVersion.rev}`
                  : ""}
              </span>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <ExportButton
                code={code}
                name={def.name}
                payload={artifact?.currentVersion?.payload}
                rev={artifact?.currentRev ?? 0}
                status={status}
                enterprise={project.enterprise?.shortName ?? "企业"}
                projectName={project.name}
                upstream={upstream}
                dirty={dirty}
              />
              <PlanBookExportButton
                code={code}
                payload={artifact?.currentVersion?.payload}
                rev={artifact?.currentRev ?? 0}
                status={status}
                enterprise={project.enterprise?.name ?? "企业"}
                year={project.year}
                upstream={upstream}
                dirty={dirty}
              />
              {!readOnly && EDITABLE_CODES.has(code) ? (
                <Button
                  variant="outline"
                  onClick={onSave}
                  disabled={!dirty || save.isPending}
                >
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
              <AlertDescription>
                {detail.data?.unlock.waitingFor}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {artifact?.stale ? (
                <Alert className="border-destructive/30 bg-status-stale text-status-stale-foreground">
                  <AlertTitle>上游已变更</AlertTitle>
                  <AlertDescription className="text-status-stale-foreground">
                    {artifact.staleReason}
                    。核对后保存一次，即视为已按新版本更新。
                  </AlertDescription>
                </Alert>
              ) : null}
              {status === "locked" ? (
                <Alert className="border-brand bg-brand text-brand-foreground">
                  <Lock />
                  <AlertTitle>
                    已定版 v{artifact?.lockedVersion?.rev}
                  </AlertTitle>
                  <AlertDescription className="text-brand-foreground/85">
                    只读。修改需由主咨询师解锁重开，下游会标“上游已变更”。
                  </AlertDescription>
                </Alert>
              ) : status === "pending_confirm" && !readOnly ? (
                <Alert>
                  <AlertTitle>正在等企业确认</AlertTitle>
                  <AlertDescription>
                    现在修改会生成新版本，需要重新提交复核。
                  </AlertDescription>
                </Alert>
              ) : null}

              {EDITABLE_CODES.has(code) ? (
                <ArtifactEditor
                  code={code}
                  value={draft}
                  onChange={setDraft}
                  readOnly={readOnly}
                  issues={issues}
                  upstream={upstream}
                  projectYear={project.year}
                  canChangePrimary={role === "ent_lead" || role === "lead_consultant"}
                  keyProjectLevel={project.keyProjectLevel}
                  orgUnits={overview.orgUnits ?? []}
                  team={overview.team ?? []}
                  scheduleScale={project.scheduleScale}
                  enterprise={project.enterprise?.name ?? "企业"}
                />
              ) : (
                <Alert>
                  <AlertTitle>这张表暂无在线编辑器</AlertTitle>
                  <AlertDescription>请按方法手册在线下完成，成果以附件形式由咨询师归档。</AlertDescription>
                </Alert>
              )}

              {EDITABLE_CODES.has(code) ? (
                <ValidationBar issues={issues} hasRules />
              ) : null}
              {detail.data &&
              (status === "pending_confirm" ||
                status === "locked" ||
                detail.data.dissents.length > 0) ? (
                <DissentList
                  detail={detail.data}
                  project={project}
                  code={code}
                />
              ) : null}
            </>
          )}
        </main>

        <aside
          aria-label="数字咨询师"
          data-dingze-coach
          className="flex w-full flex-col gap-3 border-t bg-card p-4 lg:w-[400px] lg:border-t-0 lg:border-l"
        >
          <details className="rounded-xl border border-book-border bg-book px-4 py-3 text-sm text-book-foreground">
            <summary className="cursor-pointer font-heading text-base font-bold">
              书中方法
            </summary>
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
          </details>
          <CoachPanel
            stage={def.stage}
            chatId={`dingze-${project.id}-${code}`}
          />
        </aside>
      </div>
    </AIPageContextScope>
  );
}
