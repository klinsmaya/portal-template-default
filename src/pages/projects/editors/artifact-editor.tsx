import type {
  IpoocDesign,
  Issue,
  KpiBreakdown,
  KpiScreening,
  MissionWorksheet,
  StrategyContent,
  StrategyKpiTable,
  StrategyLogic,
  StrategyMap,
  VisionWorksheet,
} from "@dingze/shared";

import { IpoocEditor } from "./ipooc-editor";
import { KpiBreakdownEditor } from "./kpi-breakdown-editor";
import { KpiScreeningEditor } from "./kpi-screening-editor";
import { StrategyContentEditor } from "./strategy-content-editor";
import { StrategyKpiEditor } from "./strategy-kpi-editor";
import { StrategyLogicEditor } from "./strategy-logic-editor";
import { StrategyMapEditor } from "./strategy-map-editor";
import { MissionWorksheetEditor, VisionWorksheetEditor } from "./worksheet-editors";

type Props = {
  code: string;
  value: unknown;
  onChange: (next: unknown) => void;
  readOnly: boolean;
  issues: Issue[];
  /** Upstream payloads by code (current versions). */
  upstream: Record<string, unknown>;
  projectYear: number;
  canChangePrimary: boolean;
};

/** Picks the editor for an artifact code; every editor works on that code's payload type. */
export function ArtifactEditor({ code, value, onChange, readOnly, issues, upstream, projectYear, canChangePrimary }: Props) {
  const common = { readOnly, issues, onChange };
  switch (code) {
    case "S1-01":
      return <StrategyContentEditor {...common} value={value as StrategyContent} canChangePrimary={canChangePrimary} />;
    case "M-MISSION":
      return <MissionWorksheetEditor {...common} value={value as MissionWorksheet} />;
    case "M-VISION":
      return <VisionWorksheetEditor {...common} value={value as VisionWorksheet} />;
    case "S1-02":
      return <StrategyMapEditor {...common} value={value as StrategyMap} upstream={upstream as { "S1-01"?: StrategyContent }} />;
    case "S1-03":
      return <StrategyLogicEditor {...common} value={value as StrategyLogic} upstream={upstream as { "S1-01"?: StrategyContent }} />;
    case "S1-04":
      return <IpoocEditor {...common} value={value as IpoocDesign} upstream={upstream as { "S1-03"?: StrategyLogic }} />;
    case "S1-05":
      return <KpiScreeningEditor {...common} value={value as KpiScreening} upstream={upstream as { "S1-04"?: IpoocDesign }} />;
    case "S1-06":
      return <StrategyKpiEditor {...common} value={value as StrategyKpiTable} upstream={upstream as { "S1-05"?: KpiScreening }} />;
    case "S1-07":
      return (
        <KpiBreakdownEditor
          {...common}
          value={value as KpiBreakdown}
          upstream={upstream as { "S1-06"?: StrategyKpiTable }}
          projectYear={projectYear}
        />
      );
    default:
      return null;
  }
}
