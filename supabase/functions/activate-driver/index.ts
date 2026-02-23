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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { phone, code, new_password } = await req.json();

    if (!phone || !code || !new_password) {
      return new Response(JSON.stringify({ error: "phone, code, and new_password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof new_password !== "string" || new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.trim();
    const cleanCode = code.trim().toUpperCase();

    // Find activation code
    const { data: activation, error: activationError } = await supabaseAdmin
      .from("driver_activation_codes")
      .select("*, profiles:driver_profile_id(id, phone)")
      .eq("code", cleanCode)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (activationError || !activation) {
      return new Response(JSON.stringify({ error: "Invalid or expired activation code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify phone matches the driver's profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", activation.driver_profile_id)
      .single();

    if (!profile || profile.phone !== cleanPhone) {
      return new Response(JSON.stringify({ error: "Phone does not match" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update password via Auth Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      activation.driver_profile_id,
      { password: new_password }
    );

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark activation code as used
    await supabaseAdmin
      .from("driver_activation_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", activation.id);

    return new Response(JSON.stringify({ ok: true }), {
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
