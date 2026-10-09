import { describe, expect, it } from "vitest";

import { emptyStrategyContent } from "@dingze/shared";

import { artifactSheets } from "@/lib/dingze/export/sheets";
import { exportFileName } from "@/lib/dingze/export/xlsx";

describe("artifact export sheets", () => {
  it("merges the strategy cell over its tactics, as in 表 2-7", () => {
    const [sheet] = artifactSheets(
      "S1-03",
      {
        strategies: [
          { id: "s1", statement: "做强车用气", tactics: [{ id: "t1", text: "加密站点", path: "" }, { id: "t2", text: "拓展车队", path: "" }] },
          { id: "s2", statement: "培育工业点供", tactics: [{ id: "t3", text: "开发园区客户", path: "" }] },
        ],
        levelNote: "",
      },
      { "S1-01": { ...emptyStrategyContent("house"), mission: "让城市用上清洁能源" } }
    );
    expect(sheet.rows.slice(2)).toEqual([
      ["做强车用气", "加密站点", ""],
      ["做强车用气", "拓展车队", ""],
      ["培育工业点供", "开发园区客户", ""],
    ]);
    expect(sheet.merges).toContainEqual([2, 0, 3, 0]);
    expect(sheet.rows[0][0]).toBe("使命：让城市用上清洁能源");
  });

  it("keeps year values numeric when they are numbers and text otherwise", () => {
    const [sheet] = artifactSheets("S1-07", {
      years: [2026, 2027],
      rows: [{ id: "y", kpiId: null, theme: "", name: "售气量", unit: "万方", values: { "2026": "1100", "2027": "待补" }, baseline: "", benchmark: "≥1600", challenge: "1250" }],
    });
    expect(sheet.columns.map((c) => c.header)).toEqual(["战略主题 / 要点", "战略 KPI", "单位", "2026 年", "2027 年", "基准值", "标杆值", "挑战值"]);
    expect(sheet.rows[0]).toEqual(["", "售气量", "万方", 1100, "待补", "", "≥1600", 1250]);
  });

  it("puts the primary expression first for S1-01", () => {
    expect(artifactSheets("S1-01", emptyStrategyContent("sixfold")).map((s) => s.name)).toEqual(["战略简约六分法", "战略屋"]);
  });

  it("has nothing to export for unknown codes or empty payloads", () => {
    expect(artifactSheets("S2-04", { a: 1 })).toEqual([]);
    expect(artifactSheets("S1-02", null)).toEqual([]);
  });

  it("builds file names without characters Windows rejects", () => {
    expect(exportFileName("DZ/测试", "S1-07", "战略 KPI 3—5 年年度分解表", 3)).toBe("DZ_测试-S1-07-战略 KPI 3—5 年年度分解表-v3.xlsx");
  });
});
