import { cn } from "cn";

export function ScheduleStatusBadge({
  status,
}: {
  status: "draft" | "published";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "published"
          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {status === "published" ? "Publicada" : "Rascunho"}
    </span>
  );
}
