import api from './api';

// Interface for AddressComponent
interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

// Interface for Location
interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
  mainText?: string;
  secondaryText?: string;
}

// Geocoding Cache Class
class GeocodingCache {
  private cache = new Map();
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly COORDINATE_PRECISION = 4; // Reduce precision for better cache hits

  private getCacheKey(lat: number, lng: number): string {
    return `${lat.toFixed(this.COORDINATE_PRECISION)},${lng.toFixed(
      this.COORDINATE_PRECISION,
    )}`;
  }

  get(lat: number, lng: number) {
    const key = this.getCacheKey(lat, lng);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY) {
      return cached.data;
    }

    if (cached) {
      this.cache.delete(key); // Remove expired cache
    }

    return null;
  }

  set(lat: number, lng: number, data: any) {
    const key = this.getCacheKey(lat, lng);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}

// Create a singleton instance
const geocodingCache = new GeocodingCache();

// Helper function to find the best address result (avoiding Plus Codes)
export const findBestAddressResult = (results: any[]) => {
  // Priority order for result types (best to worst)
  const typesPriority = [
    'establishment',
    'premise',
    'street_address',
    'route',
    'intersection',
    'neighborhood',
    'sublocality',
    'locality',
    'administrative_area_level_1',
    'administrative_area_level_2',
    'administrative_area_level_3',
    'country',
  ];

  // Filter out Plus Codes (they typically contain + and are short)
  const filteredResults = results.filter(result => {
    const address = result.formatted_address;
    const isPlusCode = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(address);
    return !isPlusCode;
  });

  // If no results after filtering, use original results
  const resultsToUse = filteredResults.length > 0 ? filteredResults : results;

  // Find the best result based on types
  for (const priorityType of typesPriority) {
    const result = resultsToUse.find(
      r => r.types && r.types.includes(priorityType),
    );
    if (result) {
      return result;
    }
  }

  // If no prioritized type found, return the first non-Plus Code result
  return resultsToUse[0];
};

// Helper function to extract structured address components
export const extractStructuredAddress = (
  addressComponents: AddressComponent[],
  fullAddress: string,
) => {
  let mainText = '';
  let secondaryText = '';

  // Prioritize establishment first for main text
  const establishment = addressComponents.find(comp =>
    comp.types.includes('establishment'),
  )?.long_name;

  const premise = addressComponents.find(comp =>
    comp.types.includes('premise'),
  )?.long_name;

  // If we have establishment, use it as main text
  if (establishment) {
    mainText = establishment;
  } else if (premise) {
    mainText = premise;
  } else {
    // Fall back to street address components
    const streetNumber =
      addressComponents.find(comp => comp.types.includes('street_number'))
        ?.long_name || '';

    const route =
      addressComponents.find(comp => comp.types.includes('route'))?.long_name ||
      '';

    if (streetNumber && route) {
      mainText = `${streetNumber} ${route}`;
    } else if (route) {
      mainText = route;
    } else {
      // Try other neighborhood/area components
      const sublocality = addressComponents.find(
        comp =>
          comp.types.includes('sublocality') ||
          comp.types.includes('sublocality_level_1'),
      )?.long_name;

      const neighborhood = addressComponents.find(comp =>
        comp.types.includes('neighborhood'),
      )?.long_name;

      mainText = sublocality || neighborhood || '';
    }
  }

  // Build secondary text with locality, admin area, and country
  const locality = addressComponents.find(comp =>
    comp.types.includes('locality'),
  )?.long_name;

  const adminArea = addressComponents.find(comp =>
    comp.types.includes('administrative_area_level_1'),
  )?.short_name;

  const country = addressComponents.find(comp =>
    comp.types.includes('country'),
  )?.short_name;

  const secondaryParts = [locality, adminArea, country].filter(Boolean);
  secondaryText = secondaryParts.join(', ');

  // If we still couldn't extract proper main text, use a cleaner version of full address
  if (!mainText || mainText.trim() === '') {
    // Try to extract the first meaningful part of the address
    const addressParts = fullAddress.split(',');
    if (addressParts.length > 0) {
      mainText = addressParts[0].trim();
      if (addressParts.length > 1) {
        secondaryText = addressParts.slice(1).join(',').trim();
      }
    } else {
      mainText = fullAddress;
      secondaryText = '';
    }
  }

  return {mainText, secondaryText};
};

// Process geocoding result to create a Location object
export const processGeocodingResult = (
  results: any[],
  coordinates: [number, number],
): Location => {
  const bestResult = findBestAddressResult(results);

  if (bestResult) {
    const fullAddress = bestResult.formatted_address;
    const addressComponents = bestResult.address_components || [];
    const {mainText, secondaryText} = extractStructuredAddress(
      addressComponents,
      fullAddress,
    );

    return {
      type: 'Point',
      coordinates,
      address: fullAddress,
      mainText,
      secondaryText,
    };
  }

  // Fallback location
  return {
    type: 'Point',
    coordinates,
    address: `${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}`,
    mainText: 'Unknown Location',
    secondaryText: `${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}`,
  };
};

// Optimized Geocoding Function
export const optimizedGeocode = async (
  lat: number,
  lng: number,
  useCache: boolean = true,
): Promise<any> => {
  // Check cache first
  if (useCache) {
    const cached = geocodingCache.get(lat, lng);
    if (cached) {
      console.log('Using cached geocoding result');
      return cached;
    }
  }

  try {
    const response = await api.get('/api/google/geocode', {
      params: {latlng: `${lat},${lng}`},
      timeout: 8000,
    });

    // Cache the result
    if (useCache && response.data.results) {
      geocodingCache.set(lat, lng, response.data);
    }

    return response.data;
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
};

// Helper function to check if location has proper address data
export const hasValidAddress = (location: Location | null): boolean => {
  if (!location) return false;

  const hasMainText =
    typeof location.mainText === 'string' &&
    location.mainText.trim() !== '' &&
    location.mainText !== 'Getting address...';

  const hasSecondaryText =
    typeof location.secondaryText === 'string' &&
    location.secondaryText.trim() !== '';

  return hasMainText && hasSecondaryText;
};

// Helper function to create immediate location (before geocoding)
export const createImmediateLocation = (
  latitude: number,
  longitude: number,
): Location => ({
  type: 'Point',
  coordinates: [longitude, latitude],
  address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
  mainText: 'Getting address...',
  secondaryText: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
});

// Helper function to create fallback location
export const createFallbackLocation = (
  latitude: number,
  longitude: number,
): Location => ({
  type: 'Point',
  coordinates: [longitude, latitude],
  address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
  mainText: 'Unknown Location',
  secondaryText: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
});

// Helper function to clear cache if needed
export const clearGeocodingCache = () => {
  geocodingCache.clear();
};

// Export the cache instance if you need direct access
export {geocodingCache};
