import { Network, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { errorMessage } from "@/lib/dingze/errors";
import { type EnterpriseDetail, type OrgUnit, opsApi } from "@/lib/dingze/ops-api";
import { type OrgNode, flattenOrgUnits } from "@/lib/dingze/org-units";
import { useOpsMutation } from "@/lib/dingze/ops-queries";

import { ConfirmAction } from "./confirm-action";
import { ORG_KIND_LABELS } from "./labels";

type Draft = { id?: number; name: string; kind: OrgUnit["kind"]; parentId: number | null; headId: number | null };

export function OrgUnitsTab({ detail }: { detail: EnterpriseDetail }) {
  const enterpriseId = detail.enterprise.id;
  const nodes = useMemo(() => flattenOrgUnits(detail.orgUnits), [detail.orgUnits]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const remove = useOpsMutation(opsApi.deleteOrgUnit);
  const memberName = (id: number | null) => {
    const user = detail.members.find((m) => m.id === id);
    return user ? user.nickname || user.username : null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">部门用于成员归属、部门承接与计分卡；可按“公司 › 部门 › 团队”分层。</p>
        <Button onClick={() => setDraft({ name: "", kind: "department", parentId: null, headId: null })}>
          <Plus /> 新增部门
        </Button>
      </div>

      {nodes.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Network />
            </EmptyMedia>
            <EmptyTitle>还没有组织部门</EmptyTitle>
            <EmptyDescription>定目标责阶段的部门承接需要先建好部门。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {nodes.map((node) => (
            <li key={node.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
              <span style={{ paddingLeft: `${node.depth * 1.5}rem` }} className="flex min-w-0 flex-1 items-center gap-2">
                {node.depth > 0 ? <span className="text-muted-foreground">└</span> : null}
                <span className="truncate font-medium">{node.name}</span>
                <Badge variant="outline" className="shrink-0">
                  {ORG_KIND_LABELS[node.kind] ?? node.kind}
                </Badge>
                {memberName(node.headId) ? (
                  <span className="truncate text-xs text-muted-foreground">负责人：{memberName(node.headId)}</span>
                ) : null}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft({ name: "", kind: "team", parentId: node.id, headId: null })}
              >
                <Plus /> 下级
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`编辑 ${node.name}`}
                onClick={() => setDraft({ id: node.id, name: node.name, kind: node.kind, parentId: node.parentId, headId: node.headId })}
              >
                <Pencil />
              </Button>
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`删除 ${node.name}`} className="text-destructive">
                    <Trash2 />
                  </Button>
                }
                title={`删除“${node.name}”？`}
                description="有下级部门或仍有项目成员归属的部门不能删除。"
                confirmLabel="删除"
                destructive
                onConfirm={() =>
                  remove.mutateAsync(
                    { enterpriseId, id: node.id },
                    { onSuccess: () => toast.success("已删除"), onError: (error) => toast.error(errorMessage(error)) }
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      <OrgUnitDialog draft={draft} onClose={() => setDraft(null)} detail={detail} nodes={nodes} />
    </div>
  );
}

function OrgUnitDialog({
  draft,
  onClose,
  detail,
  nodes,
}: {
  draft: Draft | null;
  onClose: () => void;
  detail: EnterpriseDetail;
  nodes: OrgNode[];
}) {
  const [value, setValue] = useState<Draft | null>(draft);
  const [shown, setShown] = useState<Draft | null>(draft);
  if (draft !== shown) {
    setShown(draft);
    setValue(draft);
  }
  const save = useOpsMutation(opsApi.saveOrgUnit);
  const enterprisePeople = detail.members.filter((m) => m.roles.some((r) => r === "dz_ent_admin" || r === "dz_ent_member"));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value) return;
    save.mutate(
      { enterpriseId: detail.enterprise.id, ...value, name: value.name.trim() },
      {
        onSuccess: () => {
          toast.success(value.id ? "已保存" : "已新增");
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );
  };

  return (
    <Dialog open={!!draft} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{value?.id ? "编辑部门" : "新增部门"}</DialogTitle>
            <DialogDescription>{detail.enterprise.shortName}</DialogDescription>
          </DialogHeader>
          {value ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="org-name">名称</FieldLabel>
                <Input id="org-name" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="org-kind">类型</FieldLabel>
                  <NativeSelect
                    id="org-kind"
                    className="w-full"
                    value={value.kind}
                    onChange={(e) => setValue({ ...value, kind: e.target.value as OrgUnit["kind"] })}
                  >
                    {Object.entries(ORG_KIND_LABELS).map(([k, label]) => (
                      <NativeSelectOption key={k} value={k}>
                        {label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="org-parent">上级</FieldLabel>
                  <NativeSelect
                    id="org-parent"
                    className="w-full"
                    value={value.parentId ?? ""}
                    onChange={(e) => setValue({ ...value, parentId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <NativeSelectOption value="">（无）</NativeSelectOption>
                    {nodes
                      .filter((n) => n.id !== value.id)
                      .map((n) => (
                        <NativeSelectOption key={n.id} value={n.id}>
                          {"　".repeat(n.depth)}
                          {n.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="org-head">负责人</FieldLabel>
                <NativeSelect
                  id="org-head"
                  className="w-full"
                  value={value.headId ?? ""}
                  onChange={(e) => setValue({ ...value, headId: e.target.value ? Number(e.target.value) : null })}
                >
                  <NativeSelectOption value="">（暂不指定）</NativeSelectOption>
                  {enterprisePeople.map((m) => (
                    <NativeSelectOption key={m.id} value={m.id}>
                      {m.nickname || m.username}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </FieldGroup>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={save.isPending}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
