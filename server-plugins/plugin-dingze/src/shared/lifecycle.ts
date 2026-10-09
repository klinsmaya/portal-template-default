// Artifact lifecycle (spec V1.2 §二(九), Q1, Q10): states, transitions, who may
// perform them, and how unlocking is computed from the catalog.

import { ARTIFACTS, ArtifactDef, StageKey, getArtifactDef, previousStage, stageGateCodes } from './catalog';

export type ArtifactStatus =
  | 'not_started'
  | 'in_progress'
  | 'step_done'
  | 'in_review'
  | 'pending_confirm'
  | 'locked'
  | 'archived';

export const STATUS_LABELS: Record<ArtifactStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  step_done: '本步完成',
  in_review: '待复核',
  pending_confirm: '待确认',
  locked: '已定版',
  archived: '已归档',
};

/** Roles inside one project. Enterprise confirmation belongs to `ent_lead` only (Q2). */
export type ProjectRole = 'ent_lead' | 'dept_head' | 'member' | 'readonly' | 'lead_consultant' | 'co_consultant';

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  ent_lead: '企业项目负责人',
  dept_head: '部门负责人',
  member: '项目成员',
  readonly: '只读成员',
  lead_consultant: '主咨询师',
  co_consultant: '协作咨询师',
};

export const ENTERPRISE_EDITORS: ProjectRole[] = ['ent_lead', 'dept_head', 'member'];
export const CONSULTANTS: ProjectRole[] = ['lead_consultant', 'co_consultant'];

export type LifecycleAction =
  | 'save'
  | 'stepDone'
  | 'submitReview'
  | 'approve'
  | 'returnToEdit'
  | 'confirm'
  | 'reopen'
  | 'forceLock'
  | 'forceReturn';

export interface Actor {
  projectRole: ProjectRole | null;
  /** System-level consulting admin may force transitions with a reason. */
  isConsultAdmin: boolean;
}

interface TransitionRule {
  from: ArtifactStatus[];
  /** Target status; `save` depends on who edits, see `nextStatus`. */
  to: ArtifactStatus | 'by-actor';
  roles: ProjectRole[];
  consultAdmin?: boolean;
  requiresReason?: boolean;
  /** Run hard validation before the transition. */
  validates?: boolean;
}

const RULES: Record<LifecycleAction, TransitionRule> = {
  save: {
    from: ['not_started', 'in_progress', 'step_done', 'in_review', 'pending_confirm'],
    to: 'by-actor',
    roles: [...ENTERPRISE_EDITORS, ...CONSULTANTS],
  },
  stepDone: { from: ['in_progress'], to: 'step_done', roles: ['ent_lead', 'dept_head'], validates: true },
  submitReview: { from: ['step_done'], to: 'in_review', roles: ['ent_lead', 'dept_head', ...CONSULTANTS] },
  approve: { from: ['in_review'], to: 'pending_confirm', roles: ['lead_consultant'], validates: true },
  returnToEdit: { from: ['in_review', 'pending_confirm'], to: 'in_progress', roles: ['lead_consultant', 'ent_lead'], requiresReason: true },
  confirm: { from: ['pending_confirm'], to: 'locked', roles: ['ent_lead'], validates: true },
  reopen: { from: ['locked'], to: 'in_progress', roles: ['lead_consultant'], consultAdmin: true, requiresReason: true },
  forceLock: {
    from: ['in_progress', 'step_done', 'in_review', 'pending_confirm'],
    to: 'locked', roles: [], consultAdmin: true, requiresReason: true,
  },
  forceReturn: {
    from: ['step_done', 'in_review', 'pending_confirm', 'locked'],
    to: 'in_progress', roles: [], consultAdmin: true, requiresReason: true,
  },
};

export class LifecycleError extends Error {
  constructor(
    readonly code: 'FORBIDDEN' | 'INVALID_STATE' | 'REASON_REQUIRED' | 'LOCKED_STEP' | 'VALIDATION_FAILED',
    message: string,
  ) {
    super(message);
  }
}

export function canPerform(action: LifecycleAction, actor: Actor): boolean {
  const rule = RULES[action];
  if (rule.consultAdmin && actor.isConsultAdmin) return true;
  return actor.projectRole !== null && rule.roles.includes(actor.projectRole);
}

/**
 * Resolve the status after an action, or throw a LifecycleError. Validation itself is
 * done by the caller (see `requiresValidation`) because it needs the payload.
 */
export function nextStatus(
  action: LifecycleAction,
  current: ArtifactStatus,
  actor: Actor,
  reason?: string,
): ArtifactStatus {
  const rule = RULES[action];
  if (!canPerform(action, actor)) {
    throw new LifecycleError('FORBIDDEN', '当前角色不能执行这个操作');
  }
  if (!rule.from.includes(current)) {
    throw new LifecycleError('INVALID_STATE', `成果处于“${STATUS_LABELS[current]}”，不能执行这个操作`);
  }
  if (rule.requiresReason && !reason?.trim()) {
    throw new LifecycleError('REASON_REQUIRED', '需要填写原因');
  }
  if (rule.to !== 'by-actor') return rule.to;

  // Saving: a consultant revising during review keeps the review going; any other edit
  // turns the artifact back into a working draft, so earlier confirmations no longer apply.
  const isConsultant = actor.projectRole !== null && CONSULTANTS.includes(actor.projectRole);
  if (isConsultant && current === 'in_review') return 'in_review';
  return 'in_progress';
}

export function requiresValidation(action: LifecycleAction): boolean {
  return RULES[action].validates === true;
}

// ── Unlocking ──

export interface ArtifactState {
  status: ArtifactStatus;
  stale?: boolean;
  /** Set when a consultant granted a step exception for this artifact. */
  exception?: boolean;
}

export type StateMap = Partial<Record<string, ArtifactState>>;

const REACHED_STEP_DONE: ArtifactStatus[] = ['step_done', 'in_review', 'pending_confirm', 'locked', 'archived'];

export function hasReachedStepDone(state: ArtifactState | undefined): boolean {
  return !!state && (REACHED_STEP_DONE.includes(state.status) || !!state.exception);
}

export function isStageComplete(stage: StageKey, states: StateMap): boolean {
  return stageGateCodes(stage).every((code) => {
    const state = states[code];
    return !!state && (state.status === 'locked' || state.status === 'archived');
  });
}

export function isStageOpen(stage: StageKey, states: StateMap): boolean {
  const prev = previousStage(stage);
  return prev === null || isStageComplete(prev, states);
}

export interface UnlockInfo {
  unlocked: boolean;
  /** Human-readable reason when locked. */
  waitingFor?: string;
}

export function unlockInfo(def: ArtifactDef, states: StateMap): UnlockInfo {
  if (!isStageOpen(def.stage, states)) {
    return { unlocked: false, waitingFor: '上一阶段全部 P0 成果定版后开启' };
  }
  if (def.attachedTo) {
    return unlockInfo(getArtifactDef(def.attachedTo), states);
  }
  const pending = def.unlockAfter.filter((code) => !hasReachedStepDone(states[code]));
  if (pending.length > 0) {
    const names = pending.map((code) => `${getArtifactDef(code).specId} ${getArtifactDef(code).name}`);
    return { unlocked: false, waitingFor: `${names.join('、')}“本步完成”后解锁` };
  }
  return { unlocked: true };
}

/** Downstream artifacts to mark “上游已变更” after `code` gets a new step-done or locked version. */
export function staleTargets(code: string, states: StateMap): string[] {
  return ARTIFACTS.filter(
    (a) => a.dependsOn.includes(code) && states[a.code] && states[a.code]!.status !== 'not_started',
  ).map((a) => a.code);
}
