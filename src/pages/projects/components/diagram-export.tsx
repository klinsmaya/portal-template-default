import { ChevronDown, ImageDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { STATUS_LABELS, type ArtifactStatus } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadDiagram } from "@/lib/dingze/diagram-image";
import { artifactDiagram } from "@/lib/dingze/diagram-svg";
import { errorMessage } from "@/lib/dingze/errors";
import type { ExportInfo } from "@/lib/dingze/records-api";

/** Saves the saved version's diagram as SVG or PNG; drafts carry 草稿 in the subtitle. */
export function DiagramExportButton({
  code,
  name,
  payload,
  rev,
  status,
  enterprise,
  dirty,
  onExported,
}: {
  code: string;
  name: string;
  payload: unknown;
  rev: number;
  status: ArtifactStatus;
  enterprise: string;
  dirty: boolean;
  onExported?: (info: ExportInfo) => void;
}) {
  const [pending, setPending] = useState(false);
  if (rev === 0 || !artifactDiagram(code, payload)) return null;
  const draft = status !== "locked";

  const run = async (format: "svg" | "png") => {
    setPending(true);
    try {
      const subtitle = `${enterprise} · ${STATUS_LABELS[status]} v${rev}${draft ? " · 草稿（未定版，仅供讨论）" : ""}`;
      const diagram = artifactDiagram(code, payload, subtitle)!;
      const baseName = `${enterprise}-${code}-${name}-v${rev}`.replace(/[\\/:*?"<>|]/g, "_");
      await downloadDiagram(diagram, baseName, format);
      onExported?.({ code, rev, format, fileName: `${baseName}.${format}`, draft });
      if (dirty) toast.info("已导出最近一次保存的版本，未保存的修改不在图片里");
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" disabled={pending}>
            <ImageDown /> {pending ? "导出中…" : "导出图片"} <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={() => run("png")}>PNG 图片（汇报、文档）</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("svg")}>SVG 矢量图（可再编辑）</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
