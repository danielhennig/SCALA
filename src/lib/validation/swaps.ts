import { z } from "zod";

export const createSwapSchema = z.object({
  offeredShiftId: z.uuid("Escolha o seu plantão."),
  targetId: z.uuid("Escolha o colega."),
  /** Omitted or null: coverage (the colleague takes the shift). */
  requestedShiftId: z.uuid("Escolha o plantão do colega.").nullish(),
});

export type CreateSwapData = z.output<typeof createSwapSchema>;

export const SWAP_ACTIONS = [
  "accept",
  "decline",
  "cancel",
  "approve",
  "reject",
] as const;

export type SwapAction = (typeof SWAP_ACTIONS)[number];

export const swapActionSchema = z.enum(SWAP_ACTIONS);
