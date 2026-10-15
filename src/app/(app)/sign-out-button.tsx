"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const { error } = await createClient().auth.signOut();
    if (error) {
      // Local cookies are cleared even when the server call fails; still log it.
      console.error("sign out failed", error);
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      Sair
    </Button>
  );
}
