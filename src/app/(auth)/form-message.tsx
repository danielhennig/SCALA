export function FormMessage({
  children,
  variant = "error",
}: {
  children: React.ReactNode;
  variant?: "error" | "success";
}) {
  return (
    <p
      role={variant === "error" ? "alert" : "status"}
      className={
        variant === "error"
          ? "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md bg-muted px-3 py-2 text-sm"
      }
    >
      {children}
    </p>
  );
}
