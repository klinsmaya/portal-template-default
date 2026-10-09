import { describe, expect, it } from "vitest";

import { emptyStrategyContent } from "@dingze/shared";

import { ChangePathError, applyChanges, describeValue } from "@/lib/dingze/changes";

const house = () => ({
  ...emptyStrategyContent("house"),
  battlefields: [{ id: "b1", name: "城市燃气", advantage: "", mustWin: "" }],
});

describe("applying proposed changes", () => {
  it("sets top-level and nested fields without touching the original", () => {
    const original = house();
    const next = applyChanges(original, [
      { path: "values", value: "安全第一" },
      { path: "goals.y3", value: "营收 12 亿" },
    ]);
    expect(next.values).toBe("安全第一");
    expect(next.goals).toEqual({ y1: "", y3: "营收 12 亿", y5: "" });
    expect(original.values).toBe("");
  });

  it("addresses array items by id and appends with +", () => {
    const next = applyChanges(house(), [
      { path: "battlefields.b1.mustWin", value: "车用气新客户 700 万方" },
      { path: "battlefields.+", value: { id: "b2", name: "储能", advantage: "", mustWin: "" } },
    ]);
    expect(next.battlefields.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(next.battlefields[0].mustWin).toBe("车用气新客户 700 万方");
  });

  it("rejects paths that do not exist instead of inventing structure", () => {
    expect(() => applyChanges(house(), [{ path: "battlefields.b9.name", value: "x" }])).toThrow(ChangePathError);
    expect(() => applyChanges(house(), [{ path: "nope.deep", value: "x" }])).toThrow(ChangePathError);
  });

  it("describes object values for the suggestion card", () => {
    expect(describeValue({ id: "b2", name: "储能", advantage: "示范项目", mustWin: "" })).toBe("储能 ｜ 示范项目");
  });
});
