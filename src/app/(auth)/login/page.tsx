import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CallbackError } from "./callback-error";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · SCALA" };

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse as escalas da sua equipe.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Suspense fallback={null}>
          <CallbackError />
        </Suspense>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
