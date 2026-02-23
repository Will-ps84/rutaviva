import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { phone, password } = await req.json();

    if (!phone || !password) {
      return new Response(JSON.stringify({ error: "phone and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign in with phone + password
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      phone: phone.trim(),
      password,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: signInError.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has driver role
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", signInData.user.id)
      .eq("role", "driver")
      .eq("status", "active")
      .maybeSingle();

    if (!role) {
      return new Response(JSON.stringify({ error: "User is not an active driver" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      user_id: signInData.user.id,
      company_id: role.company_id,
      expires_at: signInData.session.expires_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
