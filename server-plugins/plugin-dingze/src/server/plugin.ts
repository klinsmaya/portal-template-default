import type { Context, Next } from '@nocobase/actions';
import { Plugin } from '@nocobase/server';

import type { LifecycleAction } from '../shared';
import { HttpError, SYSTEM_ROLES, loadProjectContext } from './services/access';
import {
  artifactDetail,
  grantStepException,
  projectOverview,
  recordDissent,
  requireArtifactDef,
  saveArtifact,
  toHttpError,
  transitionArtifact,
} from './services/artifacts';
import { createProject, listEnterprises, myProjects, provisionEnterprise, setProjectMembers } from './services/enterprises';

const TRANSITIONS: LifecycleAction[] = [
  'stepDone',
  'submitReview',
  'approve',
  'returnToEdit',
  'confirm',
  'reopen',
  'forceLock',
  'forceReturn',
];

const ROLE_DEFINITIONS = [
  { name: SYSTEM_ROLES.consultAdmin, title: '定责 · 咨询管理员' },
  { name: SYSTEM_ROLES.consultant, title: '定责 · 咨询师' },
  { name: SYSTEM_ROLES.entAdmin, title: '定责 · 企业管理员' },
  { name: SYSTEM_ROLES.entMember, title: '定责 · 企业成员' },
  { name: SYSTEM_ROLES.ops, title: '定责 · 运营管理员' },
];

type Handler = (ctx: Context) => Promise<unknown>;

/** Wrap a handler so domain errors become JSON responses with a stable `code`. */
function action(handler: Handler) {
  return async (ctx: Context, next: Next) => {
    try {
      ctx.body = await handler(ctx);
    } catch (raw) {
      const error = toHttpError(raw);
      if (error instanceof HttpError) {
        ctx.status = error.status;
        ctx.body = { errors: [{ message: error.message, code: error.code, details: error.details }] };
        return;
      }
      throw error;
    }
    await next();
  };
}

function values(ctx: Context): Record<string, any> {
  return (ctx.action.params.values ?? {}) as Record<string, any>;
}

export class PluginDingzeServer extends Plugin {
  async load() {
    this.app.resourceManager.define({
      name: 'dingze',
      actions: {
        myProjects: action((ctx) => myProjects(ctx)),
        projectOverview: action(async (ctx) => {
          const pc = await loadProjectContext(ctx, ctx.action.params.projectId);
          return projectOverview(ctx, pc);
        }),
        artifactDetail: action(async (ctx) => {
          const pc = await loadProjectContext(ctx, ctx.action.params.projectId);
          return artifactDetail(ctx, pc, requireArtifactDef(ctx.action.params.code));
        }),
        saveArtifact: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return saveArtifact(ctx, pc, requireArtifactDef(v.code), {
            payload: v.payload,
            baseRev: Number(v.baseRev ?? 0),
            note: v.note,
            fromProposalId: v.fromProposalId ? Number(v.fromProposalId) : undefined,
            aiSuggested: v.aiSuggested === true,
          });
        }),
        transition: action(async (ctx) => {
          const v = values(ctx);
          if (!TRANSITIONS.includes(v.action)) throw new HttpError(400, '未知的操作');
          const pc = await loadProjectContext(ctx, v.projectId);
          return transitionArtifact(ctx, pc, requireArtifactDef(v.code), v.action, v.reason);
        }),
        recordDissent: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return recordDissent(ctx, pc, requireArtifactDef(v.code), v.content);
        }),
        grantException: action(async (ctx) => {
          const v = values(ctx);
          const pc = await loadProjectContext(ctx, v.projectId);
          return grantStepException(ctx, pc, requireArtifactDef(v.code), v.reason);
        }),
        provisionEnterprise: action((ctx) => provisionEnterprise(ctx, values(ctx) as any)),
        listEnterprises: action((ctx) => listEnterprises(ctx)),
        createProject: action((ctx) => createProject(ctx, values(ctx) as any)),
        setProjectMembers: action((ctx) => setProjectMembers(ctx, values(ctx).projectId, values(ctx).members)),
      },
    });
    // Every handler checks space membership, project role and artifact status itself.
    this.app.acl.allow('dingze', '*', 'loggedIn');
  }

  async install() {
    const repo = this.db.getRepository('roles');
    for (const role of ROLE_DEFINITIONS) {
      const existing = await repo.findOne({ filterByTk: role.name });
      if (!existing) {
        await repo.create({ values: { ...role, hidden: false, allowConfigure: false, strategy: { actions: [] } } });
      }
    }
  }
}

export default PluginDingzeServer;
