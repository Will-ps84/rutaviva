// Nominatim Geocoding Service (free, rate-limited 1 req/sec)
// https://nominatim.org/release-docs/latest/api/Search/

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
}

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

// Rate limiting: max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    await waitForRateLimit();
    
    // Add "Lima, Peru" context for better results
    const searchQuery = address.toLowerCase().includes('lima') 
      ? address 
      : `${address}, Lima, Peru`;
    
    const params = new URLSearchParams({
      q: searchQuery,
      format: 'json',
      limit: '1',
      addressdetails: '1',
    });
    
    const response = await fetch(`${NOMINATIM_BASE_URL}?${params}`, {
      headers: {
        'User-Agent': 'RutaViva-MVP/1.0 (logistics tracking app)',
      },
    });
    
    if (!response.ok) {
      console.error('Geocoding request failed:', response.status);
      return null;
    }
    
    const results = await response.json();
    
    if (results && results.length > 0) {
      const result = results[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
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
  }
  
  return results;
}
