/**
 * Edge Function: send-notification
 *
 * Envía notificaciones WhatsApp o SMS a destinatarios de entregas
 * usando Twilio. Se activa cuando el conductor marca una parada como
 * "en camino" (arrived) o "entregado/fallido" (done/failed).
 *
 * Variables de entorno requeridas en Supabase Dashboard > Edge Functions > Secrets:
 *   TWILIO_ACCOUNT_SID   — Account SID de tu cuenta Twilio
 *   TWILIO_AUTH_TOKEN    — Auth Token de Twilio
 *   TWILIO_FROM_WHATSAPP — Número WhatsApp aprobado, ej: "whatsapp:+14155238886"
 *   TWILIO_FROM_SMS      — Número SMS Twilio, ej: "+14155238886"
 *   PUBLIC_APP_URL       — URL pública del app, ej: "https://app.rutaviva.com"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotificationEvent = 'driver_en_camino' | 'entrega_completada' | 'entrega_fallida';
type Channel = 'whatsapp' | 'sms';

interface NotificationPayload {
  event: NotificationEvent;
  recipientPhone: string;         // E.164, ej: "+51987654321"
  recipientName?: string;
  driverName?: string;
  stopAddress?: string;
  trackingToken?: string;
  failureReason?: string;
  channel?: Channel;
}

function buildMessage(payload: NotificationPayload, appUrl: string): string {
  const name = payload.recipientName ? `Hola ${payload.recipientName}, ` : '';
  const trackingUrl = payload.trackingToken
    ? `${appUrl}/track/${payload.trackingToken}`
    : null;

  switch (payload.event) {
    case 'driver_en_camino':
      return (
        `${name}tu pedido está en camino 🚚\n` +
        `Conductor: ${payload.driverName ?? 'RutaViva'}\n` +
        `Dirección: ${payload.stopAddress ?? ''}\n` +
        (trackingUrl ? `Seguimiento en tiempo real: ${trackingUrl}` : '')
      ).trim();

    case 'entrega_completada':
      return (
        `${name}tu pedido fue entregado exitosamente ✅\n` +
        `Dirección: ${payload.stopAddress ?? ''}\n` +
        `Gracias por confiar en nosotros.`
      ).trim();

    case 'entrega_fallida':
      return (
        `${name}no pudimos entregar tu pedido ❌\n` +
        `Motivo: ${payload.failureReason ?? 'Destinatario no disponible'}\n` +
        `Dirección: ${payload.stopAddress ?? ''}\n` +
        `Por favor contáctanos para reprogramar.`
      ).trim();
  }
}

async function sendViaTwilio(
  to: string,
  body: string,
  channel: Channel,
  accountSid: string,
  authToken: string,
  fromWhatsApp: string,
  fromSms: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const from = channel === 'whatsapp' ? fromWhatsApp : fromSms;
  const toFormatted = channel === 'whatsapp' ? `whatsapp:${to}` : to;

  const credentials = btoa(`${accountSid}:${authToken}`);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: toFormatted, Body: body }).toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.message ?? `Twilio error ${response.status}` };
  }

  return { success: true, sid: data.sid };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar que viene de código autenticado (service role o JWT válido)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: NotificationPayload = await req.json();
    const { event, recipientPhone, channel = 'whatsapp' } = payload;

    if (!event || !recipientPhone) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos: event, recipientPhone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato E.164
    if (!/^\+\d{7,15}$/.test(recipientPhone)) {
      return new Response(
        JSON.stringify({ error: `Número inválido: ${recipientPhone}. Usar formato E.164 ej: +51987654321` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromWhatsApp = Deno.env.get('TWILIO_FROM_WHATSAPP') ?? '';
    const fromSms = Deno.env.get('TWILIO_FROM_SMS') ?? '';
    const appUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://app.rutaviva.com';

    if (!accountSid || !authToken) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Servicio de notificaciones no configurado' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = buildMessage(payload, appUrl);
    const result = await sendViaTwilio(
      recipientPhone,
      message,
      channel,
      accountSid,
      authToken,
      fromWhatsApp,
      fromSms
    );

    // Registrar en Supabase para auditoría
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('notification_logs').insert({
      event,
      recipient_phone: recipientPhone,
      channel,
      success: result.success,
      twilio_sid: result.sid ?? null,
      error_message: result.error ?? null,
      message_body: message,
    }).throwOnError().then(() => {}).catch(() => {
      // notification_logs puede no existir aún, no es crítico
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, sid: result.sid }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-notification error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
