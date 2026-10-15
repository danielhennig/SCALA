import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="grid gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">SCALA</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Escalas de plantão para equipes que trabalham em turnos: hospitais,
          polícia, bombeiros e serviços 24 horas. Monte o mês por regime (12x36,
          24x72, 6x1), publique e cada pessoa vê a própria escala no celular.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/signup" className={buttonVariants({ size: "lg" })}>
          Criar conta
        </Link>
        <Link
          href="/login"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
