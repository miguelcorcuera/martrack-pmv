// MarTrack admin-users Edge Function
// Deploy: supabase functions deploy admin-users --no-verify-jwt
// Secrets requeridos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (NUNCA expongas service_role en el frontend)
// Endpoints (POST JSON con `action`):
//   - bootstrap            -> crea los 4 usuarios demo si no existen
//   - create_user          -> crea usuario auth + vincula a empleado + asigna rol
//   - set_password         -> cambia contraseña a un usuario
//   - set_active           -> activa/bloquea/desactiva acceso (banea o no)
//   - send_reset           -> envía email de recuperación
//
// Llamadas autenticadas: el frontend pasa el JWT del root vía Authorization: Bearer <token>.
// La función valida que el caller tenga rol 'root' antes de actuar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

async function requireRoot(authHeader: string | null) {
  if (!authHeader) return { ok: false, msg: "Missing Authorization header" };
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: uErr } = await userClient.auth.getUser();
  if (uErr || !userData?.user) return { ok: false, msg: "Invalid token" };
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const isRoot = (roles ?? []).some((r: { role: string }) => r.role === "root");
  if (!isRoot) return { ok: false, msg: "Forbidden: root only" };
  return { ok: true, userId: userData.user.id, admin };
}

async function bootstrap() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const seed = [
    { email: "root@demo.com",        password: "Demo1234!", role: "root",        full_name: "Root Demo" },
    { email: "gerencia@demo.com",    password: "Demo1234!", role: "gerencia",    full_name: "Gerencia Demo" },
    { email: "coordinador@demo.com", password: "Demo1234!", role: "coordinador", full_name: "Coordinador Demo" },
    { email: "supervisor@demo.com",  password: "Demo1234!", role: "supervisor",  full_name: "Supervisor Demo" },
  ];
  const results: Array<Record<string, unknown>> = [];
  for (const s of seed) {
    // ¿Ya existe?
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === s.email);
    let userId = existing?.id;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: s.email, password: s.password, email_confirm: true,
        user_metadata: { full_name: s.full_name },
      });
      if (error) { results.push({ email: s.email, error: error.message }); continue; }
      userId = data.user.id;
    }
    if (userId) {
      await admin.from("user_roles").upsert(
        { user_id: userId, role: s.role },
        { onConflict: "user_id,role" },
      );
      await admin.from("profiles").upsert(
        { id: userId, email: s.email, full_name: s.full_name },
        { onConflict: "id" },
      );
      // Vincular a un empleado del seed si el rol es supervisor/coordinador
      if (s.role === "supervisor" || s.role === "coordinador") {
        const { data: emp } = await admin
          .from("employees")
          .select("id")
          .eq("role_operational", s.role)
          .is("auth_user_id", null)
          .limit(1)
          .maybeSingle();
        if (emp?.id) {
          await admin.from("employees").update({
            auth_user_id: userId,
            access_status: "activo",
            email: s.email,
          }).eq("id", emp.id);
        }
      }
      results.push({ email: s.email, userId, status: existing ? "exists" : "created" });
    }
  }
  return json(200, { ok: true, results });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const { action } = body ?? {};

  // bootstrap es público (idempotente, solo crea si no existen) — quítalo a la 1ª ejecución si quieres.
  if (action === "bootstrap") return bootstrap();

  const auth = await requireRoot(req.headers.get("authorization"));
  if (!auth.ok) return json(401, { error: auth.msg });
  const admin = auth.admin!;

  try {
    if (action === "create_user") {
      const { email, password, full_name, role, employee_id } = body;
      if (!email || !password || !role) return json(400, { error: "email, password, role required" });
      if (password.length < 8) return json(400, { error: "Contraseña mínimo 8 caracteres" });

      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (error) return json(400, { error: error.message });

      await admin.from("user_roles").upsert(
        { user_id: data.user.id, role },
        { onConflict: "user_id,role" },
      );
      await admin.from("profiles").upsert(
        { id: data.user.id, email, full_name },
        { onConflict: "id" },
      );
      if (employee_id) {
        await admin.from("employees").update({
          auth_user_id: data.user.id, access_status: "activo", email,
        }).eq("id", employee_id);
      }
      await admin.from("audit_log").insert({
        actor_user_id: auth.userId, actor_role: "root",
        entity_type: "user", entity_id: data.user.id,
        action: "acceso_creado",
        new_value: { email, role, employee_id },
        description: `Acceso creado para ${email} con rol ${role}`,
      });
      return json(200, { ok: true, userId: data.user.id });
    }

    if (action === "set_password") {
      const { user_id, password } = body;
      if (!user_id || !password) return json(400, { error: "user_id, password required" });
      if (password.length < 8) return json(400, { error: "Contraseña mínimo 8 caracteres" });
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json(400, { error: error.message });
      await admin.from("audit_log").insert({
        actor_user_id: auth.userId, actor_role: "root",
        entity_type: "user", entity_id: user_id,
        action: "password_reseteada",
        description: "Contraseña actualizada por root",
      });
      return json(200, { ok: true });
    }

    if (action === "set_active") {
      // status: 'activo' | 'bloqueado' | 'inactivo'
      const { user_id, status, employee_id } = body;
      if (!user_id || !status) return json(400, { error: "user_id, status required" });
      const banDuration = status === "activo" ? "none" : "876000h"; // ~100 años
      // @ts-ignore - admin.updateUserById acepta ban_duration
      const { error } = await admin.auth.admin.updateUserById(user_id, { ban_duration: banDuration });
      if (error) return json(400, { error: error.message });
      if (employee_id) {
        await admin.from("employees").update({ access_status: status }).eq("id", employee_id);
      }
      await admin.from("audit_log").insert({
        actor_user_id: auth.userId, actor_role: "root",
        entity_type: "user", entity_id: user_id,
        action: status === "activo" ? "acceso_reactivado" : "acceso_bloqueado",
        new_value: { status },
        description: `Acceso establecido a ${status}`,
      });
      return json(200, { ok: true });
    }

    if (action === "send_reset") {
      const { email, redirect_to } = body;
      if (!email) return json(400, { error: "email required" });
      const { error } = await admin.auth.admin.generateLink({
        type: "recovery", email,
        options: redirect_to ? { redirectTo: redirect_to } : undefined,
      });
      if (error) return json(400, { error: error.message });
      await admin.from("audit_log").insert({
        actor_user_id: auth.userId, actor_role: "root",
        entity_type: "user",
        action: "password_reseteada",
        new_value: { email, method: "email_link" },
        description: `Email de reset enviado a ${email}`,
      });
      return json(200, { ok: true });
    }

    if (action === "set_role") {
      const { user_id, role } = body;
      if (!user_id || !role) return json(400, { error: "user_id, role required" });
      // Reemplaza roles del usuario por el nuevo rol único
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("user_roles").insert({ user_id, role });
      await admin.from("audit_log").insert({
        actor_user_id: auth.userId, actor_role: "root",
        entity_type: "user", entity_id: user_id,
        action: "rol_cambiado", new_value: { role },
        description: `Rol cambiado a ${role}`,
      });
      return json(200, { ok: true });
    }

    return json(400, { error: `Unknown action: ${action}` });
  } catch (e: any) {
    return json(500, { error: e?.message ?? "Internal error" });
  }
});
