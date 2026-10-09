import { PERSPECTIVES, type StrategyMap } from "@dingze/shared";

export const LANE_HEIGHT = 120;
export const LANE_LABEL_WIDTH = 96;
const NODE_HEIGHT = 64;
const GAP = 16;
const MAX_NODE_WIDTH = 200;

export type LaidOutNode = { id: string; x: number; y: number; w: number; h: number; title: string };
export type LaidOutLane = { key: string; label: string; y: number };

/**
 * One horizontal lane per perspective (财务 on top); the objectives of a lane share its
 * width evenly, so nodes stay inside their lane and never overlap.
 */
export function layoutStrategyMap(map: StrategyMap, width: number) {
  const lanes: LaidOutLane[] = PERSPECTIVES.map((p, i) => ({ key: p.key, label: p.label, y: i * LANE_HEIGHT }));
  const nodes: LaidOutNode[] = [];
  const usable = Math.max(width - LANE_LABEL_WIDTH - GAP, 120);
  for (const [laneIndex, perspective] of PERSPECTIVES.entries()) {
    const items = map.objectives.filter((o) => o.perspective === perspective.key);
    if (items.length === 0) continue;
    const w = Math.min(MAX_NODE_WIDTH, (usable - GAP * (items.length - 1)) / items.length);
    const total = w * items.length + GAP * (items.length - 1);
    const left = LANE_LABEL_WIDTH + GAP / 2 + (usable - total) / 2;
    items.forEach((o, i) => {
      nodes.push({
        id: o.id,
        x: left + i * (w + GAP),
        y: laneIndex * LANE_HEIGHT + (LANE_HEIGHT - NODE_HEIGHT) / 2,
        w,
        h: NODE_HEIGHT,
        title: o.title,
      });
    });
  }
  return { lanes, nodes, height: PERSPECTIVES.length * LANE_HEIGHT };
}
