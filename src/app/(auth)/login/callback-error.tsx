"use client";

import { useSearchParams } from "next/navigation";
import { FormMessage } from "../form-message";

export function CallbackError() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "callback") return null;
  return (
    <FormMessage>
      O link de confirmação é inválido ou expirou. Tente entrar novamente.
    </FormMessage>
  );
}
