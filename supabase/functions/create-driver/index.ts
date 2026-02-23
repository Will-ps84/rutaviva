import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9+]/g, "");
  if (!digits.startsWith("+")) digits = "+" + digits.replace(/^\+/, "");
  return digits;
}

function phoneToEmail(phone: string): string {
  return phone.replace(/[^0-9]/g, "") + "@driver.rutaviva.local";
}

function jsonRes(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // --- Auth: verify caller ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "No authorization header" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !caller) return jsonRes({ error: "Unauthorized" }, 401);

    // --- Resolve company_id ---
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", caller.id)
      .single();

    const company_id = callerProfile?.company_id;
    if (!company_id) return jsonRes({ error: "No company found for caller" }, 400);

    // --- Verify caller is admin/owner ---
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("company_id", company_id)
      .in("role", ["admin", "owner"])
      .eq("status", "active")
      .maybeSingle();

    if (!roleData) return jsonRes({ error: "Only admins can create drivers" }, 403);

    // --- Validate input ---
    const { full_name, phone } = await req.json();

    if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
      return jsonRes({ error: "Phone is required (min 5 chars)" }, 400);
    }
    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return jsonRes({ error: "Full name is required" }, 400);
    }

    const e164Phone = normalizePhone(phone.trim());
    const cleanName = full_name.trim();
    const fakeEmail = phoneToEmail(e164Phone);

    // --- Check if driver already exists in THIS company ---
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", e164Phone)
      .eq("company_id", company_id)
      .maybeSingle();

    let driverUserId: string;
    let isNewDriver = false;

    if (existingProfile) {
      driverUserId = existingProfile.id;
    } else {
      // Check if phone exists in ANOTHER company
      const { data: anyProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, company_id")
        .eq("phone", e164Phone)
        .maybeSingle();

      if (anyProfile && anyProfile.company_id !== company_id) {
        return jsonRes({ error: "Phone number already registered by another company" }, 400);
      }

      // Create or find auth user
      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        password: tempPassword,
        email_confirm: true,
        phone: e164Phone,
        phone_confirm: true,
        user_metadata: { full_name: cleanName },
      });

      if (authError) {
        if (authError.message?.toLowerCase().includes("already") || authError.message?.toLowerCase().includes("duplicate")) {
          // Find existing auth user by email
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const found = listData?.users?.find(u => u.email === fakeEmail);
          if (found) {
            driverUserId = found.id;
          } else {
            return jsonRes({ error: "Phone already registered by another user" }, 400);
          }
        } else {
          return jsonRes({ error: authError.message ?? "Error creating auth user" }, 400);
        }
      } else {
        driverUserId = authUser.user.id;
      }

      isNewDriver = true;

      // Upsert profile (ensure id=auth.users.id, company_id set, phone E.164)
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: driverUserId,
          full_name: cleanName,
          phone: e164Phone,
          company_id,
        }, { onConflict: "id" });

      if (profileErr) {
        return jsonRes({ error: "Error saving driver profile: " + profileErr.message }, 500);
      }

      // Insert driver role — catch quota trigger
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: driverUserId,
          company_id,
          role: "driver",
          status: "active",
        }, { onConflict: "user_id,role" });

      if (roleErr) {
        const msg = roleErr.message?.toLowerCase() ?? "";
        if (msg.includes("quota") || msg.includes("limit") || msg.includes("max_drivers") || msg.includes("membership")) {
          return jsonRes({ error: "Se alcanzó el límite de conductores permitido por el plan de la empresa." }, 400);
        }
        return jsonRes({ error: "Error assigning driver role: " + roleErr.message }, 500);
      }
    }

    // --- Post-condition: verify active driver role exists ---
    const { data: verifyRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", driverUserId)
      .eq("company_id", company_id)
      .eq("role", "driver")
      .eq("status", "active")
      .maybeSingle();

    if (!verifyRole) {
      return jsonRes({ error: "Failed to verify driver role. Please try again." }, 500);
    }

    // --- Generate activation code ---
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { error: codeErr } = await supabaseAdmin
      .from("driver_activation_codes")
      .insert({ driver_profile_id: driverUserId, company_id, code, expires_at: expiresAt });

    if (codeErr) {
      return jsonRes({ error: "Error generating activation code: " + codeErr.message }, 500);
    }

    return jsonRes({ driver_user_id: driverUserId, code, expires_at: expiresAt }, 200);
  } catch (error) {
    return jsonRes({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
