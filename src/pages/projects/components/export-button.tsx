import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { STATUS_LABELS, type ArtifactStatus } from "@dingze/shared";

import { Button } from "@/components/ui/button";
import { artifactSheets } from "@/lib/dingze/export/sheets";
import { downloadXlsx, exportFileName } from "@/lib/dingze/export/xlsx";
import { errorMessage } from "@/lib/dingze/errors";

/**
 * Exports the saved version (not unsaved edits) to Excel. Anything short of 已定版 is
 * marked as a draft in the file so it is never mistaken for the confirmed table.
 */
export function ExportButton({
  code,
  name,
  payload,
  rev,
  status,
  enterprise,
  projectName,
  upstream,
  dirty,
}: {
  code: string;
  name: string;
  payload: unknown;
  rev: number;
  status: ArtifactStatus;
  enterprise: string;
  projectName: string;
  upstream: Record<string, unknown>;
  dirty: boolean;
}) {
  const [pending, setPending] = useState(false);
  const sheets = artifactSheets(code, payload, upstream);
  if (sheets.length === 0 || rev === 0) return null;

  const run = async () => {
    setPending(true);
    try {
      const stamp = new Date().toLocaleString("zh-CN", { hour12: false });
      await downloadXlsx(
        exportFileName(enterprise, code, name, rev),
        {
          title: `《${name}》`,
          subtitle: `${enterprise} · ${projectName} · ${STATUS_LABELS[status]} v${rev} · 导出于 ${stamp}`,
          draft: status !== "locked",
        },
        sheets
      );
      if (dirty) toast.info("已导出最近一次保存的版本，未保存的修改不在文件里");
    } catch (error) {
      toast.error(`导出失败：${errorMessage(error)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="outline" onClick={run} disabled={pending}>
      <FileSpreadsheet /> {pending ? "导出中…" : "导出 Excel"}
    </Button>
  );
}
