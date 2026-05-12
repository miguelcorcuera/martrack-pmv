import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/perfil")({ component: ProfilePage });

function ProfilePage() {
  const { user, role, fullName } = useAuth();
  return (
    <>
      <PageHeader title="Mi perfil" description="Información de tu sesión." />
      <PageBody>
        <div className="max-w-lg rounded-lg border border-border bg-card p-6">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Nombre</dt><dd>{fullName ?? "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Email</dt><dd>{user?.email}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Rol</dt><dd>{role ?? "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">User ID</dt><dd className="font-mono text-xs">{user?.id}</dd></div>
          </dl>
        </div>
      </PageBody>
    </>
  );
}
