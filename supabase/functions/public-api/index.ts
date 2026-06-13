/**
 * Edge Function: public-api
 *
 * API REST pública de RutaViva para integración con sistemas externos
 * (ERP, WMS, Shopify, etc.).
 *
 * Autenticación: header X-Api-Key con una clave generada por la empresa.
 * Las API keys se almacenan en la tabla `company_api_keys` con hash SHA-256.
 *
 * Endpoints:
 *   POST   /public-api/routes              — Crear ruta con paradas desde sistema externo
 *   GET    /public-api/routes/:id          — Obtener estado de una ruta
 *   GET    /public-api/routes/:id/stops    — Obtener paradas de una ruta con estado
 *   POST   /public-api/routes/:id/stops    — Agregar paradas a ruta existente (draft)
 *
 * Ejemplo de uso:
 *   curl -X POST https://<project>.supabase.co/functions/v1/public-api/routes \
 *     -H "X-Api-Key: rv_live_abc123..." \
 *     -H "Content-Type: application/json" \
 *     -d '{"name":"Ruta Shopify #1042","date":"2026-06-15","stops":[...]}'
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function authenticateApiKey(
  supabase: ReturnType<typeof createClient>,
  rawKey: string
): Promise<{ companyId: string; keyId: string } | null> {
  if (!rawKey || !rawKey.startsWith('rv_')) return null;

  const hash = await hashApiKey(rawKey);

  const { data, error: dbError } = await supabase
    .from('company_api_keys')
    .select('id, company_id, is_active, last_used_at')
    .eq('key_hash', hash)
    .eq('is_active', true)
    .single();

  if (dbError || !data) return null;

  // Actualizar last_used_at en background (no bloqueante)
  supabase
    .from('company_api_keys')
    .update({ last_used_at: new Date().toISOString(), request_count: data.request_count + 1 })
    .eq('id', data.id)
    .then(() => {});

  return { companyId: data.company_id, keyId: data.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // ── Autenticación ──
  const apiKey = req.headers.get('x-api-key') ?? req.headers.get('X-Api-Key');
  if (!apiKey) return error('Header X-Api-Key requerido', 401);

  const auth = await authenticateApiKey(supabase, apiKey);
  if (!auth) return error('API key inválida o inactiva', 401);

  const { companyId } = auth;

  // ── Router simple por URL ──
  const url = new URL(req.url);
  // Strip function prefix: /public-api/routes → /routes
  const path = url.pathname.replace(/^\/functions\/v1\/public-api/, '').replace(/^\/public-api/, '');
  const segments = path.split('/').filter(Boolean);

  // POST /routes — Crear ruta
  if (req.method === 'POST' && segments.length === 1 && segments[0] === 'routes') {
    let body: any;
    try { body = await req.json(); } catch { return error('JSON inválido'); }

    const { name, date, driver_id, stops = [] } = body;

    if (!name || !date) return error('Campos requeridos: name, date');
    if (!Array.isArray(stops)) return error('stops debe ser un array');

    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return error('date debe tener formato YYYY-MM-DD');
    }

    // Crear ruta
    const { data: route, error: routeErr } = await supabase
      .from('routes')
      .insert({ company_id: companyId, name, date, status: 'draft', driver_id: driver_id ?? null })
      .select('id, name, date, status')
      .single();

    if (routeErr) return error(`Error creando ruta: ${routeErr.message}`, 500);

    // Crear paradas si se proveyeron
    let createdStops: any[] = [];
    if (stops.length > 0) {
      const stopRows = stops.map((s: any, i: number) => ({
        route_id: route.id,
        seq: i + 1,
        address_text: s.address ?? s.address_text ?? '',
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        recipient_name: s.recipient_name ?? s.name ?? null,
        recipient_phone: s.recipient_phone ?? s.phone ?? null,
        notes: s.notes ?? null,
        zone: s.zone ?? null,
        weight_kg: s.weight_kg ?? null,
        status: 'pending',
      }));

      const { data: insertedStops, error: stopsErr } = await supabase
        .from('route_stops')
        .insert(stopRows)
        .select('id, seq, address_text, status, recipient_name, recipient_phone');

      if (stopsErr) {
        // Rollback: eliminar la ruta
        await supabase.from('routes').delete().eq('id', route.id);
        return error(`Error creando paradas: ${stopsErr.message}`, 500);
      }
      createdStops = insertedStops ?? [];
    }

    return json({ route: { ...route, stops: createdStops } }, 201);
  }

  // GET /routes/:id — Estado de una ruta
  if (req.method === 'GET' && segments.length === 2 && segments[0] === 'routes') {
    const routeId = segments[1];

    const { data: route, error: routeErr } = await supabase
      .from('routes')
      .select('id, name, date, status, started_at, completed_at, driver_id, vehicle_id')
      .eq('id', routeId)
      .eq('company_id', companyId)
      .single();

    if (routeErr || !route) return error('Ruta no encontrada', 404);

    return json({ route });
  }

  // GET /routes/:id/stops — Paradas con estado
  if (req.method === 'GET' && segments.length === 3 && segments[0] === 'routes' && segments[2] === 'stops') {
    const routeId = segments[1];

    // Verificar que la ruta pertenece a la empresa
    const { data: route } = await supabase
      .from('routes')
      .select('id')
      .eq('id', routeId)
      .eq('company_id', companyId)
      .single();

    if (!route) return error('Ruta no encontrada', 404);

    const { data: stops, error: stopsErr } = await supabase
      .from('route_stops')
      .select('id, seq, address_text, recipient_name, recipient_phone, status, completed_at, failure_reason, tracking_token')
      .eq('route_id', routeId)
      .order('seq');

    if (stopsErr) return error('Error obteniendo paradas', 500);

    return json({ route_id: routeId, stops: stops ?? [] });
  }

  // POST /routes/:id/stops — Agregar paradas a ruta draft
  if (req.method === 'POST' && segments.length === 3 && segments[0] === 'routes' && segments[2] === 'stops') {
    const routeId = segments[1];

    const { data: route } = await supabase
      .from('routes')
      .select('id, status')
      .eq('id', routeId)
      .eq('company_id', companyId)
      .single();

    if (!route) return error('Ruta no encontrada', 404);
    if (route.status !== 'draft') return error('Solo se pueden agregar paradas a rutas en estado draft', 409);

    let body: any;
    try { body = await req.json(); } catch { return error('JSON inválido'); }

    const stops: any[] = Array.isArray(body) ? body : body.stops ?? [];
    if (stops.length === 0) return error('Se requiere al menos una parada');

    // Obtener el seq máximo actual
    const { data: existing } = await supabase
      .from('route_stops')
      .select('seq')
      .eq('route_id', routeId)
      .order('seq', { ascending: false })
      .limit(1);

    const startSeq = (existing?.[0]?.seq ?? 0) + 1;

    const stopRows = stops.map((s: any, i: number) => ({
      route_id: routeId,
      seq: startSeq + i,
      address_text: s.address ?? s.address_text ?? '',
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      recipient_name: s.recipient_name ?? s.name ?? null,
      recipient_phone: s.recipient_phone ?? s.phone ?? null,
      notes: s.notes ?? null,
      zone: s.zone ?? null,
      weight_kg: s.weight_kg ?? null,
      status: 'pending',
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('route_stops')
      .insert(stopRows)
      .select('id, seq, address_text, status, recipient_name, recipient_phone');

    if (insertErr) return error(`Error: ${insertErr.message}`, 500);

    return json({ added: inserted?.length ?? 0, stops: inserted ?? [] }, 201);
  }

  return error('Endpoint no encontrado', 404);
});
