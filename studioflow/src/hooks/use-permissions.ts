"use client";
import { canMutateEntity } from "@/lib/permissions";
import { useWorkspace } from "./use-workspace";
export function usePermissions() {
  const { data } = useWorkspace();
  const role = data?.viewer?.role;
  return {
    role,
    canManage: canMutateEntity(role, "settings"),
    canMutate: (entity: string) => canMutateEntity(role, entity),
  };
}
