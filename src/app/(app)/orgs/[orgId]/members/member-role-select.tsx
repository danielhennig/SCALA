"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { ORG_ROLES, type OrgRole, ROLE_LABELS } from "@/lib/roles";

export function MemberRoleSelect({
  orgId,
  userId,
  role,
  label,
}: {
  orgId: string;
  userId: string;
  role: OrgRole;
  label: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: OrgRole) {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/orgs/${orgId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: next }),
      });
      router.refresh();
    } catch (err) {
      setValue(previous);
      setError(
        err instanceof ApiClientError ? err.message : "Erro inesperado.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <NativeSelect
        aria-label={label}
        value={value}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as OrgRole)}
        className="w-36"
      >
        {ORG_ROLES.map((option) => (
          <option key={option} value={option}>
            {ROLE_LABELS[option]}
          </option>
        ))}
      </NativeSelect>
      {error && (
        <span
          role="alert"
          className="max-w-56 text-right text-xs text-destructive"
        >
          {error}
        </span>
      )}
    </span>
  );
}
