import {useCallback, useRef} from 'react';
import {
  optimizedGeocode,
  processGeocodingResult,
  createImmediateLocation,
  createFallbackLocation,
  hasValidAddress,
} from '../../utils/geocodingCache';

// Interface for Location
interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
  mainText?: string;
  secondaryText?: string;
}

// Enhanced custom hook for geocoding operations
export const useGeocoding = () => {
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Standard debounced geocoding
  const debouncedGeocode = useCallback(
    (
      lat: number,
      lng: number,
      callback: (result: any) => void,
      delay: number = 2000,
    ) => {
      // Clear previous timeout
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }

      // Set new timeout
      geocodeTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await optimizedGeocode(lat, lng);
          callback(result);
        } catch (error) {
          console.error('Debounced geocoding error:', error);
          callback(null);
        }
      }, delay);
    },
    [],
  );

  // Enhanced debounced geocoding that returns processed Location object
  const debouncedGeocodeWithProcessing = useCallback(
    (
      lat: number,
      lng: number,
      callback: (location: Location) => void,
      delay: number = 2000,
    ) => {
      // Clear previous timeout
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }

      // Set new timeout
      geocodeTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await optimizedGeocode(lat, lng);

          if (result?.results && result.results.length > 0) {
            const location = processGeocodingResult(result.results, [lng, lat]);
            callback(location);
          } else {
            // Return fallback location if no results
            const fallbackLocation = createFallbackLocation(lat, lng);
            callback(fallbackLocation);
          }
        } catch (error) {
          console.error('Debounced geocoding error:', error);
          // Return fallback location on error
          const fallbackLocation = createFallbackLocation(lat, lng);
          callback(fallbackLocation);
        }
      }, delay);
    },
    [],
  );

  // Immediate geocoding with processing (no debounce)
  const geocodeWithProcessing = useCallback(
    async (lat: number, lng: number): Promise<Location> => {
      try {
        const result = await optimizedGeocode(lat, lng);

        if (result?.results && result.results.length > 0) {
          return processGeocodingResult(result.results, [lng, lat]);
        } else {
          return createFallbackLocation(lat, lng);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        return createFallbackLocation(lat, lng);
      }
    },
    [],
  );

  // Get current location with geocoding
  const getCurrentLocationWithGeocoding = useCallback(
    async (
      getCurrentPosition: (
        success: (position: any) => void,
        error: (error: any) => void,
        options?: any,
      ) => void,
      options: any = {},
    ): Promise<Location> => {
      return new Promise((resolve, reject) => {
        getCurrentPosition(
          async (position: any) => {
            const {longitude, latitude} = position.coords;

            try {
              const location = await geocodeWithProcessing(latitude, longitude);
              resolve(location);
            } catch (error) {
              console.error('Error processing location:', error);
              // Resolve with basic location info
              resolve({
                type: 'Point',
                coordinates: [longitude, latitude],
                address: 'Unknown location',
                mainText: 'Unknown location',
                secondaryText: `${latitude.toFixed(6)}, ${longitude.toFixed(
                  6,
                )}`,
              });
            }
          },
          error => {
            console.error('Location error:', error);
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000,
            ...options,
          },
        );
      });
    },
    [geocodeWithProcessing],
  );

  // Clear geocoding timeout
  const clearGeocodingTimeout = useCallback(() => {
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
      geocodeTimeoutRef.current = null;
    }
  }, []);

  // Utility functions
  const createImmediate = useCallback(createImmediateLocation, []);
  const createFallback = useCallback(createFallbackLocation, []);
  const validateAddress = useCallback(hasValidAddress, []);

  return {
    // Core geocoding functions
    optimizedGeocode,
    debouncedGeocode,
    debouncedGeocodeWithProcessing,
    geocodeWithProcessing,
    getCurrentLocationWithGeocoding,

    // Utility functions
    createImmediateLocation: createImmediate,
    createFallbackLocation: createFallback,
    hasValidAddress: validateAddress,
    processGeocodingResult,

    // Cleanup
    clearGeocodingTimeout,
  };
};
