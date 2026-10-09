import type { Context } from '@nocobase/actions';

import { MATERIAL_TEXT_LIMIT, type EnterpriseProfile, reconcileProfile, searchSnippets } from '../../shared';
import { HttpError, type ProjectContext, currentUserId } from './access';

// 资料与企业画像. Materials hold extracted text only (the browser extracts it from the upload),
// so nothing outside the enterprise's space is stored and every read goes through the project check.

const who = (user: any) => (user ? user.get('nickname') || user.get('username') || '' : '');

function requireEditor(pc: ProjectContext) {
  if (pc.access.isConsultAdmin) return;
  if (!pc.projectRole || pc.projectRole === 'readonly') throw new HttpError(403, '只读成员不能修改资料与画像');
}

export async function listMaterials(ctx: Context, pc: ProjectContext) {
  const rows = await ctx.db.getRepository('dz_materials').find({
    filter: { projectId: pc.project.get('id') },
    fields: ['id', 'title', 'kind', 'fileName', 'size', 'chars', 'createdAt', 'createdById'],
    appends: ['createdBy'],
    sort: ['-createdAt'],
  });
  return rows.map((m: any) => ({
    id: Number(m.get('id')),
    title: m.get('title'),
    kind: m.get('kind'),
    fileName: m.get('fileName') ?? '',
    size: m.get('size') ?? 0,
    chars: m.get('chars') ?? 0,
    at: m.get('createdAt'),
    by: who(m.get('createdBy')),
    byId: m.get('createdById'),
  }));
}

export async function getMaterial(ctx: Context, pc: ProjectContext, id: unknown, offset: unknown) {
  const m = await ctx.db.getRepository('dz_materials').findOne({ filter: { id: Number(id), projectId: pc.project.get('id') } });
  if (!m) throw new HttpError(404, '资料不存在');
  const text = (m.get('text') as string) ?? '';
  const from = Math.max(0, Number(offset) || 0);
  return { id: Number(m.get('id')), title: m.get('title'), fileName: m.get('fileName') ?? '', chars: text.length, offset: from, text: text.slice(from, from + 20_000) };
}

export async function addMaterial(ctx: Context, pc: ProjectContext, input: { title?: unknown; kind?: unknown; fileName?: unknown; size?: unknown; text?: unknown }) {
  requireEditor(pc);
  const text = String(input.text ?? '').trim();
  if (!text) throw new HttpError(400, '没有读到文字内容');
  const title = String(input.title ?? input.fileName ?? '').trim().slice(0, 200) || '未命名资料';
  const stored = text.slice(0, MATERIAL_TEXT_LIMIT);
  const m = await ctx.db.getRepository('dz_materials').create({
    values: {
      projectId: pc.project.get('id'),
      title,
      kind: input.kind === 'note' ? 'note' : 'file',
      fileName: String(input.fileName ?? '').slice(0, 200),
      size: Number(input.size) || 0,
      text: stored,
      chars: stored.length,
      spaceName: pc.spaceName,
    },
    context: ctx,
  });
  return { id: Number(m.get('id')), truncated: text.length > MATERIAL_TEXT_LIMIT };
}

export async function deleteMaterial(ctx: Context, pc: ProjectContext, id: unknown) {
  requireEditor(pc);
  const m = await ctx.db.getRepository('dz_materials').findOne({ filter: { id: Number(id), projectId: pc.project.get('id') } });
  if (!m) throw new HttpError(404, '资料不存在');
  const mine = m.get('createdById') === currentUserId(ctx);
  if (!mine && !pc.access.isConsultAdmin && !['ent_lead', 'lead_consultant'].includes(pc.projectRole ?? '')) {
    throw new HttpError(403, '只有上传人、企业项目负责人或主咨询师可以删除资料');
  }
  await m.destroy();
  return { ok: true };
}

export async function searchMaterials(ctx: Context, pc: ProjectContext, query: unknown) {
  const rows = await ctx.db.getRepository('dz_materials').find({ filter: { projectId: pc.project.get('id') }, fields: ['id', 'title', 'text'] });
  return searchSnippets(
    rows.map((m: any) => ({ id: m.get('id'), title: m.get('title'), text: m.get('text') ?? '' })),
    String(query ?? ''),
  );
}

export async function getProfile(ctx: Context, pc: ProjectContext) {
  const row = await ctx.db.getRepository('dz_profiles').findOne({ filter: { projectId: pc.project.get('id') }, appends: ['updatedBy'] });
  return { items: (row?.get('items') as EnterpriseProfile['items']) ?? [], rev: row?.get('rev') ?? 0, updatedAt: row?.get('updatedAt') ?? null, updatedBy: who(row?.get('updatedBy')) };
}

export async function saveProfile(ctx: Context, pc: ProjectContext, input: { items?: unknown; baseRev?: unknown }) {
  requireEditor(pc);
  const repo = ctx.db.getRepository('dz_profiles');
  const projectId = pc.project.get('id');
  return ctx.db.sequelize.transaction(async (transaction: any) => {
    const row = await repo.findOne({ filter: { projectId }, transaction });
    const rev = row?.get('rev') ?? 0;
    if (Number(input.baseRev ?? 0) !== rev) throw new HttpError(409, '画像刚被其他人更新过，请刷新后再改', 'CONFLICT', { rev });
    const previous = { items: (row?.get('items') as EnterpriseProfile['items']) ?? [] };
    const next = { items: Array.isArray(input.items) ? (input.items as EnterpriseProfile['items']) : [] };
    const { profile, error } = reconcileProfile(previous, next, pc.projectRole, pc.access.isConsultAdmin);
    if (error) throw new HttpError(403, error);
    if (row) await row.update({ items: profile.items, rev: rev + 1, updatedById: currentUserId(ctx) }, { transaction });
    else await repo.create({ values: { projectId, items: profile.items, rev: 1, spaceName: pc.spaceName }, context: ctx, transaction });
    return { rev: rev + 1, items: profile.items };
  });
}
