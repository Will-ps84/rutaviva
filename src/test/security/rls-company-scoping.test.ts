/**
 * RLS Company Scoping — unit / integration light tests
 *
 * These tests validate the multi-tenant isolation logic used in RLS policies.
 * They test the JS/TS side of things (helper functions, query builders) without
 * requiring a live Supabase connection so they run in CI with no credentials.
 *
 * For full E2E coverage, use the Supabase local dev stack with `supabase test db`.
 */

import { describe, it, expect } from 'vitest';

// ── Helpers that mirror the SQL functions ────────────────────────────────────

/** Simulates get_user_company_id() for a given user context */
function getUserCompanyId(
  userId: string,
  userRoles: Array<{ user_id: string; company_id: string; status: string }>
): string | null {
  const role = userRoles.find(
    (r) => r.user_id === userId && r.status === 'active'
  );
  return role?.company_id ?? null;
}

/**
 * Simulates the RLS filter applied to any company-scoped table.
 * Returns only rows whose company_id matches the caller's company.
 */
function applyCompanyScopedRLS<T extends { company_id: string }>(
  rows: T[],
  callerCompanyId: string | null
): T[] {
  if (!callerCompanyId) return []; // unauthenticated / no company → no rows
  return rows.filter((r) => r.company_id === callerCompanyId);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const COMPANY_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const userRoles = [
  { user_id: 'user-alpha', company_id: COMPANY_A, status: 'active' },
  { user_id: 'user-beta',  company_id: COMPANY_B, status: 'active' },
];

const profiles = [
  { id: 'driver-a1', company_id: COMPANY_A, full_name: 'Driver A1' },
  { id: 'driver-a2', company_id: COMPANY_A, full_name: 'Driver A2' },
  { id: 'driver-b1', company_id: COMPANY_B, full_name: 'Driver B1' },
];

const routes = [
  { id: 'route-a1', company_id: COMPANY_A, name: 'Ruta A1' },
  { id: 'route-b1', company_id: COMPANY_B, name: 'Ruta B1' },
];

const activationCodes = [
  { id: 'code-a1', company_id: COMPANY_A, code: 'ABC123' },
  { id: 'code-b1', company_id: COMPANY_B, code: 'XYZ789' },
];

const auditLogs = [
  { id: 'log-a1', company_id: COMPANY_A, action: 'driver_created' },
  { id: 'log-b1', company_id: COMPANY_B, action: 'driver_created' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RLS: company scoping', () => {
  it('user from Company A can only see Company A profiles', () => {
    const companyId = getUserCompanyId('user-alpha', userRoles);
    const visible = applyCompanyScopedRLS(profiles, companyId);
    expect(visible.every((p) => p.company_id === COMPANY_A)).toBe(true);
    expect(visible.some((p) => p.company_id === COMPANY_B)).toBe(false);
    expect(visible).toHaveLength(2);
  });

  it('user from Company B cannot see Company A profiles', () => {
    const companyId = getUserCompanyId('user-beta', userRoles);
    const visible = applyCompanyScopedRLS(profiles, companyId);
    expect(visible.every((p) => p.company_id === COMPANY_B)).toBe(true);
    expect(visible).toHaveLength(1);
  });

  it('unauthenticated user sees zero profiles', () => {
    const visible = applyCompanyScopedRLS(profiles, null);
    expect(visible).toHaveLength(0);
  });

  it('user from Company A can only see Company A routes', () => {
    const companyId = getUserCompanyId('user-alpha', userRoles);
    const visible = applyCompanyScopedRLS(routes, companyId);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('route-a1');
  });

  it('user from Company B cannot see Company A routes', () => {
    const companyId = getUserCompanyId('user-beta', userRoles);
    const visible = applyCompanyScopedRLS(routes, companyId);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('route-b1');
  });

  it('driver_activation_codes are isolated per company', () => {
    const companyIdA = getUserCompanyId('user-alpha', userRoles);
    const visibleA = applyCompanyScopedRLS(activationCodes, companyIdA);
    expect(visibleA).toHaveLength(1);
    expect(visibleA[0].code).toBe('ABC123');

    const companyIdB = getUserCompanyId('user-beta', userRoles);
    const visibleB = applyCompanyScopedRLS(activationCodes, companyIdB);
    expect(visibleB).toHaveLength(1);
    expect(visibleB[0].code).toBe('XYZ789');
  });

  it('audit_logs are isolated per company', () => {
    const companyIdA = getUserCompanyId('user-alpha', userRoles);
    const visibleA = applyCompanyScopedRLS(auditLogs, companyIdA);
    expect(visibleA).toHaveLength(1);
    expect(visibleA[0].id).toBe('log-a1');
  });

  it('company_id cannot be changed by a user (trigger enforced)', () => {
    // Simulate prevent_company_id_change trigger logic
    function preventCompanyIdChange(
      oldRow: { company_id: string },
      newRow: { company_id: string },
      isSuper: boolean
    ): boolean {
      if (isSuper) return true; // super admin bypass
      return oldRow.company_id === newRow.company_id; // must not change
    }

    const existing = { company_id: COMPANY_A };
    expect(preventCompanyIdChange(existing, { company_id: COMPANY_A }, false)).toBe(true);
    expect(preventCompanyIdChange(existing, { company_id: COMPANY_B }, false)).toBe(false);
    expect(preventCompanyIdChange(existing, { company_id: COMPANY_B }, true)).toBe(true);
  });
});
