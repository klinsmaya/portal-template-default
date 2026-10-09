import {
  emptyIpoocDesign,
  emptyKpiBreakdown,
  emptyKpiScreening,
  emptyMissionWorksheet,
  emptyStrategyContent,
  emptyStrategyKpiTable,
  emptyStrategyLogic,
  emptyStrategyMap,
  emptyVisionWorksheet,
} from "@dingze/shared";

/** Artifacts whose editor is available in this release. */
export const EDITABLE_CODES = new Set(["S1-01", "M-MISSION", "M-VISION", "S1-02", "S1-03", "S1-04", "S1-05", "S1-06", "S1-07"]);

/** The blank skeleton a new artifact starts from. */
export function emptyPayload(code: string, project: { primaryExpression: "house" | "sixfold"; year: number }): unknown {
  switch (code) {
    case "S1-01":
      return emptyStrategyContent(project.primaryExpression);
    case "M-MISSION":
      return emptyMissionWorksheet();
    case "M-VISION":
      return emptyVisionWorksheet();
    case "S1-02":
      return emptyStrategyMap();
    case "S1-03":
      return emptyStrategyLogic();
    case "S1-04":
      return emptyIpoocDesign();
    case "S1-05":
      return emptyKpiScreening();
    case "S1-06":
      return emptyStrategyKpiTable();
    case "S1-07":
      return emptyKpiBreakdown(project.year);
    default:
      return null;
  }
}
