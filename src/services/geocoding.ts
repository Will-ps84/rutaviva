// Mapbox Geocoding Service
// 100,000 free requests/month

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    
    if (!token) {
      console.error('Mapbox token not configured');
      return null;
    }
    
    // Add Peru context for better results
    const searchQuery = address.toLowerCase().includes('peru') || address.toLowerCase().includes('lima')
      ? address 
      : `${address}, Lima, Peru`;
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}&limit=1&country=PE`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Geocoding request failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      return {
        lat,
        lng,
        displayName: feature.place_name,
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
    
    // Small delay to avoid rate limiting (Mapbox is more lenient than Nominatim)
    if (i < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
