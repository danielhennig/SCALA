"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { type OrgRole, ROLE_LABELS } from "@/lib/roles";
import { createInvitationSchema } from "@/lib/validation/members";

type CreatedInvitation = { email: string; token: string };

export function InviteForm({
  orgId,
  roles,
}: {
  orgId: string;
  roles: OrgRole[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{
    email: string;
    link: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createInvitationSchema.safeParse({ email, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setPending(true);
    setError(null);
    setCopied(false);
    try {
      const invitation = await apiFetch<CreatedInvitation>(
        `/api/v1/orgs/${orgId}/invitations`,
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      setCreated({
        email: invitation.email,
        link: `${window.location.origin}/invite/${invitation.token}`,
      });
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
    } catch {
      setError(
        "Não foi possível copiar. Selecione o link e copie manualmente.",
      );
    }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="invite-email">E-mail</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nome@hospital.org"
          />
        </div>
        {roles.length > 1 && (
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Papel</Label>
            <NativeSelect
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as OrgRole)}
            >
              {roles.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="justify-self-start">
          {pending ? "Gerando…" : "Gerar link de convite"}
        </Button>
      </form>

      {created && (
        <div
          role="status"
          className="grid gap-2 rounded-lg bg-muted p-3 text-sm"
        >
          <p>
            Link para <strong>{created.email}</strong>. Ele só aparece agora:
            copie e envie.
          </p>
          <Input
            readOnly
            value={created.link}
            onFocus={(e) => e.target.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="justify-self-start"
          >
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
        </div>
      )}
    </div>
  );
}
