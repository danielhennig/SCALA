import type { Database } from "@/types/database";

export type TimeOffKind = Database["public"]["Enums"]["time_off_kind"];
export type TimeOffStatus = Database["public"]["Enums"]["time_off_status"];

export const TIME_OFF_KINDS = [
  "vacation",
  "medical",
  "leave",
  "other",
] as const satisfies readonly TimeOffKind[];

export const TIME_OFF_KIND_LABELS: Record<TimeOffKind, string> = {
  vacation: "Férias",
  medical: "Licença médica",
  leave: "Licença",
  other: "Afastamento",
};

/** One letter for grid cells (full label goes in the tooltip). */
export const TIME_OFF_KIND_LETTERS: Record<TimeOffKind, string> = {
  vacation: "F",
  medical: "M",
  leave: "L",
  other: "A",
};

export const TIME_OFF_STATUS_LABELS: Record<TimeOffStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
};
