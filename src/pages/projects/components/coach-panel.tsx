import { useEffect, useMemo } from "react";

import {
  AIChatWindow,
  AIToolRendererProvider,
  ChatInline,
  type AIToolRendererMap,
  type AIToolRendererProps,
} from "@/extensions/nocobase-ai/components";
import {
  AIChatProvider,
  useAI,
  useAIChatBase,
  useAIChatController,
  useAIPageContextScope,
} from "@/extensions/nocobase-ai/providers";
import type { StageKey } from "@dingze/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type ProposedChange, describeValue } from "@/lib/dingze/changes";
import { COACH_BY_STAGE, PROPOSE_TOOL } from "@/lib/dingze/coach";

type ProposalArgs = { summary?: string; changes?: ProposedChange[] };

function readProposal(part: AIToolRendererProps["part"]): {
  toolId?: string;
  args: ProposalArgs;
} {
  const input =
    (part as { input?: { toolId?: string; args?: ProposalArgs } }).input ?? {};
  return { toolId: input.toolId, args: input.args ?? {} };
}

/**
 * NocoBase streams the tool result back as the bare `content` string, with the
 * frontend tool's `status` (or a rejection) kept on the call's provider metadata.
 */
function readOutcome(part: AIToolRendererProps["part"]) {
  const { state, output, errorText } = part as {
    state?: string;
    output?: unknown;
    errorText?: string;
  };
  const meta = (
    part as { callProviderMetadata?: { nocobase?: Record<string, unknown> } }
  ).callProviderMetadata?.nocobase;
  const result =
    output && typeof output === "object"
      ? (output as { status?: string; content?: string })
      : undefined;
  const message =
    typeof output === "string" ? output : (result?.content ?? errorText);
  const status = String(result?.status ?? meta?.status ?? "").toLowerCase();
  const invoke = String(meta?.invokeStatus ?? "").toLowerCase();
  const ok =
    state === "output-available" &&
    status !== "error" &&
    !invoke.startsWith("reject");
  return { ok, message };
}

/**
 * The suggestion card for `dingzeProposeChanges`: dashed amber while waiting, and the
 * change is only written after the user presses “确认写入”.
 */
function SuggestionCard({
  part,
  disabled,
  onApprove,
  onReject,
  onRevise,
}: AIToolRendererProps) {
  const { args } = readProposal(part);
  const state = (part as { state?: string }).state;
  const decided =
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied";
  const changes = args.changes ?? [];

  if (decided) {
    const { ok, message } = readOutcome(part);
    return (
      <div className="rounded-xl border bg-card p-3 text-sm">
        <div
          className={
            ok
              ? "text-xs font-bold text-status-done-foreground"
              : "text-xs font-bold text-muted-foreground"
          }
        >
          {ok ? "已写入" : "未写入"}
        </div>
        <div className={ok ? "" : "text-muted-foreground line-through"}>
          {args.summary ?? changes.map((c) => c.label ?? c.path).join("、")}
        </div>
        {message ? (
          <div className="mt-1 text-xs text-muted-foreground">{message}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-suggestion-border bg-suggestion p-3 text-sm">
      <div className="flex justify-between text-xs font-bold text-suggestion-foreground">
        <span>建议写入{args.summary ? ` · ${args.summary}` : ""}</span>
        <span>待你确认</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {changes.map((change, i) => (
          <li key={`${change.path}-${i}`}>
            <div className="text-xs text-suggestion-foreground">
              {change.label ?? change.path}
            </div>
            <div className="font-semibold text-foreground">
              {describeValue(change.value)}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={disabled} onClick={() => onApprove()}>
          确认写入
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onRevise()}
        >
          改一改再写
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => onReject("用户不采纳这条建议")}
        >
          不采纳
        </Button>
      </div>
    </div>
  );
}

function ProposalRenderer(props: AIToolRendererProps) {
  const { toolId } = readProposal(props.part);
  if (toolId?.endsWith(`:${PROPOSE_TOOL}`))
    return <SuggestionCard {...props} />;
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      页面工具 {toolId ?? ""}
    </div>
  );
}

const RENDERERS: AIToolRendererMap = {
  executeFrontendTool: {
    component: ProposalRenderer,
    handlesApproval: true,
    standalone: true,
  },
};

/**
 * Typed messages only carry context explicitly attached to the composer, and that is
 * cleared after every send; keep the open artifact attached so the consultant always
 * reads the live draft (the user can still remove the chip for one message).
 */
function AttachPageContext() {
  const pageContext = useAIPageContextScope();
  const { workContext, addWorkContext } = useAIChatBase();
  const empty = workContext.length === 0;
  useEffect(() => {
    if (empty) pageContext.forEach(addWorkContext);
  }, [empty, pageContext, addWorkContext]);
  return null;
}

/** Right column of the workspace: the stage's digital consultant, scoped to this page. */
export function CoachPanel({
  stage,
  chatId,
}: {
  stage: StageKey;
  chatId: string;
}) {
  const ai = useAI();
  const controller = useAIChatController();
  const employee = COACH_BY_STAGE[stage];
  const available = useMemo(
    () => ai.employees.some((e) => e.username === employee),
    [ai.employees, employee],
  );

  if (!available) {
    return (
      <Alert>
        <AlertTitle>数字咨询师暂不可用</AlertTitle>
        <AlertDescription>
          当前账号没有可用的数字咨询师，或大模型服务尚未配置。表格可以照常填写。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <AIToolRendererProvider renderers={RENDERERS}>
      <AIChatProvider
        id={chatId}
        controller={controller}
        defaultEmployee={employee}
      >
        <AttachPageContext />
        <ChatInline className="h-[calc(100svh-9rem)] min-h-[520px] rounded-xl bg-card">
          <AIChatWindow
            showConversationToggle
            showEmployeeSelector={false}
            showModelSelector={false}
            disclaimer="建议需你确认后才写入成果"
            placeholder="回答数字咨询师，或直接说你的想法…"
          />
        </ChatInline>
      </AIChatProvider>
    </AIToolRendererProvider>
  );
}
