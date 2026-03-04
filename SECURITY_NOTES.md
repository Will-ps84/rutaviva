# RutaViva — Security Notes

> Last updated: 2026-03-04  
> Scope: Production (Lovable Cloud / Supabase backend)

---

## 1. Row-Level Security (RLS) — Multi-company Isolation

Every table in the `public` schema that is exposed through the PostgREST API has RLS enabled. Data isolation between companies is enforced by comparing `company_id` columns against the result of the `get_user_company_id()` helper function, which uses `SECURITY DEFINER` and `SET search_path = public` to prevent search-path injection.

### Core helper functions

| Function | Purpose |
|---|---|
| `get_user_company_id()` | Returns the `company_id` of the currently authenticated user (via `auth.uid()`). Used in all SELECT / INSERT / UPDATE / DELETE policies. |
| `has_role(user_id, role)` | Checks if a user has a specific app role in their active `user_roles` entry. |
| `is_super_admin()` | Returns `true` if the caller has the `super_admin` role; used as a global bypass for platform-level operations. |
| `user_can_access_route(route_id)` | Returns `true` if the caller belongs to the route's company, or is the assigned driver. |

### Policy pattern (example)

```sql
-- Only see records belonging to the caller's company:
CREATE POLICY "users_view_company_routes" ON public.routes FOR SELECT
USING (
  is_super_admin()
  OR company_id = get_user_company_id()
  OR (driver_id = auth.uid() AND has_role(auth.uid(), 'driver'))
);
```

### Company isolation queries — what a user from Company A _cannot_ see

```sql
-- This query will return 0 rows for a Company A user trying to read Company B data:
SELECT * FROM profiles WHERE company_id = '<COMPANY_B_UUID>';
-- RLS filter: company_id = get_user_company_id() → resolved to COMPANY_A → no match

SELECT * FROM driver_activation_codes WHERE company_id = '<COMPANY_B_UUID>';
-- Same: filtered by company_id = get_user_company_id()

SELECT * FROM audit_logs WHERE company_id = '<COMPANY_B_UUID>';
-- Same: filtered by company_id = get_user_company_id()
```

### `company_id` immutability — profiles table

A `BEFORE UPDATE` trigger `prevent_profiles_company_change` is attached to `public.profiles` (added in migration `20260304_security_hardening`). It uses the shared `prevent_company_id_change()` function which raises an exception if anyone (other than a super admin) attempts to change `company_id` on an existing row. This closes the multi-tenant bypass described in `profiles_company_bypass`.

---

## 2. Driver Import — Secure Batch Flow (`import-drivers` edge function)

### Authentication & authorization

1. Every request must include a valid `Authorization: Bearer <JWT>` header.
2. The function resolves `company_id` from the caller's profile (never trusted from the request body).
3. Caller must have `role = 'admin' | 'owner'` AND `status = 'active'` in `user_roles` for that `company_id`.

### Input validation

Validation is handled by two pure functions (`validateDriverRow`, `validateBatchBody`) that are easily unit-tested without Deno or Supabase:

| Field | Rule |
|---|---|
| `email` | Required, valid RFC-5322 email, max 255 chars, lowercased |
| `full_name` | Required, 2–100 chars |
| `phone` | Optional; if provided, must match `^\+?[0-9]{7,15}$`, max 20 chars |
| `license` | Optional, truncated to 50 chars |
| `drivers[]` | Must be a non-empty array, max 100 entries per batch |

### Phone normalization

Phones are stored in `profiles.phone` in E.164 format (`+<digits>`). The internal auth email is derived from digits only: `<digits>@driver.rutaviva.local`.

### Quota enforcement

If the company's `max_drivers` plan limit is reached, the `enforce_membership_quotas` trigger raises an exception during `user_roles` INSERT. The edge function catches this, returns HTTP 400 with a clear message, and does **not** generate an activation code.

### Post-condition verification

Before returning success for each driver, the function verifies that a `user_roles` row with `role='driver'` and `status='active'` for that `company_id` actually exists in the database.

---

## 3. Geographic / PostGIS Tables

The following tables are owned by the **PostGIS extension** and contain only coordinate system metadata (EPSG/WGS84 definitions), not user data:

| Table | Schema | RLS | Reason for exposure |
|---|---|---|---|
| `spatial_ref_sys` | `public` | Not enabled (PostGIS-owned) | Read-only reference table of coordinate system definitions. Contains no user data. PostGIS requires it in `public`. Cannot be modified by any user role. |
| `geography_columns` | `public` | N/A (view) | System view listing geography columns in the database. No user data. |
| `geometry_columns` | `public` | N/A (view) | System view listing geometry columns. No user data. |

**These tables are safe to expose** because:
- They contain only standardized projection definitions (SRID numbers, WKT strings).
- No PII, location data, or business data is stored here.
- They are immutable (owned by the PostGIS extension; no INSERT/UPDATE/DELETE possible by application roles).
- Supabase's linter flags `spatial_ref_sys` for missing RLS, but this is a known false positive for PostGIS installations — this finding is marked as `ignore: true` in the security panel.

---

## 4. API Keys & Secrets

| Key | Where stored | Reason |
|---|---|---|
| Mapbox public token (`pk.*`) | `VITE_MAPBOX_TOKEN` env var | Publishable client key — designed for browser use. No hardcoded fallbacks in source code. Rotate in Mapbox dashboard if exposed. Add URL restrictions in Mapbox settings. |
| Supabase anon key | `VITE_SUPABASE_PUBLISHABLE_KEY` env var | Designed for client use; RLS is the security boundary. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets only | Never exposed to the client. Used only inside `import-drivers`, `create-driver`, `activate-driver`, `driver-login`. |

---

## 5. Known Accepted Risks

| Finding | Accepted? | Reason |
|---|---|---|
| `spatial_ref_sys` without RLS | ✅ Yes | PostGIS system table — no user data |
| `extension_in_public` (PostGIS) | ✅ Yes | Required by PostGIS; no security impact |
| `Leaked password protection disabled` | ⚠️ Pending | Requires Supabase dashboard toggle under Authentication → Security. Enable at: Auth → Settings → Password strength → "Leaked password protection". |
| `has_role()` allows checking any user's role | ✅ Yes | Reconnaissance risk is low; only returns boolean. No sensitive data exposed. Used in RLS policies internally. |
