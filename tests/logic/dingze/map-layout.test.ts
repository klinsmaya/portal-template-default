import { describe, expect, it } from "vitest";

import type { MapObjective, Perspective } from "@dingze/shared";

import { LANE_HEIGHT, layoutStrategyMap } from "@/lib/dingze/map-layout";

const objective = (id: string, perspective: Perspective): MapObjective => ({ id, perspective, title: id, note: "" });

describe("strategy map layout", () => {
  it("keeps every node inside its perspective lane without overlaps", () => {
    const objectives = [
      ...Array.from({ length: 6 }, (_, i) => objective(`c${i}`, "customer")),
      objective("f", "financial"),
      objective("l", "learning"),
    ];
    const { nodes } = layoutStrategyMap({ objectives, links: [] }, 800);
    for (const node of nodes) {
      const lane = ["financial", "customer", "process", "learning"].indexOf(objectives.find((o) => o.id === node.id)!.perspective);
      expect(node.y).toBeGreaterThanOrEqual(lane * LANE_HEIGHT);
      expect(node.y + node.h).toBeLessThanOrEqual((lane + 1) * LANE_HEIGHT);
      expect(node.x + node.w).toBeLessThanOrEqual(800);
    }
    const customer = nodes.filter((n) => n.id.startsWith("c")).sort((a, b) => a.x - b.x);
    for (let i = 1; i < customer.length; i++) expect(customer[i].x).toBeGreaterThanOrEqual(customer[i - 1].x + customer[i - 1].w);
  });
});
