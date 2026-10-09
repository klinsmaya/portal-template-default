import { describe, expect, it } from "vitest";

import {
  type PathNode,
  type RaciMatrix,
  type StrategyContent,
  emptyStrategyContent,
  hasBlockingIssues,
  validateArtifact,
} from "@dingze/shared";

const fullHouse = (): StrategyContent => ({
  ...emptyStrategyContent("house"),
  mission: "让城市用上清洁、稳定、可负担的能源",
  vision: "成为本省领先的综合清洁能源服务商",
  values: "安全第一 · 客户至上",
  goals: { y1: "售气量增长 1000 万方", y3: "营收 12 亿", y5: "综合能源占比 40%" },
  battlefields: [{ id: "b1", name: "城市燃气与车用气", advantage: "站点网络密度", mustWin: "车用气新客户 700 万方" }],
  foundation: { organization: "点供事业部", mechanism: "项目考核", talent: "培养 20 名骨干" },
});

describe("S1-01 strategy content", () => {
  it("passes a complete strategy house even when the six-part table is empty", () => {
    const issues = validateArtifact("S1-01", fullHouse());
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("六分法"))).toBe(true);
  });

  it("blocks a house with a pending cell", () => {
    const content = fullHouse();
    content.foundation.mechanism = "待补";
    const issues = validateArtifact("S1-01", content);
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", anchor: "foundation.mechanism" }));
  });

  it("requires all six aspects when the six-part table is primary", () => {
    const content = { ...fullHouse(), primary: "sixfold" as const, strategicGoals: "2030 年营收 30 亿" };
    const errors = validateArtifact("S1-01", content).filter((i) => i.level === "error");
    expect(errors.map((e) => e.anchor)).toEqual(["strategyChoice", "stepsAndMeasures", "indicatorSystem"]);
  });
});

const node = (id: string, parentId: string | null, level: number, amount: number | null, metric = "新增售气量"): PathNode => ({
  id, parentId, level, path: `路径 ${id}`, metric, value: amount === null ? "≥98%" : `${amount} 万方`, amount, unit: "万方",
});

describe("path system", () => {
  it("accepts children that add back up to their parent", () => {
    const nodes = [node("1", null, 1, 700), node("1.1", "1", 2, 500), node("1.2", "1", 2, 200)];
    expect(hasBlockingIssues(validateArtifact("S2-03", { nodes }))).toBe(false);
  });

  it("blocks children that do not add back up", () => {
    const nodes = [node("1", null, 1, 700), node("1.1", "1", 2, 500), node("1.2", "1", 2, 220)];
    const issues = validateArtifact("S2-03", { nodes });
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", anchor: "1", message: expect.stringContaining("推不回来") }));
  });

  it("does not compare children measured by a different metric", () => {
    const nodes = [node("1", null, 1, 700), node("1.1", "1", 2, 2000, "新增客户数量")];
    expect(validateArtifact("S2-03", { nodes }).some((i) => i.message.includes("推不回来"))).toBe(false);
  });

  it("requires a metric and a value on every path and caps the depth at four levels", () => {
    const nodes = [{ ...node("1", null, 1, 700), metric: "" }, node("x", "1", 5, null, "新增售气量")];
    const messages = validateArtifact("S2-03", { nodes }).map((i) => i.message);
    expect(messages.some((m) => m.includes("缺衡量指标"))).toBe(true);
    expect(messages.some((m) => m.includes("层级超出"))).toBe(true);
  });
});

const matrix = (cells: Record<string, RaciMatrix["rows"][number]["cells"]>): RaciMatrix => ({
  columns: [
    { id: "ops", name: "运营部" },
    { id: "dispatch", name: "调度中心" },
    { id: "it", name: "信息部" },
  ],
  rows: Object.entries(cells).map(([id, c]) => ({ id, name: `项目 ${id}`, cells: c })),
});

describe("RACI matrix", () => {
  it("passes a row with exactly one A and at least one R", () => {
    const issues = validateArtifact("S2-04", matrix({ p1: { ops: ["A"], dispatch: ["R"], it: ["C"] } }));
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it.each([
    ["no A", { ops: ["R"], dispatch: ["C"] }, "没有 A"],
    ["two A", { ops: ["A"], dispatch: ["A"], it: ["R"] }, "有 2 个 A"],
    ["no R", { ops: ["A"], dispatch: ["C"] }, "没有 R"],
  ] as const)("blocks a row with %s", (_name, cells, text) => {
    const issues = validateArtifact("S2-04", matrix({ p1: cells as never }));
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", message: expect.stringContaining(text) }));
  });

  it("only warns about multiple R, R with A in one cell, and R doubling as C", () => {
    const issues = validateArtifact("S2-04", matrix({ p1: { ops: ["R", "A"], dispatch: ["R"], it: ["R", "C"] } }));
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.filter((i) => i.level === "warning").length).toBeGreaterThanOrEqual(2);
  });
});
