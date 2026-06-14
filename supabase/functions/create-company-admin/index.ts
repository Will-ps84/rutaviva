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

    const { company_name, plan, full_name, email, password } = await req.json();
    if (!company_name || !email || !password || !full_name) return json({ error: "Missing fields" }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

    // 1. Create company using service role (bypasses handle_company_created trigger's auth.uid())
    const { data: company, error: companyErr } = await admin
      .from("companies")
      .insert({ name: company_name.trim(), plan_name: plan || "free" })
      .select("id")
      .single();
    if (companyErr) return json({ error: companyErr.message }, 400);

    const companyId = company.id;

    // 2. Create auth user
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr) {
      // Rollback company
      await admin.from("companies").delete().eq("id", companyId);
      return json({ error: authErr.message }, 400);
    }

    const userId = authUser.user.id;

    // 3. Set profile company using the bypass function
    const { error: profileErr } = await admin.rpc('set_profile_company', {
      p_user_id: userId,
      p_company_id: companyId,
      p_full_name: full_name,
    });
    if (profileErr) {
      await admin.from("profiles").upsert({ id: userId, full_name, company_id: companyId }, { onConflict: "id" });
    }

    // 4. Assign owner role
    await admin.from("user_roles").insert({ user_id: userId, company_id: companyId, role: "owner", status: "active" });

    return json({ ok: true, user_id: userId, company_id: companyId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
