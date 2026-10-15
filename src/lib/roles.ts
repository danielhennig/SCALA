import type { Database } from "@/types/database";

export type OrgRole = Database["public"]["Enums"]["org_role"];

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Administrador",
  manager: "Gestor",
  member: "Membro",
};
