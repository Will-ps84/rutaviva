/**
 * import-drivers — input validation unit tests
 *
 * Mirrors the validateDriverRow / validateBatchBody logic from the edge function
 * without requiring Deno or a live Supabase connection.
 */

import { describe, it, expect } from 'vitest';

// ── Inline the validation logic (mirrors edge function) ──────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const MAX_BATCH = 100;

interface DriverImportRow {
  email: string;
  full_name: string;
  phone: string;
  license?: string;
}

interface OkResult<T>  { ok: true;  data: T }
interface ErrResult    { ok: false; error: string }
type ValidationResult<T> = OkResult<T> | ErrResult;

function validateDriverRow(raw: unknown): ValidationResult<DriverImportRow> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Row is not an object' };
  const r = raw as Record<string, unknown>;

  const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : '';
  if (!email) return { ok: false, error: 'email is required' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: `Invalid email: "${email}"` };
  if (email.length > 255) return { ok: false, error: `Email too long: "${email}"` };

  const full_name = typeof r.full_name === 'string' ? r.full_name.trim() : '';
  if (!full_name) return { ok: false, error: 'full_name is required' };
  if (full_name.length < 2) return { ok: false, error: `full_name too short: "${full_name}"` };
  if (full_name.length > 100) return { ok: false, error: `full_name too long (max 100 chars): "${full_name}"` };

  const phone = typeof r.phone === 'string' ? r.phone.trim() : '';
  if (phone && !PHONE_RE.test(phone)) return { ok: false, error: `Invalid phone format: "${phone}"` };
  if (phone && phone.length > 20) return { ok: false, error: `Phone too long: "${phone}"` };

  const license = typeof r.license === 'string' ? r.license.trim().slice(0, 50) : undefined;

  return { ok: true, data: { email, full_name, phone, license } };
}

function validateBatchBody(body: unknown): ValidationResult<{ drivers: unknown[] }> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object' };
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.drivers)) return { ok: false, error: '"drivers" field must be an array' };
  if (b.drivers.length === 0) return { ok: false, error: '"drivers" array must not be empty' };
  if (b.drivers.length > MAX_BATCH) return { ok: false, error: `Maximum ${MAX_BATCH} drivers per batch` };
  return { ok: true, data: { drivers: b.drivers } };
}

function normalizePhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/[^0-9]/g, '');
  return `+${digits}`;
}

function phoneToEmail(phone: string): string {
  return phone.replace(/[^0-9]/g, '') + '@driver.rutaviva.local';
}

/** Extract error from a failed result; throws if result was ok */
function getError<T>(r: ValidationResult<T>): string {
  if (r.ok) throw new Error('Expected failure but validation succeeded');
  return (r as ErrResult).error;
}

/** Extract data from a successful result; throws if result failed */
function getData<T>(r: ValidationResult<T>): T {
  if (!r.ok) throw new Error(`Expected success but got error: ${(r as ErrResult).error}`);
  return (r as OkResult<T>).data;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validateDriverRow', () => {
  it('accepts a valid row', () => {
    const result = validateDriverRow({ email: 'juan@empresa.com', full_name: 'Juan Pérez', phone: '+51999999999', license: 'A-12345' });
    expect(result.ok).toBe(true);
  });

  it('normalises email to lowercase', () => {
    const result = validateDriverRow({ email: 'JUAN@Empresa.COM', full_name: 'Juan', phone: '' });
    expect(getData(result).email).toBe('juan@empresa.com');
  });

  it('rejects missing email', () => {
    const result = validateDriverRow({ email: '', full_name: 'Juan', phone: '' });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/email is required/);
  });

  it('rejects invalid email format', () => {
    const result = validateDriverRow({ email: 'not-an-email', full_name: 'Juan', phone: '' });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/Invalid email/);
  });

  it('rejects email longer than 255 chars', () => {
    const result = validateDriverRow({ email: 'a'.repeat(250) + '@x.com', full_name: 'Juan', phone: '' });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/too long/);
  });

  it('rejects missing full_name', () => {
    const result = validateDriverRow({ email: 'j@x.com', full_name: '', phone: '' });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/full_name is required/);
  });

  it('rejects full_name shorter than 2 chars', () => {
    const result = validateDriverRow({ email: 'j@x.com', full_name: 'A', phone: '' });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/too short/);
  });

  it('rejects full_name longer than 100 chars', () => {
    const result = validateDriverRow({ email: 'j@x.com', full_name: 'A'.repeat(101), phone: '' });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/too long/);
  });

  it('accepts phone in E.164 format', () => {
    const result = validateDriverRow({ email: 'j@x.com', full_name: 'Juan P', phone: '+51999888777' });
    expect(result.ok).toBe(true);
  });

  it('rejects phone with non-digit characters', () => {
    const result = validateDriverRow({ email: 'j@x.com', full_name: 'Juan P', phone: '999-888-777-abc' });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/Invalid phone/);
  });

  it('accepts row without phone (optional)', () => {
    const result = validateDriverRow({ email: 'j@x.com', full_name: 'Juan P', phone: '' });
    expect(result.ok).toBe(true);
    expect(getData(result).phone).toBe('');
  });

  it('truncates license to 50 chars', () => {
    const result = validateDriverRow({ email: 'j@x.com', full_name: 'Juan P', phone: '', license: 'L'.repeat(60) });
    expect(result.ok).toBe(true);
    expect(getData(result).license?.length).toBe(50);
  });

  it('rejects non-object rows', () => {
    expect(validateDriverRow(null).ok).toBe(false);
    expect(validateDriverRow('string').ok).toBe(false);
    expect(validateDriverRow(42).ok).toBe(false);
  });
});

describe('validateBatchBody', () => {
  it('accepts a valid batch', () => {
    const result = validateBatchBody({ drivers: [{ email: 'a@b.com', full_name: 'Test', phone: '' }] });
    expect(result.ok).toBe(true);
  });

  it('rejects non-array drivers field', () => {
    const result = validateBatchBody({ drivers: 'not-array' });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/must be an array/);
  });

  it('rejects empty drivers array', () => {
    const result = validateBatchBody({ drivers: [] });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/must not be empty/);
  });

  it(`rejects batches larger than ${MAX_BATCH}`, () => {
    const drivers = Array.from({ length: MAX_BATCH + 1 }, (_, i) => ({ email: `d${i}@x.com`, full_name: 'D', phone: '' }));
    const result = validateBatchBody({ drivers });
    expect(result.ok).toBe(false);
    expect(getError(result)).toMatch(/Maximum/);
  });

  it('rejects non-object body', () => {
    expect(validateBatchBody(null).ok).toBe(false);
    expect(validateBatchBody('string').ok).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('adds + prefix to bare digits', () => {
    expect(normalizePhone('51999888777')).toBe('+51999888777');
  });

  it('preserves existing + prefix', () => {
    expect(normalizePhone('+51999888777')).toBe('+51999888777');
  });

  it('strips non-digit characters', () => {
    expect(normalizePhone('+51 999-888 777')).toBe('+51999888777');
  });

  it('returns empty string unchanged', () => {
    expect(normalizePhone('')).toBe('');
  });
});

describe('phoneToEmail', () => {
  it('produces a consistent derived email', () => {
    expect(phoneToEmail('+51999888777')).toBe('51999888777@driver.rutaviva.local');
  });

  it('strips + and spaces from phone before deriving email', () => {
    expect(phoneToEmail('+51 999 888 777')).toBe('51999888777@driver.rutaviva.local');
  });
});
