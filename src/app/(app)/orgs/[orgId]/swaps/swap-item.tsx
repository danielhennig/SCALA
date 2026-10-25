import { cn } from "cn";
import { formatShiftLabel } from "@/lib/format";
import { isSwapPending, SWAP_STATUS_LABELS } from "@/lib/swaps";
import type { ShiftSwap } from "@/server/services/swaps";

/** One swap/coverage request, with an optional actions slot. */
export function SwapItem({
  swap,
  timeZone,
  children,
}: {
  swap: ShiftSwap;
  timeZone: string;
  children?: React.ReactNode;
}) {
  const isCoverage = swap.requested === null;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 p-3">
      <div className="grid min-w-0 gap-1 text-sm">
        <div className="font-medium">
          {isCoverage
            ? `${swap.requesterName} pede que ${swap.targetName} cubra`
            : `${swap.requesterName} propõe troca com ${swap.targetName}`}
        </div>
        <div className="text-muted-foreground">
          {isCoverage ? "Plantão: " : `${swap.requesterName} entrega: `}
          {formatShiftLabel(swap.offered, timeZone)}
        </div>
        {swap.requested && (
          <div className="text-muted-foreground">
            {swap.requesterName} recebe:{" "}
            {formatShiftLabel(swap.requested, timeZone)}
          </div>
        )}
        {swap.warnings.map((warning) => (
          <div key={warning} className="text-amber-700 dark:text-amber-400">
            ⚠ {warning}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            isSwapPending(swap.status)
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              : swap.status === "approved"
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : "bg-muted text-muted-foreground",
          )}
        >
          {SWAP_STATUS_LABELS[swap.status]}
        </span>
        {children}
      </div>
    </li>
  );
}
