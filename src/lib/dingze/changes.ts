// Apply a digital consultant's proposed changes to an artifact draft.
// Paths are dot-separated; array items are addressed by their `id`, and `+`
// appends a new item, e.g. `goals.y3`, `battlefields.b1.mustWin`, `battlefields.+`.

export type ProposedChange = {
  path: string;
  /** Human-readable cell name shown on the suggestion card. */
  label?: string;
  value: unknown;
};

export class ChangePathError extends Error {}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function setAt(target: unknown, segments: string[], value: unknown, fullPath: string): unknown {
  const [head, ...rest] = segments;
  if (Array.isArray(target)) {
    if (head === "+") {
      if (rest.length) throw new ChangePathError(`“${fullPath}”：追加时不能再带下级路径`);
      return [...target, value];
    }
    const index = target.findIndex((item) => item && typeof item === "object" && (item as { id?: unknown }).id === head);
    if (index < 0) throw new ChangePathError(`“${fullPath}”：找不到 id 为 ${head} 的条目`);
    const next = [...target];
    next[index] = rest.length ? setAt(target[index], rest, value, fullPath) : value;
    return next;
  }
  if (target === null || typeof target !== "object") {
    throw new ChangePathError(`“${fullPath}”：路径不存在`);
  }
  const record = target as Record<string, unknown>;
  if (!rest.length) return { ...record, [head]: value };
  if (!(head in record)) throw new ChangePathError(`“${fullPath}”：路径不存在`);
  return { ...record, [head]: setAt(record[head], rest, value, fullPath) };
}

export function applyChanges<T>(payload: T, changes: ProposedChange[]): T {
  let next: unknown = clone(payload);
  for (const change of changes) {
    if (typeof change.path !== "string" || !change.path.trim()) throw new ChangePathError("修改缺少路径");
    next = setAt(next, change.path.split("."), clone(change.value), change.path);
  }
  return next as T;
}

export function describeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key, v]) => key !== "id" && typeof v === "string" && v)
      .map(([, v]) => v)
      .join(" ｜ ");
  }
  return String(value ?? "");
}
