import {
  IPOOC_STAGES,
  PERSPECTIVES,
  SCREEN_DIMENSIONS,
  SIXFOLD_FIELDS,
  SMART_CHECKS,
  candidateTotal,
  type IpoocDesign,
  type KpiBreakdown,
  type KpiScreening,
  type MissionWorksheet,
  type StrategyContent,
  type StrategyKpiTable,
  type StrategyLogic,
  type StrategyMap,
  type VisionWorksheet,
} from "@dingze/shared";

// Artifact payloads as plain sheet models (header, rows, merged ranges), so the table
// layout follows the book and can be tested without generating a file.

export type Cell = string | number | null;

export type SheetModel = {
  name: string;
  columns: { header: string; width: number }[];
  rows: Cell[][];
  /** Merged ranges in body coordinates: [firstRow, firstCol, lastRow, lastCol], 0-based. */
  merges: [number, number, number, number][];
  /** Rows that act as section titles inside the sheet (bold, merged across). */
  sectionRows?: number[];
};

const sheet = (name: string, columns: [string, number][], rows: Cell[][] = []): SheetModel => ({
  name,
  columns: columns.map(([header, width]) => ({ header, width })),
  rows,
  merges: [],
});

function strategyContentSheets(c: StrategyContent): SheetModel[] {
  const house = sheet("战略屋", [
    ["项目", 16],
    ["内容", 60],
  ]);
  house.rows.push(["使命", c.mission], ["愿景", c.vision], ["价值观", c.values]);
  house.rows.push(["一年目标", c.goals?.y1 ?? ""], ["三年目标", c.goals?.y3 ?? ""], ["五年目标", c.goals?.y5 ?? ""]);
  (c.battlefields ?? []).forEach((b, i) => {
    house.rows.push([`主要战场 ${i + 1}`, b.name], [`如何致胜 ${i + 1}`, b.advantage], [`必赢之战 ${i + 1}`, b.mustWin]);
  });
  house.rows.push(
    ["落地保障 · 组织", c.foundation?.organization ?? ""],
    ["落地保障 · 机制", c.foundation?.mechanism ?? ""],
    ["落地保障 · 人才", c.foundation?.talent ?? ""]
  );
  const sixfold = sheet("战略简约六分法", [
    ["方面", 18],
    ["内容", 60],
  ]);
  for (const f of SIXFOLD_FIELDS) sixfold.rows.push([f.label, String(c[f.key] ?? "")]);
  return c.primary === "sixfold" ? [sixfold, house] : [house, sixfold];
}

function strategyMapSheets(map: StrategyMap): SheetModel[] {
  const objectives = sheet("战略目标", [
    ["层面", 14],
    ["战略目标", 36],
    ["说明", 40],
  ]);
  for (const p of PERSPECTIVES) {
    const items = (map.objectives ?? []).filter((o) => o.perspective === p.key);
    if (items.length === 0) continue;
    const start = objectives.rows.length;
    items.forEach((o) => objectives.rows.push([p.label, o.title, o.note]));
    if (items.length > 1) objectives.merges.push([start, 0, start + items.length - 1, 0]);
  }
  const byId = new Map((map.objectives ?? []).map((o) => [o.id, o.title]));
  const links = sheet("因果与协同", [
    ["起点目标", 32],
    ["关系", 14],
    ["终点目标", 32],
  ]);
  for (const l of map.links ?? []) {
    links.rows.push([byId.get(l.from) ?? "", l.kind === "cause" ? "支撑（因果）" : "协同", byId.get(l.to) ?? ""]);
  }
  return [objectives, links];
}

function strategyLogicSheets(logic: StrategyLogic, upstream?: StrategyContent): SheetModel[] {
  const s = sheet("战略策略逻辑表", [
    ["战略（做不做 / 做什么）", 36],
    ["策略（动词＋宾语）", 40],
    ["路径（可选）", 24],
  ]);
  if (upstream) {
    s.rows.push([`使命：${upstream.mission ?? ""}`, null, null], [`愿景：${upstream.vision ?? ""}`, null, null]);
    s.merges.push([0, 0, 0, 2], [1, 0, 1, 2]);
  }
  for (const line of logic.strategies ?? []) {
    const tactics = line.tactics?.length ? line.tactics : [{ id: "", text: "", path: "" }];
    const start = s.rows.length;
    tactics.forEach((t) => s.rows.push([line.statement, t.text, t.path]));
    if (tactics.length > 1) s.merges.push([start, 0, start + tactics.length - 1, 0]);
  }
  if (logic.levelNote) {
    s.rows.push([`层级相对性说明：${logic.levelNote}`, null, null]);
    s.merges.push([s.rows.length - 1, 0, s.rows.length - 1, 2]);
  }
  return [s];
}

function ipoocSheets(design: IpoocDesign): SheetModel[] {
  const s = sheet("IPOOC 指标设计", [
    ["IPOOC 环节", 12],
    ["关键要素拆解", 30],
    ["指标名", 20],
    ["计算公式", 24],
    ["目标值", 12],
    ["数据来源", 14],
    ["考核频率", 10],
  ]);
  s.sectionRows = [];
  for (const item of design.sheets ?? []) {
    s.sectionRows.push(s.rows.length);
    s.merges.push([s.rows.length, 0, s.rows.length, 6]);
    s.rows.push([`关键策略：${item.strategy} · 时间周期：${item.period} · 责任部门：${item.ownerDept}`, null, null, null, null, null, null]);
    for (const stage of IPOOC_STAGES) {
      const r = item.rows?.[stage.key];
      s.rows.push([stage.label, r?.elements ?? "", r?.indicator ?? "", r?.formula ?? "", r?.target ?? "", r?.source ?? "", r?.frequency ?? ""]);
    }
    const smart = SMART_CHECKS.map((c) => `${c.label}${item.smart?.[c.key] ? "✔" : "✘"}`).join("  ");
    s.merges.push([s.rows.length, 0, s.rows.length, 6]);
    s.rows.push([`SMART 验证：${smart}`, null, null, null, null, null, null]);
  }
  return [s];
}

function screeningSheets(screening: KpiScreening): SheetModel[] {
  const s = sheet("KPI 筛选评价", [
    ["候选指标", 24],
    ["来源", 24],
    ...SCREEN_DIMENSIONS.map((d) => [d.label, 11] as [string, number]),
    ["合计", 8],
    ["结论", 8],
    ["理由", 30],
  ]);
  for (const c of screening.candidates ?? []) {
    s.rows.push([
      c.name,
      c.origin,
      ...SCREEN_DIMENSIONS.map((d) => c.scores?.[d.key] ?? null),
      candidateTotal(c),
      c.keep === true ? "保留" : c.keep === false ? "剔除" : "未决",
      c.reason,
    ]);
  }
  return [s];
}

function strategyKpiSheets(table: StrategyKpiTable): SheetModel[] {
  const s = sheet("战略 KPI", [
    ["战略主题 / 要点", 22],
    ["战略 KPI", 20],
    ["口径 / 计算公式", 36],
    ["单位", 8],
    ["数据来源", 16],
    ["统计周期", 10],
    ["责任部门", 14],
  ]);
  for (const k of table.kpis ?? []) s.rows.push([k.theme, k.name, k.definition, k.unit, k.source, k.period, k.owner]);
  return [s];
}

/** Numbers stay numbers in Excel; anything else (“待补”, “≥95%”) stays text. */
function cellValue(v: string | undefined): Cell {
  const text = (v ?? "").trim();
  return text !== "" && /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
}

function breakdownSheets(b: KpiBreakdown): SheetModel[] {
  const years = b.years ?? [];
  const s = sheet("年度分解", [
    ["战略主题 / 要点", 22],
    ["战略 KPI", 20],
    ["单位", 8],
    ...years.map((y) => [`${y} 年`, 10] as [string, number]),
    ["基准值", 10],
    ["标杆值", 10],
    ["挑战值", 10],
  ]);
  for (const r of b.rows ?? []) {
    s.rows.push([
      r.theme,
      r.name,
      r.unit,
      ...years.map((y) => cellValue(r.values?.[String(y)])),
      cellValue(r.baseline),
      cellValue(r.benchmark),
      cellValue(r.challenge),
    ]);
  }
  return [s];
}

function missionSheets(m: MissionWorksheet): SheetModel[] {
  const s = sheet("使命五要素", [
    ["", 14],
    ["是谁？", 28],
    ["痛点与核心需求", 32],
    ["事业的哲学意义", 36],
  ]);
  s.rows.push(
    ["核心用户", m.coreUser?.who ?? "", m.coreUser?.need ?? "", m.philosophy],
    ["核心客户", m.coreCustomer?.who ?? "", m.coreCustomer?.need ?? "", null],
    ["独特差异化", m.differentiation, "—", null],
    ["核心竞争优势", m.advantage, "—", null],
    [`合成使命句：${m.statement}`, null, null, null]
  );
  s.merges.push([0, 3, 3, 3], [4, 0, 4, 3]);
  return [s];
}

function visionSheets(v: VisionWorksheet): SheetModel[] {
  const s = sheet("愿景三法", [
    ["方法", 18],
    ["内容", 60],
  ]);
  s.rows.push(
    ["战略推导法", v.derivation],
    ["对标一流 · 选标", v.benchmark?.select ?? ""],
    ["对标一流 · 对标", v.benchmark?.compare ?? ""],
    ["对标一流 · 定标", v.benchmark?.set ?? ""],
    ["引以为傲法", v.pride],
    ["时间跨度", v.horizon],
    ["愿景句", v.statement]
  );
  return [s];
}

/** The sheets an artifact exports to; empty for artifacts without an export yet. */
export function artifactSheets(code: string, payload: unknown, upstream: Record<string, unknown> = {}): SheetModel[] {
  if (!payload || typeof payload !== "object") return [];
  switch (code) {
    case "S1-01":
      return strategyContentSheets(payload as StrategyContent);
    case "S1-02":
      return strategyMapSheets(payload as StrategyMap);
    case "S1-03":
      return strategyLogicSheets(payload as StrategyLogic, upstream["S1-01"] as StrategyContent | undefined);
    case "S1-04":
      return ipoocSheets(payload as IpoocDesign);
    case "S1-05":
      return screeningSheets(payload as KpiScreening);
    case "S1-06":
      return strategyKpiSheets(payload as StrategyKpiTable);
    case "S1-07":
      return breakdownSheets(payload as KpiBreakdown);
    case "M-MISSION":
      return missionSheets(payload as MissionWorksheet);
    case "M-VISION":
      return visionSheets(payload as VisionWorksheet);
    default:
      return [];
  }
}
