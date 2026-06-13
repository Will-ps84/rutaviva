/**
 * Servicio de optimización de rutas usando OSRM Trip API.
 *
 * OSRM resuelve el Travelling Salesman Problem para ordenar las paradas
 * de forma óptima minimizando la distancia total recorrida.
 *
 * Servidor público: router.project-osrm.org (sin costo, límite ~1000 req/min)
 * Para producción de alto volumen: levantar instancia propia con datos de OSM Perú.
 */

const OSRM_BASE_URL = 'https://router.project-osrm.org';

export interface StopCoordinate {
  index: number;        // índice original del stop
  lat: number;
  lng: number;
  address_text?: string;
}

export interface OptimizationResult {
  optimizedOrder: number[];   // índices originales en el nuevo orden
  totalDistanceKm: number;
  totalDurationMin: number;
  waypoints: Array<{ lat: number; lng: number; hint: string }>;
}

/**
 * Optimiza el orden de paradas usando OSRM Trip API.
 * Mantiene el primer punto como origen fijo si fixedStart=true.
 */
export async function optimizeStopOrder(
  stops: StopCoordinate[],
  options: { fixedStart?: boolean; fixedEnd?: boolean } = {}
): Promise<OptimizationResult> {
  if (stops.length < 2) {
    throw new Error('Se necesitan al menos 2 paradas para optimizar.');
  }
  if (stops.length > 100) {
    throw new Error('Máximo 100 paradas por optimización.');
  }

  const { fixedStart = true, fixedEnd = false } = options;

  // OSRM espera coordenadas como "lng,lat;lng,lat;..."
  const coords = stops.map(s => `${s.lng},${s.lat}`).join(';');

  const params = new URLSearchParams({
    roundtrip: 'false',
    ...(fixedStart && { source: 'first' }),
    ...(fixedEnd && { destination: 'last' }),
    steps: 'false',
    annotations: 'false',
    overview: 'false',
  });

  const url = `${OSRM_BASE_URL}/trip/v1/driving/${coords}?${params}`;

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    throw new Error('No se pudo conectar con el servicio de optimización. Verifica tu conexión a internet.');
  }

  if (!response.ok) {
    throw new Error(`Error del servidor de rutas: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 'Ok') {
    const messages: Record<string, string> = {
      NoTrips: 'No se pudo calcular una ruta entre las paradas dadas.',
      NotImplemented: 'Demasiadas paradas para optimizar.',
      InvalidValue: 'Coordenadas inválidas en alguna parada.',
    };
    throw new Error(messages[data.code] ?? `Error OSRM: ${data.code}`);
  }

  const trip = data.trips[0];
  const waypoints: Array<{ lat: number; lng: number; hint: string }> = data.waypoints.map(
    (wp: { location: [number, number]; hint: string }) => ({
      lng: wp.location[0],
      lat: wp.location[1],
      hint: wp.hint,
    })
  );

  // OSRM devuelve en data.waypoints[i].trips_index el orden optimizado
  // y waypoint_index indica qué parada original corresponde a cada posición
  const orderedWaypoints = [...data.waypoints].sort(
    (a: { waypoint_index: number }, b: { waypoint_index: number }) =>
      a.waypoint_index - b.waypoint_index
  );

  // Mapear de vuelta a índices originales
  const optimizedOrder = orderedWaypoints.map(
    (wp: { trips_index: number }) => stops[wp.trips_index]?.index ?? wp.trips_index
  );

  return {
    optimizedOrder,
    totalDistanceKm: trip.distance / 1000,
    totalDurationMin: trip.duration / 60,
    waypoints,
  };
}

/**
 * Calcula distancia total de una secuencia de paradas (Haversine).
 * Útil para comparar antes/después de optimizar.
 */
export function calculateRouteDistanceKm(stops: StopCoordinate[]): number {
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    total += haversineKm(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
  }
  return total;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
