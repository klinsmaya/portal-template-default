import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProfileItem } from "@dingze/shared";

import { type ProjectSummary, spaceHeaders } from "./api";

export type MaterialSummary = { id: number; title: string; kind: "file" | "note"; fileName: string; size: number; chars: number; at: string; by: string; byId: number };
export type MaterialDetail = { id: number; title: string; fileName: string; chars: number; offset: number; text: string };
export type ProfileRecord = { items: ProfileItem[]; rev: number; updatedAt: string | null; updatedBy: string };

const keys = {
  materials: (projectId: number) => ["dingze", "materials", projectId] as const,
  material: (projectId: number, id: number) => ["dingze", "material", projectId, id] as const,
  profile: (projectId: number) => ["dingze", "profile", projectId] as const,
};

const get = <T>(project: ProjectSummary, action: string, query: Record<string, unknown> = {}) =>
  nocobaseClient.action<T>("dingze", action, { method: "GET", query: { projectId: project.id, ...query }, headers: spaceHeaders(project.spaceName) });
const post = <T>(project: ProjectSummary, action: string, body: Record<string, unknown>) =>
  nocobaseClient.action<T>("dingze", action, { body: { projectId: project.id, ...body }, headers: spaceHeaders(project.spaceName) });

export const readMaterial = (project: ProjectSummary, id: number, offset = 0) => get<MaterialDetail>(project, "getMaterial", { id, offset });

export function useMaterials(project: ProjectSummary) {
  return useQuery({ queryKey: keys.materials(project.id), queryFn: () => get<MaterialSummary[]>(project, "listMaterials") });
}

export function useMaterial(project: ProjectSummary, id: number | null) {
  return useQuery({ queryKey: keys.material(project.id, id ?? 0), queryFn: () => readMaterial(project, id!), enabled: !!id });
}

export function useAddMaterial(project: ProjectSummary) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: { title: string; kind: "file" | "note"; fileName?: string; size?: number; text: string }) => post<{ id: number; truncated: boolean }>(project, "addMaterial", values),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.materials(project.id) }),
  });
}

export function useDeleteMaterial(project: ProjectSummary) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => post(project, "deleteMaterial", { id }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.materials(project.id) }),
  });
}

export function useProfile(project: ProjectSummary) {
  return useQuery({ queryKey: keys.profile(project.id), queryFn: () => get<ProfileRecord>(project, "getProfile") });
}

export function useSaveProfile(project: ProjectSummary) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: { items: ProfileItem[]; baseRev: number }) => post<{ rev: number; items: ProfileItem[] }>(project, "saveProfile", values),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.profile(project.id) }),
  });
}
