import { requireUser } from "@/server/auth";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu() {
  const { user } = await requireUser();

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-muted-foreground sm:inline">
        {user.email}
      </span>
      <SignOutButton />
    </div>
  );
}
