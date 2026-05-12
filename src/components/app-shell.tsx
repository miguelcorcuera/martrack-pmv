import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Car, Building2, Users, KeyRound,
  ClipboardList, Image as ImageIcon, ShieldCheck, Settings, UserCircle, LogOut,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/dashboard",     label: "Dashboard",    icon: <LayoutDashboard className="h-4 w-4" />, roles: ["root","gerencia","coordinador","supervisor"] },
  { to: "/vehiculos",     label: "Vehículos",    icon: <Car className="h-4 w-4" />,             roles: ["root","gerencia","coordinador","supervisor"] },
  { to: "/ayuntamientos", label: "Ayuntamientos",icon: <Building2 className="h-4 w-4" />,       roles: ["root","gerencia","coordinador"] },
  { to: "/empleados",     label: "Empleados",    icon: <Users className="h-4 w-4" />,           roles: ["root","gerencia","coordinador"] },
  { to: "/entregas",      label: "Entregas",     icon: <ClipboardList className="h-4 w-4" />,   roles: ["root","gerencia","coordinador","supervisor"] },
  { to: "/evidencias",    label: "Evidencias",   icon: <ImageIcon className="h-4 w-4" />,       roles: ["root","gerencia","coordinador","supervisor"] },
  { to: "/accesos",       label: "Admin. accesos",icon: <KeyRound className="h-4 w-4" />,       roles: ["root"] },
  { to: "/auditoria",     label: "Auditoría",    icon: <ShieldCheck className="h-4 w-4" />,     roles: ["root","gerencia"] },
  { to: "/perfil",        label: "Mi perfil",    icon: <UserCircle className="h-4 w-4" />,      roles: ["root","gerencia","coordinador","supervisor"] },
  { to: "/configuracion", label: "Configuración",icon: <Settings className="h-4 w-4" />,        roles: ["root"] },
];

export function AppShell() {
  const { role, fullName, user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const items = NAV.filter((n) => role && n.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">M</div>
          <div>
            <div className="text-sm font-semibold leading-tight">MarTrack</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">PMV</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {items.map((item) => {
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2">
            <div className="truncate text-sm font-medium">{fullName ?? user?.email}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{role}</div>
          </div>
          <button
            type="button"
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
