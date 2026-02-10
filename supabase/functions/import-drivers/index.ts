import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DriverImportRow {
  email: string;
  full_name: string;
  phone: string;
  license?: string;
}

interface ImportResult {
  success: number;
  errors: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated and is admin
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's company_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", profile.company_id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only admins can import drivers" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { drivers } = await req.json() as { drivers: DriverImportRow[] };

    if (!drivers || !Array.isArray(drivers) || drivers.length === 0) {
      return new Response(JSON.stringify({ error: "No drivers provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: ImportResult = { success: 0, errors: [] };

    for (const driver of drivers) {
      try {
        if (!driver.email || !driver.email.includes("@")) {
          result.errors.push(`${driver.email || "vacío"}: Email inválido`);
          continue;
        }

        // Create user in auth
        const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: driver.email.trim(),
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: driver.full_name?.trim() || "" },
        });

        if (authError) {
          result.errors.push(`${driver.email}: ${authError.message}`);
          continue;
        }

        if (!authUser.user) {
          result.errors.push(`${driver.email}: No se creó el usuario`);
          continue;
        }

        // Update profile with company_id and phone
        await supabaseAdmin
          .from("profiles")
          .update({
            full_name: driver.full_name?.trim() || null,
            phone: driver.phone?.trim() || null,
            company_id: profile.company_id,
          })
          .eq("id", authUser.user.id);

        // Assign driver role
        await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: authUser.user.id,
            company_id: profile.company_id,
            role: "driver",
          });

        result.success++;
      } catch (err) {
        result.errors.push(`${driver.email}: ${err instanceof Error ? err.message : "Error desconocido"}`);
      }
    }

    return new Response(JSON.stringify(result), {
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
