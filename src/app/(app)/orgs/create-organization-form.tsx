"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { slugify } from "@/lib/slug";
import {
  type CreateOrganizationInput,
  createOrganizationSchema,
  DEFAULT_TIMEZONE,
} from "@/lib/validation/organizations";

const BRAZIL_TIMEZONES = [
  { value: "America/Noronha", label: "Fernando de Noronha (UTC−2)" },
  { value: "America/Sao_Paulo", label: "Brasília (UTC−3)" },
  { value: "America/Manaus", label: "Amazonas (UTC−4)" },
  { value: "America/Rio_Branco", label: "Acre (UTC−5)" },
];

type FieldErrors = Partial<Record<keyof CreateOrganizationInput, string>>;

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const input: CreateOrganizationInput = { name, slug, timezone };
    const parsed = createOrganizationSchema.safeParse(input);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CreateOrganizationInput;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setPending(true);
    try {
      const organization = await apiFetch<{ id: string }>("/api/v1/orgs", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      router.push(`/orgs/${organization.id}`);
    } catch (error) {
      setPending(false);
      if (error instanceof ApiClientError) {
        if (error.code === "CONFLICT") setFieldErrors({ slug: error.message });
        else setFormError(error.message);
      } else {
        setFormError("Erro inesperado.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="org-name">Nome</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
          placeholder="Hospital Municipal — UTI"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "org-name-error" : undefined}
          maxLength={100}
        />
        {fieldErrors.name && (
          <FieldError id="org-name-error">{fieldErrors.name}</FieldError>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="org-slug">Identificador</Label>
        <Input
          id="org-slug"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugEdited(true);
          }}
          placeholder="hospital-municipal-uti"
          aria-invalid={Boolean(fieldErrors.slug)}
          aria-describedby="org-slug-hint"
          maxLength={50}
        />
        {fieldErrors.slug ? (
          <FieldError id="org-slug-hint">{fieldErrors.slug}</FieldError>
        ) : (
          <p id="org-slug-hint" className="text-xs text-muted-foreground">
            Letras minúsculas, números e hífens. Precisa ser único.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="org-timezone">Fuso horário</Label>
        <select
          id="org-timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm dark:bg-input/30"
        >
          {BRAZIL_TIMEZONES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Criando…" : "Criar organização"}
      </Button>
    </form>
  );
}

function FieldError({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <p id={id} className="text-xs text-destructive">
      {children}
    </p>
  );
}
