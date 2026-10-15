"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH, signupSchema } from "@/lib/validation/auth";
import { FormMessage } from "../form-message";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signupSchema.safeParse({
      fullName: form.get("fullName"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setPending(true);
    setError(null);
    const { fullName, email, password } = parsed.data;
    const { data, error: authError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/orgs`,
      },
    });
    setPending(false);

    if (authError) {
      setError(
        authError.code === "weak_password"
          ? `Senha fraca. Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
          : authError.code === "user_already_exists"
            ? "Já existe uma conta com esse e-mail."
            : authError.code === "over_email_send_rate_limit"
              ? "Muitas tentativas. Aguarde alguns minutos."
              : "Não foi possível criar a conta. Tente novamente.",
      );
      return;
    }

    // With e-mail confirmation disabled (local dev) Supabase returns a session
    // right away; otherwise the user must click the link sent by e-mail.
    if (data.session) {
      router.replace("/orgs");
      router.refresh();
    } else {
      setConfirmationSent(true);
    }
  }

  if (confirmationSent) {
    return (
      <FormMessage variant="success">
        Enviamos um link de confirmação para o seu e-mail. Abra-o neste
        navegador para ativar a conta.
      </FormMessage>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          maxLength={120}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />
        <p className="text-xs text-muted-foreground">
          Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      </div>
      {error && <FormMessage>{error}</FormMessage>}
      <Button type="submit" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
