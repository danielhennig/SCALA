import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/roles";
import { requireUser } from "@/server/auth";
import { listMyOrganizations } from "@/server/services/organizations";
import { CreateOrganizationForm } from "./create-organization-form";

export const metadata: Metadata = { title: "Organizações · SCALA" };

export default function OrganizationsPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Suas organizações
        </h1>
        <p className="text-sm text-muted-foreground">
          Hospitais, batalhões ou unidades onde você participa das escalas.
        </p>
      </div>

      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
      >
        <OrganizationList />
      </Suspense>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Nova organização</CardTitle>
          <CardDescription>Você será o administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
}

async function OrganizationList() {
  const auth = await requireUser();
  const organizations = await listMyOrganizations(auth);

  if (organizations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Você ainda não participa de nenhuma organização. Crie a primeira abaixo.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {organizations.map((organization) => (
        <li key={organization.id}>
          <Link
            href={`/orgs/${organization.id}`}
            className="block rounded-lg border p-4 transition-colors hover:bg-muted"
          >
            <div className="font-medium">{organization.name}</div>
            <div className="text-sm text-muted-foreground">
              {ROLE_LABELS[organization.role]} · {organization.slug}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
