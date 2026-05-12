import { supabase } from "./supabase";
import type { AppRole } from "./types";

export async function logAudit(params: {
  entity_type: string;
  entity_id?: string | null;
  action: string;
  description?: string;
  previous_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  actor_role?: AppRole | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("audit_log").insert({
    actor_user_id: u.user.id,
    actor_role: params.actor_role ?? null,
    entity_type: params.entity_type,
    entity_id: params.entity_id ?? null,
    action: params.action,
    description: params.description ?? null,
    previous_value: params.previous_value ?? null,
    new_value: params.new_value ?? null,
  });
}
