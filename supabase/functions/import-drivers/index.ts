import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonRes(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Inline validation (no external deps) ──────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

interface DriverImportRow {
  email: string;
  full_name: string;
  phone: string;
  license?: string;
}

function validateDriver(row: unknown): { data: DriverImportRow; error?: never } | { data?: never; error: string } {
  if (!row || typeof row !== "object") return { error: "Row is not an object" };
  const r = row as Record<string, unknown>;

  const email = typeof r.email === "string" ? r.email.trim() : "";
  if (!email || !EMAIL_RE.test(email) || email.length > 255)
    return { error: `Invalid email: "${email}"` };

  const full_name = typeof r.full_name === "string" ? r.full_name.trim() : "";
  if (!full_name || full_name.length < 2 || full_name.length > 100)
    return { error: `Invalid full_name (2–100 chars): "${full_name}"` };

  const phone = typeof r.phone === "string" ? r.phone.trim() : "";
  if (phone && (!PHONE_RE.test(phone) || phone.length > 20))
    return { error: `Invalid phone format: "${phone}"` };

  const license = typeof r.license === "string" ? r.license.trim().slice(0, 50) : undefined;

  return { data: { email, full_name, phone, license } };
}
// ─────────────────────────────────────────────────────────────────────────────

interface ImportResult {
  success: number;
  errors: string[];
}

function phoneToEmail(phone: string): string {
  return phone.replace(/[^0-9]/g, "") + "@driver.rutaviva.local";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "No authorization header" }, 401);
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    // Get caller's company_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      return jsonRes({ error: "No company found" }, 400);
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
      return jsonRes({ error: "Only admins can import drivers" }, 403);
    }

    const body = await req.json();
    const { drivers } = body as { drivers: unknown[] };

    if (!Array.isArray(drivers) || drivers.length === 0) {
      return jsonRes({ error: "No drivers provided" }, 400);
    }

    // Enforce batch size limit
    if (drivers.length > 100) {
      return jsonRes({ error: "Maximum 100 drivers per import batch" }, 400);
    }

    const result: ImportResult = { success: 0, errors: [] };

    for (const raw of drivers) {
      const validated = validateDriver(raw);
      if (validated.error) {
        result.errors.push(validated.error);
        continue;
      }
      const driver = validated.data;

      try {
        // Create user in auth (using email as-is for imported drivers)
        const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: driver.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: driver.full_name },
        });

        if (authError) {
          result.errors.push(`${driver.email}: ${authError.message}`);
          continue;
        }

        if (!authUser.user) {
          result.errors.push(`${driver.email}: No se creó el usuario`);
          continue;
        }

        // Upsert profile
        await supabaseAdmin
          .from("profiles")
          .upsert({
            id: authUser.user.id,
            full_name: driver.full_name,
            phone: driver.phone || null,
            company_id: profile.company_id,
          }, { onConflict: "id" });

        // Assign driver role
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert({
            user_id: authUser.user.id,
            company_id: profile.company_id,
            role: "driver",
            status: "active",
          }, { onConflict: "user_id,role" });

        if (roleErr) {
          const msg = roleErr.message?.toLowerCase() ?? "";
          if (msg.includes("quota") || msg.includes("max_drivers") || msg.includes("membership")) {
            result.errors.push(`${driver.email}: Límite de conductores alcanzado`);
            continue;
          }
          result.errors.push(`${driver.email}: ${roleErr.message}`);
          continue;
        }

        result.success++;
      } catch (err) {
        result.errors.push(`${driver.email}: ${err instanceof Error ? err.message : "Error desconocido"}`);
      }
    }

    return jsonRes(result as unknown as Record<string, unknown>, 200);
  } catch (error) {
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
