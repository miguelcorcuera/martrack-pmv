import {
  createContext, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/types";

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  fullName: string | null;
  isRoot: boolean;
  isCoordinator: boolean;
  isSupervisor: boolean;
  isManagement: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  const loadRoleAndProfile = async (userId: string) => {
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    const list = (roles ?? []).map((r) => r.role as AppRole);
    const priority: AppRole[] = ["root", "gerencia", "coordinador", "supervisor"];
    const chosen = priority.find((p) => list.includes(p)) ?? null;
    setRole(chosen);
    setFullName(profile?.full_name ?? null);
  };

  useEffect(() => {
    let mounted = true;
    // 1) listener PRIMERO (regla obligatoria)
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        // diferir al microtask para evitar deadlocks con supabase client
        setTimeout(() => loadRoleAndProfile(s.user.id), 0);
      } else {
        setRole(null);
        setFullName(null);
      }
    });
    // 2) sesión actual
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) await loadRoleAndProfile(data.session.user.id);
      setLoading(false);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const value: AuthCtx = useMemo(() => ({
    loading,
    session,
    user: session?.user ?? null,
    role,
    fullName,
    isRoot: role === "root",
    isCoordinator: role === "coordinador",
    isSupervisor: role === "supervisor",
    isManagement: role === "gerencia",
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signOut: async () => { await supabase.auth.signOut(); },
    refreshRole: async () => {
      if (session?.user) await loadRoleAndProfile(session.user.id);
    },
  }), [loading, session, role, fullName]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
