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

    // Verify caller is authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's company_id
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin/owner
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("company_id", callerProfile.company_id)
      .in("role", ["admin", "owner"])
      .eq("status", "active")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only admins can create drivers" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { full_name, phone } = await req.json();

    if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Full name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.trim();
    const cleanName = full_name.trim();
    const company_id = callerProfile.company_id;

    // Check if user with this phone already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.phone === cleanPhone);

    let driverUserId: string;

    if (existingUser) {
      // Check if already a driver in this company
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("company_id", company_id)
        .eq("role", "driver")
        .maybeSingle();

      if (existingRole) {
        return new Response(JSON.stringify({ error: "Driver already exists in this company" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      driverUserId = existingUser.id;
    } else {
      // Create new auth user with phone (no SMS, phone_confirm = true)
      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        phone: cleanPhone,
        password: tempPassword,
        phone_confirm: true,
        user_metadata: { full_name: cleanName },
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      driverUserId = authUser.user.id;
    }

    // Upsert profile
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id: driverUserId,
        full_name: cleanName,
        phone: cleanPhone,
        company_id,
      }, { onConflict: "id" });

    // Insert driver role
    await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: driverUserId,
        company_id,
        role: "driver",
        status: "active",
      }, { onConflict: "user_id,role" });

    // Generate activation code (6 chars, uppercase alphanumeric)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("driver_activation_codes")
      .insert({
        driver_profile_id: driverUserId,
        company_id,
        code,
        expires_at: expiresAt,
      });

    return new Response(JSON.stringify({
      driver_user_id: driverUserId,
      code,
      expires_at: expiresAt,
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
