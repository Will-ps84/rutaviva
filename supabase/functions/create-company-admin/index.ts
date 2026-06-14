import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is super_admin
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (!roleData) return json({ error: "Only super_admin can create companies" }, 403);

    const { company_id, full_name, email, password } = await req.json();
    if (!company_id || !email || !password || !full_name) return json({ error: "Missing fields" }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

    // Create auth user
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr) return json({ error: authErr.message }, 400);

    const userId = authUser.user.id;

    // Set company_id on profile (bypass triggers)
    await admin.rpc('exec_sql', { sql: `UPDATE public.profiles SET company_id = '${company_id}', full_name = '${full_name.replace(/'/g, "''")}' WHERE id = '${userId}'` }).catch(() => null);

    // Upsert profile directly
    await admin.from("profiles").upsert({ id: userId, full_name, company_id }, { onConflict: "id" });

    // Assign owner role
    await admin.from("user_roles").insert({ user_id: userId, company_id, role: "owner", status: "active" });

    return json({ ok: true, user_id: userId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
