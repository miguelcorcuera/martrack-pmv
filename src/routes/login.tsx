import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { callAdminFn } from "@/lib/supabase";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) { setError(error); return; }
    navigate({ to: "/dashboard" });
  };

  const onBootstrap = async () => {
    setBootstrapping(true);
    try {
      const r = await callAdminFn("bootstrap");
      toast.success(`Usuarios demo listos (${r.results?.length ?? 0})`);
    } catch (e: any) {
      toast.error(e.message ?? "Error en bootstrap");
    } finally {
      setBootstrapping(false);
    }
  };

  if (session && !loading) return <Navigate to="/dashboard" />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-semibold">M</div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">grup mar.app</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">MarTrack PMV</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="root@demo.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwd">Contraseña</Label>
            <Input id="pwd" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>

        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Primer arranque (solo una vez)</p>
          <p className="mb-3">Crea los 4 usuarios demo en tu Supabase via Edge Function (contraseña inicial <code className="rounded bg-background px-1 py-0.5">Demo1234!</code>):</p>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={onBootstrap} disabled={bootstrapping}>
            {bootstrapping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear usuarios demo
          </Button>
          <ul className="mt-3 space-y-0.5 text-[11px]">
            <li>root@demo.com</li>
            <li>gerencia@demo.com</li>
            <li>coordinador@demo.com</li>
            <li>supervisor@demo.com</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
