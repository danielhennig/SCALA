import type { Database } from "@/types/database";

export type SwapStatus = Database["public"]["Enums"]["swap_status"];

export const SWAP_STATUS_LABELS: Record<SwapStatus, string> = {
  pending_target: "Aguardando colega",
  pending_approval: "Aguardando gestor",
  approved: "Aprovada",
  declined: "Recusada pelo colega",
  rejected: "Recusada pelo gestor",
  cancelled: "Cancelada",
};

export function isSwapPending(status: SwapStatus): boolean {
  return status === "pending_target" || status === "pending_approval";
}
