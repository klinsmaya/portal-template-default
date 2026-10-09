// Structural validation of artifact payloads. `error` issues block “本步完成” and
// confirmation (Q3); `warning` issues are shown while editing but never block.

export type IssueLevel = 'error' | 'warning';

export interface Issue {
  level: IssueLevel;
  message: string;
  /** Item ID or field key the issue points at, for jump-to-cell. */
  anchor?: string;
}

const PENDING_MARK = '待补';

function filled(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length > 0 && text !== PENDING_MARK;
}

// ── S1-01 六分法 / 战略屋 ──

export type StrategyExpression = 'sixfold' | 'house';

export interface Battlefield {
  id: string;
  /** 主要战场，如“第一增长曲线：城市燃气”。 */
  name: string;
  /** 如何致胜：可持续核心优势。 */
  advantage: string;
  /** 年度必赢之战。 */
  mustWin: string;
}

export interface StrategyContent {
  primary: StrategyExpression;
  /** Shared by both expressions: 目的 = 使命, 方向 = 愿景. */
  mission: string;
  vision: string;
  // 六分法
  strategicGoals: string;
  strategyChoice: string;
  stepsAndMeasures: string;
  indicatorSystem: string;
  // 战略屋
  values: string;
  goals: { y1: string; y3: string; y5: string };
  battlefields: Battlefield[];
  foundation: { organization: string; mechanism: string; talent: string };
}

export const SIXFOLD_FIELDS: { key: keyof StrategyContent; label: string }[] = [
  { key: 'mission', label: '目的（使命）' },
  { key: 'vision', label: '方向（愿景）' },
  { key: 'strategicGoals', label: '战略目标' },
  { key: 'strategyChoice', label: '策略选择' },
  { key: 'stepsAndMeasures', label: '步骤举措' },
  { key: 'indicatorSystem', label: '指标体系' },
];

export function emptyStrategyContent(primary: StrategyExpression): StrategyContent {
  return {
    primary,
    mission: '', vision: '',
    strategicGoals: '', strategyChoice: '', stepsAndMeasures: '', indicatorSystem: '',
    values: '', goals: { y1: '', y3: '', y5: '' }, battlefields: [],
    foundation: { organization: '', mechanism: '', talent: '' },
  };
}

export function validateSixfold(content: StrategyContent): Issue[] {
  return SIXFOLD_FIELDS.filter((f) => !filled(content[f.key])).map((f) => ({
    level: 'error' as const,
    message: `六分法缺“${f.label}”`,
    anchor: String(f.key),
  }));
}

export function validateHouse(content: StrategyContent): Issue[] {
  const issues: Issue[] = [];
  const need = (value: string, label: string, anchor: string) => {
    if (!filled(value)) issues.push({ level: 'error', message: `战略屋缺“${label}”`, anchor });
  };
  need(content.mission, '屋顶 · 使命', 'mission');
  need(content.vision, '屋顶 · 愿景', 'vision');
  need(content.values, '屋顶 · 价值观', 'values');
  need(content.goals.y1, '经营目标 · 一年', 'goals.y1');
  need(content.goals.y3, '经营目标 · 三年', 'goals.y3');
  need(content.goals.y5, '经营目标 · 五年', 'goals.y5');
  if (content.battlefields.length === 0) {
    issues.push({ level: 'error', message: '战略屋至少需要一个主要战场', anchor: 'battlefields' });
  }
  content.battlefields.forEach((b, i) => {
    const col = `第 ${i + 1} 个战场`;
    need(b.name, `${col} · 主要战场`, `battlefields.${b.id}.name`);
    need(b.advantage, `${col} · 如何致胜`, `battlefields.${b.id}.advantage`);
    need(b.mustWin, `${col} · 必赢之战`, `battlefields.${b.id}.mustWin`);
  });
  need(content.foundation.organization, '落地保障 · 组织', 'foundation.organization');
  need(content.foundation.mechanism, '落地保障 · 机制', 'foundation.mechanism');
  need(content.foundation.talent, '落地保障 · 人才', 'foundation.talent');
  return issues;
}

/** Only the primary expression gates “本步完成”; the other one is reported as warnings. */
export function validateStrategyContent(content: StrategyContent): Issue[] {
  const [primary, secondary] =
    content.primary === 'house'
      ? [validateHouse(content), validateSixfold(content)]
      : [validateSixfold(content), validateHouse(content)];
  return [...primary, ...secondary.map((i) => ({ ...i, level: 'warning' as const }))];
}

// ── 路径系统表（S2-03 / S2-06）──

export type Perspective = 'financial' | 'customer' | 'process' | 'learning';

export interface PathNode {
  id: string;
  parentId: string | null;
  perspective?: Perspective;
  /** 1–4. */
  level: number;
  path: string;
  metric: string;
  /** Displayed value, e.g. “700 万方”, “≤10 分钟”. */
  value: string;
  /** Numeric part when the value is additive; used for “推得回来”. */
  amount?: number | null;
  unit?: string;
}

export interface PathSystem {
  nodes: PathNode[];
}

export const MAX_PATH_LEVEL = 4;

export function validatePathSystem(system: PathSystem): Issue[] {
  const issues: Issue[] = [];
  const children = new Map<string | null, PathNode[]>();
  for (const node of system.nodes) {
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }
  const byId = new Map(system.nodes.map((n) => [n.id, n]));

  for (const node of system.nodes) {
    const label = node.path.trim() || '未命名路径';
    if (node.level < 1 || node.level > MAX_PATH_LEVEL) {
      issues.push({ level: 'error', message: `“${label}”的层级超出 1–${MAX_PATH_LEVEL} 级`, anchor: node.id });
    }
    if (node.parentId && !byId.has(node.parentId)) {
      issues.push({ level: 'error', message: `“${label}”的上级路径不存在`, anchor: node.id });
    }
    if (!filled(node.path)) issues.push({ level: 'error', message: '有路径没有填写名称', anchor: node.id });
    if (!filled(node.metric)) issues.push({ level: 'error', message: `“${label}”缺衡量指标`, anchor: node.id });
    if (!filled(node.value)) issues.push({ level: 'error', message: `“${label}”缺指标值`, anchor: node.id });

    const kids = children.get(node.id) ?? [];
    if (node.level === 1 && kids.length === 0) {
      issues.push({ level: 'warning', message: `一级路径“${label}”还没有分解到二级`, anchor: node.id });
    }
    // 推得回来: only comparable when parent and all children share metric and unit and carry amounts.
    const comparable =
      kids.length > 0 &&
      typeof node.amount === 'number' &&
      kids.every((k) => typeof k.amount === 'number' && k.metric.trim() === node.metric.trim() && (k.unit ?? '') === (node.unit ?? ''));
    if (comparable) {
      const sum = kids.reduce((acc, k) => acc + (k.amount as number), 0);
      if (Math.abs(sum - (node.amount as number)) > 1e-9) {
        issues.push({
          level: 'error',
          message: `“${label}”推不回来：下级合计 ${sum}，本级 ${node.amount}`,
          anchor: node.id,
        });
      }
    }
  }
  return issues;
}

// ── RACI（S2-04）──

export type RaciLetter = 'R' | 'A' | 'C' | 'I';

export interface RaciMatrix {
  columns: { id: string; name: string }[];
  rows: { id: string; name: string; cells: Record<string, RaciLetter[]> }[];
}

export const A_LOAD_WARNING_RATIO = 0.5;

export function validateRaci(matrix: RaciMatrix): Issue[] {
  const issues: Issue[] = [];
  const aLoad = new Map<string, number>();
  for (const row of matrix.rows) {
    let a = 0;
    let r = 0;
    for (const col of matrix.columns) {
      const letters = row.cells[col.id] ?? [];
      if (letters.includes('A')) {
        a += 1;
        aLoad.set(col.id, (aLoad.get(col.id) ?? 0) + 1);
      }
      if (letters.includes('R')) r += 1;
      if (letters.includes('R') && letters.includes('A')) {
        issues.push({ level: 'warning', message: `“${row.name}”由${col.name}同时担任 R 与 A，确认是否有意为之`, anchor: row.id });
      }
    }
    if (a === 0) issues.push({ level: 'error', message: `“${row.name}”没有 A（最终负责人）`, anchor: row.id });
    if (a > 1) issues.push({ level: 'error', message: `“${row.name}”有 ${a} 个 A，A 只能有一个`, anchor: row.id });
    if (r === 0) issues.push({ level: 'error', message: `“${row.name}”没有 R（执行者）`, anchor: row.id });
    if (r > 1) issues.push({ level: 'warning', message: `“${row.name}”有 ${r} 个 R，注意分工边界`, anchor: row.id });
  }
  if (matrix.rows.length >= 4) {
    for (const col of matrix.columns) {
      const load = aLoad.get(col.id) ?? 0;
      if (load / matrix.rows.length > A_LOAD_WARNING_RATIO) {
        issues.push({ level: 'warning', message: `${col.name}担任 A 的事项有 ${load} 个，注意负荷`, anchor: col.id });
      }
    }
  }
  return issues;
}

// ── Dispatcher ──

export function validateArtifact(code: string, payload: unknown): Issue[] {
  if (payload === null || typeof payload !== 'object') {
    return [{ level: 'error', message: '成果内容为空' }];
  }
  switch (code) {
    case 'S1-01':
      return validateStrategyContent(payload as StrategyContent);
    case 'S2-03':
    case 'S2-06':
      return validatePathSystem(payload as PathSystem);
    case 'S2-04':
      return validateRaci(payload as RaciMatrix);
    default:
      return [];
  }
}

export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
