import type { StageKey } from "@dingze/shared";

/** The digital consultant (AI employee from @ziqu/plugin-dingze) that coaches each stage. */
export const COACH_BY_STAGE: Record<StageKey, string> = {
  strategy: "dingze-strategy-coach",
  goal: "dingze-goal-coach",
  action: "dingze-action-coach",
};

/** Frontend tool the consultants call to propose writing agreed content into the open artifact. */
export const PROPOSE_TOOL = "dingzeProposeChanges";
