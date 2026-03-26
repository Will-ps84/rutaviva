// Mapbox Geocoding Service
// 100,000 free requests/month

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
}

export function isValidPeruCoords(lat: number, lng: number): boolean {
  return lat >= -18.5 && lat <= -0.5 && lng >= -81.5 && lng <= -68;
}

export interface GeocodingSuggestion {
  text: string;
  placeName: string;
  lat: number;
  lng: number;
}

function getMapboxToken(): string | null {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  return token || null;
}

function normalizeAddress(address: string): string {
  let searchAddress = address.trim();
  const lower = searchAddress.toLowerCase();
  
  if (!lower.match(/lima|callao|arequipa|trujillo|piura|cusco|chiclayo|huancayo|ica|tacna/)) {
    searchAddress = `${searchAddress}, Lima`;
  }
  if (!lower.match(/peru|perú/)) {
    searchAddress = `${searchAddress}, Peru`;
  }
  return searchAddress;
}

const LIMA_CENTER = { lat: -12.0464, lng: -77.0428 };

function buildMapboxUrl(query: string, limit: number = 1): string | null {
  const token = getMapboxToken();
  if (!token) return null;
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
    `access_token=${token}&` +
    `country=PE&` +
    `proximity=${LIMA_CENTER.lng},${LIMA_CENTER.lat}&` +
    `limit=${limit}&` +
    `language=es`;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const searchAddress = normalizeAddress(address);
    const url = buildMapboxUrl(searchAddress);
    if (!url) return null;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      const relevance = feature.relevance || 0;
      const confidence: 'high' | 'medium' | 'low' = relevance > 0.8 ? 'high' : relevance > 0.4 ? 'medium' : 'low';
      
      return { lat, lng, displayName: feature.place_name, confidence };
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function geocodeSuggestions(query: string): Promise<GeocodingSuggestion[]> {
  try {
    if (query.trim().length < 3) return [];
    const searchQuery = normalizeAddress(query);
    const url = buildMapboxUrl(searchQuery, 5);
    if (!url) return [];
    
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    
    if (!data.features) return [];
    
    return data.features.map((f: { text: string; place_name: string; center: [number, number] }) => ({
      text: f.text,
      placeName: f.place_name,
      lat: f.center[1],
      lng: f.center[0],
    }));
  } catch {
    return [];
  }
}

export async function geocodeAddresses(
  addresses: string[],
  onProgress?: (current: number, total: number) => void
): Promise<(GeocodingResult | null)[]> {
  const results: (GeocodingResult | null)[] = [];
  
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i].trim();
    
    if (!address) {
      results.push(null);
      continue;
    }
    
    const result = await geocodeAddress(address);
    results.push(result);
    
    if (onProgress) {
      onProgress(i + 1, addresses.length);
    }
    
    // Small delay to avoid rate limiting
    if (i < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
