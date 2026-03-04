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

// ── Validation schema (Zod-style, zero external deps) ────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const MAX_BATCH = 100;

interface DriverImportRow {
  email: string;
  full_name: string;
  phone: string;
  license?: string;
}

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function validateDriverRow(raw: unknown): ValidationResult<DriverImportRow> {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Row is not an object" };
  }
  const r = raw as Record<string, unknown>;

  // email
  const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, error: "email is required" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: `Invalid email: "${email}"` };
  if (email.length > 255) return { ok: false, error: `Email too long: "${email}"` };

  // full_name
  const full_name = typeof r.full_name === "string" ? r.full_name.trim() : "";
  if (!full_name) return { ok: false, error: "full_name is required" };
  if (full_name.length < 2) return { ok: false, error: `full_name too short: "${full_name}"` };
  if (full_name.length > 100) return { ok: false, error: `full_name too long (max 100 chars): "${full_name}"` };

  // phone (optional but validated if present)
  const phone = typeof r.phone === "string" ? r.phone.trim() : "";
  if (phone && !PHONE_RE.test(phone)) {
    return { ok: false, error: `Invalid phone format: "${phone}"` };
  }
  if (phone && phone.length > 20) {
    return { ok: false, error: `Phone too long: "${phone}"` };
  }

  // license (optional, truncate to 50)
  const license =
    typeof r.license === "string" ? r.license.trim().slice(0, 50) : undefined;

  return { ok: true, data: { email, full_name, phone, license } };
}

function validateBatchBody(body: unknown): ValidationResult<{ drivers: unknown[] }> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.drivers)) {
    return { ok: false, error: "\"drivers\" field must be an array" };
  }
  if (b.drivers.length === 0) {
    return { ok: false, error: "\"drivers\" array must not be empty" };
  }
  if (b.drivers.length > MAX_BATCH) {
    return { ok: false, error: `Maximum ${MAX_BATCH} drivers per batch` };
  }
  return { ok: true, data: { drivers: b.drivers } };
}

// ─────────────────────────────────────────────────────────────────────────────

/** Normalize phone to E.164 (+digits). If already has +, keep it. */
function normalizePhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/[^0-9]/g, "");
  return phone.startsWith("+") ? `+${digits}` : `+${digits}`;
}

/** Derive internal email from phone digits (no + or spaces). */
function phoneToEmail(phone: string): string {
  return phone.replace(/[^0-9]/g, "") + "@driver.rutaviva.local";
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

    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Missing authorization header" }, 401);

    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    // ── Resolve company ─────────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      return jsonRes({ error: "Caller has no associated company" }, 400);
    }
    const company_id: string = profile.company_id;

    // ── Verify admin role ───────────────────────────────────────────────────
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .in("role", ["admin", "owner"])
      .eq("status", "active")
      .maybeSingle();

    if (!roleData) {
      return jsonRes({ error: "Only admins or owners can import drivers" }, 403);
    }

    // ── Parse & validate body ───────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonRes({ error: "Invalid JSON body" }, 400);
    }

    const bodyValidation = validateBatchBody(rawBody);
    if (!bodyValidation.ok) {
      return jsonRes({ error: bodyValidation.error }, 400);
    }
    const { drivers } = bodyValidation.data;

    // ── Process each driver ─────────────────────────────────────────────────
    const result: ImportResult = { success: 0, errors: [] };

    for (const raw of drivers) {
      const validation = validateDriverRow(raw);
      if (!validation.ok) {
        result.errors.push(validation.error);
        continue;
      }
      const driver = validation.data;
      const normalizedPhone = driver.phone ? normalizePhone(driver.phone) : "";

      try {
        // Create auth user with derived email
        const derivedEmail = phoneToEmail(normalizedPhone || driver.email);
        const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

        const { data: authUser, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: derivedEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: driver.full_name },
          });

        if (authError) {
          result.errors.push(`${driver.email}: ${authError.message}`);
          continue;
        }
        if (!authUser.user) {
          result.errors.push(`${driver.email}: auth user not created`);
          continue;
        }

        const driverUserId = authUser.user.id;

        // Upsert profile — id must equal auth user id
        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: driverUserId,
              full_name: driver.full_name,
              phone: normalizedPhone || null,
              company_id,
            },
            { onConflict: "id" }
          );

        if (profileErr) {
          result.errors.push(`${driver.email}: profile error — ${profileErr.message}`);
          continue;
        }

        // Assign driver role
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert(
            {
              user_id: driverUserId,
              company_id,
              role: "driver",
              status: "active",
            },
            { onConflict: "user_id,role" }
          );

        if (roleErr) {
          const msg = roleErr.message?.toLowerCase() ?? "";
          if (
            msg.includes("quota") ||
            msg.includes("max_drivers") ||
            msg.includes("membership") ||
            msg.includes("limit")
          ) {
            result.errors.push(
              `${driver.email}: Driver limit reached for this company plan`
            );
          } else {
            result.errors.push(`${driver.email}: role error — ${roleErr.message}`);
          }
          continue;
        }

        // ── Post-condition verification ──────────────────────────────────
        const { data: verify } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", driverUserId)
          .eq("company_id", company_id)
          .eq("role", "driver")
          .eq("status", "active")
          .maybeSingle();

        if (!verify) {
          result.errors.push(
            `${driver.email}: post-condition failed — driver role not confirmed`
          );
          continue;
        }

        result.success++;
      } catch (err) {
        result.errors.push(
          `${driver.email}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return jsonRes(result as unknown as Record<string, unknown>, 200);
  } catch {
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
