import { useOutletContext } from "react-router";

import type { ProjectOverview, ProjectSummary } from "@/lib/dingze/api";

export type ProjectContextValue = {
  project: ProjectSummary;
  overview: ProjectOverview;
};

export function useProjectContext() {
  return useOutletContext<ProjectContextValue>();
}
