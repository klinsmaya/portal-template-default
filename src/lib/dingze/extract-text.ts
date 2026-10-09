// Turn an uploaded file into plain text in the browser; only the text is stored. The parsers
// load on demand so they stay out of the main bundle.

export const MATERIAL_ACCEPT = ".txt,.md,.csv,.docx,.pdf,.xlsx";
export const MATERIAL_MAX_BYTES = 20 * 1024 * 1024;

export class UnsupportedFileError extends Error {}

const extension = (name: string) => name.toLowerCase().split(".").pop() ?? "";

export async function extractText(file: File): Promise<string> {
  if (file.size > MATERIAL_MAX_BYTES) throw new UnsupportedFileError("文件超过 20 MB，请拆分或只上传关键部分");
  const ext = extension(file.name);
  if (["txt", "md", "csv"].includes(ext)) return file.text();
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(""));
    }
    return pages.join("\n\n");
  }
  if (ext === "xlsx") {
    const { Workbook } = await import("exceljs");
    const book = new Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const lines: string[] = [];
    book.eachSheet((sheet) => {
      lines.push(`【${sheet.name}】`);
      sheet.eachRow((row) => {
        const values = (row.values as unknown[]).slice(1).map((v) => (v && typeof v === "object" && "text" in (v as object) ? String((v as { text: unknown }).text) : v ?? ""));
        lines.push(values.join("\t"));
      });
    });
    return lines.join("\n");
  }
  throw new UnsupportedFileError("暂不支持这种格式：请上传 txt、md、csv、docx、pdf 或 xlsx，或把文字粘贴进来");
}
