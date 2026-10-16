import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/roles";
import { getSession } from "@/server/auth";
import { getInvitationPreview } from "@/server/services/invitations";
import { SignOutButton } from "../../../(app)/sign-out-button";
import { AcceptInvitationButton } from "./accept-invitation-button";

export const metadata: Metadata = { title: "Convite · SCALA" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Card className="w-full max-w-sm">
      <Suspense
        fallback={
          <CardContent className="text-sm text-muted-foreground">
            Carregando…
          </CardContent>
        }
      >
        <InviteDetails params={params} />
      </Suspense>
    </Card>
  );
}

async function InviteDetails({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();
  const next = encodeURIComponent(`/invite/${token}`);

  if (!session) {
    return (
      <>
        <CardHeader>
          <CardTitle>Você recebeu um convite</CardTitle>
          <CardDescription>
            Entre ou crie uma conta usando o e-mail que recebeu o convite.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Link href={`/login?next=${next}`} className={buttonVariants()}>
            Entrar
          </Link>
          <Link
            href={`/signup?next=${next}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Criar conta
          </Link>
        </CardContent>
      </>
    );
  }

  const invitation = await getInvitationPreview(session, token);

  if (!invitation || invitation.status !== "pending") {
    const reason =
      invitation?.status === "accepted"
        ? "Este convite já foi usado."
        : invitation?.status === "expired"
          ? "Este convite expirou. Peça um novo a quem convidou você."
          : "Este convite não existe ou foi revogado.";
    return (
      <>
        <CardHeader>
          <CardTitle>Convite indisponível</CardTitle>
          <CardDescription>{reason}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/orgs" className={buttonVariants({ variant: "outline" })}>
            Ir para minhas organizações
          </Link>
        </CardContent>
      </>
    );
  }

  const emailMatches =
    session.user.email?.toLowerCase() === invitation.email.toLowerCase();

  return (
    <>
      <CardHeader>
        <CardTitle>{invitation.organizationName}</CardTitle>
        <CardDescription>
          Convite para participar como{" "}
          <strong>{ROLE_LABELS[invitation.role].toLowerCase()}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {emailMatches ? (
          <AcceptInvitationButton token={token} />
        ) : (
          <>
            <p className="text-sm">
              Este convite foi enviado para <strong>{invitation.email}</strong>,
              mas você entrou como <strong>{session.user.email}</strong>. Saia e
              entre com o e-mail convidado.
            </p>
            <div>
              <SignOutButton />
            </div>
          </>
        )}
      </CardContent>
    </>
  );
}
