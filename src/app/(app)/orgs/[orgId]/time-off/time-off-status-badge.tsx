import { cn } from "cn";
import { TIME_OFF_STATUS_LABELS, type TimeOffStatus } from "@/lib/time-off";

export function TimeOffStatusBadge({ status }: { status: TimeOffStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "approved" &&
          "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
        status === "pending" &&
          "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        status === "rejected" && "bg-muted text-muted-foreground",
      )}
    >
      {TIME_OFF_STATUS_LABELS[status]}
    </span>
  );
}
