// Mapbox Geocoding Service
// 100,000 free requests/month

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    
    if (!token) {
      console.error('Mapbox token not configured');
      return null;
    }
    
    let searchAddress = address.trim();
    const lower = searchAddress.toLowerCase();
    
    // Normalize: add city if no known Peruvian city is mentioned
    if (!lower.match(/lima|callao|arequipa|trujillo|piura|cusco|chiclayo|huancayo|ica|tacna/)) {
      searchAddress = `${searchAddress}, Lima`;
    }
    
    // Normalize: add country if not mentioned
    if (!lower.match(/peru|perú/)) {
      searchAddress = `${searchAddress}, Peru`;
    }
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchAddress)}.json?` +
      `access_token=${token}&` +
      `country=PE&` +
      `limit=1&` +
      `language=es`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Geocoding request failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      const relevance = feature.relevance || 0;
      const confidence: 'high' | 'medium' | 'low' = relevance > 0.8 ? 'high' : relevance > 0.4 ? 'medium' : 'low';
      
      console.log(`✅ Geocoded: "${address}" → (${lat}, ${lng}) [${confidence}]`);
      
      return {
        lat,
        lng,
        displayName: feature.place_name,
        confidence,
      };
    }
    
    console.warn(`⚠️ No results for: "${address}"`);
    return null;
  } catch (error) {
    console.error('❌ Geocoding error:', error);
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
    
    // Small delay to avoid rate limiting
    if (i < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
