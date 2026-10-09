import { FolderKanban } from "lucide-react";
import { Navigate } from "react-router";

import { defineAppRoutes } from "@nocobase/portal-sdk/routing";

// The bundled Registry routes are examples; the strategy consulting platform defines
// its own navigation below. Providers, adapters and /dev showcases stay available.
export const registryRoutesEnabled = false;

export const appRoutes = defineAppRoutes([
  {
    name: "projects",
    path: "/projects",
    lazy: () => import("@/pages/projects/list"),
    resource: {
      meta: {
        label: "我的项目",
        priority: 1,
        icon: <FolderKanban />,
        description: "进入正在推进的战略咨询项目。",
      },
    },
  },
  {
    // Project workspace: rendered full-width with its own project navigation
    // (see Layout), so it is not a sidebar menu item.
    name: "project",
    path: "/projects/:projectId",
    lazy: () => import("@/pages/projects/project-layout"),
    outlet: "manual",
    children: [
      { name: "project.index", index: true, element: <Navigate to="overview" replace /> },
      { name: "project.overview", path: "overview", lazy: () => import("@/pages/projects/overview") },
      { name: "project.workspace", path: "workspace", lazy: () => import("@/pages/projects/workspace") },
      { name: "project.workspace.artifact", path: "workspace/:code", lazy: () => import("@/pages/projects/workspace") },
    ],
  },
]);
