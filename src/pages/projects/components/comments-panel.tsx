import { AtSign, Check, CornerDownRight, LocateFixed, MessageSquarePlus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectSummary, ProjectTeamMember } from "@/lib/dingze/api";
import { anchorOptions } from "@/lib/dingze/comment-anchors";
import { type CommentThread, useAddComment, useComments, useResolveComment } from "@/lib/dingze/comments-api";
import { errorMessage } from "@/lib/dingze/errors";
import { anchorCandidates, locateAnchor } from "@/lib/dingze/locate";
import { formatTime } from "@/lib/dingze/records";
import { cn } from "@/lib/utils";

const WHOLE = "__whole__";

function MentionPicker({ team, value, onChange }: { team: ProjectTeamMember[]; value: number[]; onChange: (next: number[]) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <NativeSelect
        size="sm"
        aria-label="提到成员"
        value=""
        onChange={(e) => {
          const id = Number(e.target.value);
          if (id && !value.includes(id)) onChange([...value, id]);
        }}
      >
        <NativeSelectOption value="">＠ 提到成员</NativeSelectOption>
        {team
          .filter((m) => !value.includes(m.userId))
          .map((m) => (
            <NativeSelectOption key={m.userId} value={String(m.userId)}>
              {m.nickname}
            </NativeSelectOption>
          ))}
      </NativeSelect>
      {value.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1">
          <AtSign className="size-3" />
          {team.find((m) => m.userId === id)?.nickname ?? id}
          <button type="button" aria-label="移除" className="ml-0.5" onClick={() => onChange(value.filter((x) => x !== id))}>
            ×
          </button>
        </Badge>
      ))}
    </div>
  );
}

function Thread({
  thread,
  team,
  canComment,
  canResolve,
  highlighted,
  onReply,
  onResolve,
}: {
  thread: CommentThread;
  team: ProjectTeamMember[];
  canComment: boolean;
  canResolve: boolean;
  highlighted: boolean;
  onReply: (content: string, mentions: number[]) => Promise<unknown>;
  onResolve: (resolved: boolean) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<number[]>([]);
  const name = (id: number) => team.find((m) => m.userId === id)?.nickname ?? "";
  const body = (c: { content: string; mentions: number[] }) => (
    <p className="whitespace-pre-wrap">
      {c.mentions.length ? <span className="mr-1 text-brand">{c.mentions.map((id) => `@${name(id)}`).join(" ")}</span> : null}
      {c.content}
    </p>
  );
  return (
    <li id={`comment-${thread.id}`} className={cn("rounded-lg border bg-card p-3 text-sm", thread.resolved && "opacity-70", highlighted && "ring-2 ring-gold")}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {thread.anchor ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-foreground hover:bg-accent"
            title="定位到这一行"
            onClick={() => {
              if (!locateAnchor(thread.anchor!)) toast.info("这一行已删除，或当前没有展开");
            }}
          >
            <LocateFixed className="size-3" />
            {thread.anchorLabel || thread.anchor}
          </button>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5">整张表</span>
        )}
        <span className="font-medium text-foreground">{thread.author}</span>
        <span>{formatTime(thread.at)}</span>
        {thread.rev ? <span>v{thread.rev}</span> : null}
        {thread.resolved ? <Badge variant="outline">已解决</Badge> : null}
      </div>
      {body(thread)}
      {thread.replies.length ? (
        <ul className="mt-2 flex flex-col gap-2 border-l-2 pl-3">
          {thread.replies.map((r) => (
            <li key={r.id}>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.author}</span> · {formatTime(r.at)}
              </div>
              {body(r)}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {canComment ? (
          <Button variant="ghost" size="sm" onClick={() => setReplying((v) => !v)}>
            <CornerDownRight /> 回复
          </Button>
        ) : null}
        {canResolve ? (
          <Button variant="ghost" size="sm" onClick={() => onResolve(!thread.resolved)}>
            {thread.resolved ? (
              <>
                <RotateCcw /> 重新打开
              </>
            ) : (
              <>
                <Check /> 标记解决
              </>
            )}
          </Button>
        ) : null}
      </div>
      {replying ? (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            await onReply(text.trim(), mentions);
            setText("");
            setMentions([]);
            setReplying(false);
          }}
        >
          <Textarea aria-label="回复内容" value={text} onChange={(e) => setText(e.target.value)} placeholder="回复…" className="min-h-16" />
          <MentionPicker team={team} value={mentions} onChange={setMentions} />
          <Button type="submit" size="sm" disabled={!text.trim()} className="self-end">
            发送回复
          </Button>
        </form>
      ) : null}
    </li>
  );
}

/** 批注: threads pinned to a row or field (or the whole table), with replies, @mentions and resolve. */
export function CommentsPanel({
  project,
  code,
  payload,
  team,
  canComment,
  canResolveAny,
  currentUserId,
  focusAnchor,
  highlightId,
}: {
  project: ProjectSummary;
  code: string;
  payload: unknown;
  team: ProjectTeamMember[];
  canComment: boolean;
  canResolveAny: boolean;
  currentUserId: number | null;
  /** The row the user last clicked into; the new comment defaults to it. */
  focusAnchor: string | null;
  highlightId: number | null;
}) {
  const comments = useComments(project, code);
  const add = useAddComment(project, code);
  const resolve = useResolveComment(project, code);
  const options = useMemo(() => anchorOptions(payload), [payload]);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [anchor, setAnchor] = useState<string>(WHOLE);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<number[]>([]);

  useEffect(() => {
    if (!focusAnchor) return;
    const match = anchorCandidates(focusAnchor).find((c) => options.some((o) => o.id === c));
    if (match) setAnchor(match);
  }, [focusAnchor, options]);

  useEffect(() => {
    if (!highlightId || !comments.data) return;
    document.getElementById(`comment-${highlightId}`)?.scrollIntoView({ block: "nearest" });
    const thread = comments.data.find((t) => t.id === highlightId);
    if (thread?.anchor) window.setTimeout(() => locateAnchor(thread.anchor!), 300);
  }, [highlightId, comments.data]);

  const threads = (comments.data ?? []).filter((t) => filter === "all" || !t.resolved || t.id === highlightId);
  const open = (comments.data ?? []).filter((t) => !t.resolved).length;
  const fail = (error: unknown) => toast.error(errorMessage(error));

  return (
    <div className="flex flex-col gap-3">
      {canComment ? (
        <form
          className="flex flex-col gap-2 rounded-xl border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            const option = options.find((o) => o.id === anchor);
            add.mutate(
              { anchor: anchor === WHOLE ? null : anchor, anchorLabel: option?.label ?? "", content: text.trim(), mentions },
              {
                onSuccess: () => {
                  setText("");
                  setMentions([]);
                  toast.success("批注已发出");
                },
                onError: fail,
              }
            );
          }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquarePlus className="size-4" /> 批注到
            <NativeSelect size="sm" aria-label="批注到" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="min-w-0 flex-1">
              <NativeSelectOption value={WHOLE}>整张表</NativeSelectOption>
              {options.map((o) => (
                <NativeSelectOption key={o.id} value={o.id}>
                  {o.group} · {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Textarea aria-label="批注内容" value={text} onChange={(e) => setText(e.target.value)} placeholder="写下意见或问题；先点一下表格里的行，可直接批注到那一行" className="min-h-20" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MentionPicker team={team} value={mentions} onChange={setMentions} />
            <Button type="submit" size="sm" disabled={!text.trim() || add.isPending}>
              发出批注
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold">批注</span>
        <span className="text-muted-foreground">未解决 {open} 条</span>
        <NativeSelect size="sm" aria-label="批注筛选" value={filter} onChange={(e) => setFilter(e.target.value as "open" | "all")} className="ml-auto">
          <NativeSelectOption value="open">只看未解决</NativeSelectOption>
          <NativeSelectOption value="all">全部</NativeSelectOption>
        </NativeSelect>
      </div>

      {comments.isLoading ? (
        <Skeleton className="h-24" />
      ) : threads.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{filter === "open" ? "没有未解决的批注" : "还没有批注"}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {threads.map((t) => (
            <Thread
              key={t.id}
              thread={t}
              team={team}
              canComment={canComment}
              canResolve={canResolveAny || t.authorId === currentUserId}
              highlighted={t.id === highlightId}
              onReply={(content, m) => add.mutateAsync({ parentId: t.id, content, mentions: m }).catch(fail)}
              onResolve={(resolved) => resolve.mutate({ id: t.id, resolved }, { onError: fail })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Marks rows that carry unresolved comments, without touching every editor. */
export function CommentMarkers({ anchors }: { anchors: string[] }) {
  if (!anchors.length) return null;
  const css = anchors
    .map((a) => `[data-dingze-main] [data-anchor="${a.replace(/["\\\\]/g, "")}"]`)
    .join(",\n");
  return <style>{`${css} { box-shadow: inset 3px 0 0 var(--gold); }`}</style>;
}
