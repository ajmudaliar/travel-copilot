import dotenv from "dotenv";

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

/**
 * Geocode an address/place name to coordinates using Google Geocoding API
 */
export async function geocodeLocation(
  address: string
): Promise<{ latitude: number; longitude: number } | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_PLACES_API_KEY}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      return { latitude: lat, longitude: lng };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Calculate distance between two points in km (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  category: string;
  photoUrl?: string;
  distanceKm?: number; // Distance from reference point in km
}

interface GooglePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
}

interface GooglePlaceResult {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  primaryType?: string;
  types?: string[];
  photos?: GooglePhoto[];
}

/**
 * Build a photo URL from Google Places photo reference
 */
function buildPhotoUrl(photoName: string, maxWidth = 400): string {
  if (!GOOGLE_PLACES_API_KEY) return "";
  return `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_PLACES_API_KEY}&maxWidthPx=${maxWidth}`;
}

/**
 * Check if Google Places API is configured
 */
export function isGooglePlacesConfigured(): boolean {
  return !!GOOGLE_PLACES_API_KEY;
}

/**
 * Map Google's place types to our categories
 */
function mapGoogleTypeToCategory(types: string[]): string {
  if (types.some((t) => ["restaurant", "food", "meal_takeaway", "meal_delivery"].includes(t))) {
    return "restaurant";
  }
  if (types.some((t) => ["cafe", "coffee_shop", "bakery"].includes(t))) {
    return "cafe";
  }
  if (types.some((t) => ["lodging", "hotel", "motel", "guest_house"].includes(t))) {
    return "hotel";
  }
  if (types.some((t) => ["tourist_attraction", "museum", "park", "landmark", "point_of_interest"].includes(t))) {
    return "attraction";
  }
  return "attraction";
}

/**
 * Search for places using Google Places API (New)
 * @param locationBias - Optional coordinates to bias search results (e.g., trip center)
 * @param maxResults - Maximum number of results to return (default 5, max 20)
 * @param sortByDistanceFrom - If provided, results will be sorted by distance from this point
 */
export async function searchGooglePlaces(
  query: string,
  category?: string,
  nearCity?: string,
  locationBias?: { latitude: number; longitude: number },
  maxResults: number = 5,
  sortByDistanceFrom?: { latitude: number; longitude: number }
): Promise<{ results: PlaceResult[]; count: number }> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Google Places API key not configured");
  }

  // Build the search query
  let searchQuery = query;
  if (nearCity && !query.toLowerCase().includes(nearCity.toLowerCase())) {
    searchQuery = `${query} in ${nearCity}`;
  }

  // Map category to Google's included type
  let includedType: string | undefined;
  if (category) {
    const categoryMap: Record<string, string> = {
      restaurant: "restaurant",
      cafe: "cafe",
      hotel: "lodging",
      attraction: "tourist_attraction",
    };
    includedType = categoryMap[category];
  }

  // Build location bias if coordinates provided (50km radius circle)
  const locationBiasObj = locationBias
    ? {
        locationBias: {
          circle: {
            center: {
              latitude: locationBias.latitude,
              longitude: locationBias.longitude,
            },
            radius: 50000, // 50km radius
          },
        },
      }
    : {};

  // Fetch more results if we're sorting by distance (to get best matches after sorting)
  const fetchCount = sortByDistanceFrom ? Math.min(20, maxResults * 2) : Math.min(20, maxResults);

  try {
    // Use Text Search (New) API
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types,places.primaryType,places.photos",
        },
        body: JSON.stringify({
          textQuery: searchQuery,
          ...(includedType && { includedType }),
          ...locationBiasObj,
          maxResultCount: fetchCount,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Google Places API error:", error);
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();
    const places: GooglePlaceResult[] = data.places || [];

    // Reference point for distance calculation (sortByDistanceFrom or locationBias)
    const distanceRef = sortByDistanceFrom || locationBias;

    let results: PlaceResult[] = places.map((place) => {
      // Get first photo URL if available
      const photoUrl = place.photos?.[0]?.name
        ? buildPhotoUrl(place.photos[0].name)
        : undefined;

      const lat = place.location?.latitude || 0;
      const lng = place.location?.longitude || 0;

      // Calculate distance if we have a reference point
      const distanceKm = distanceRef
        ? calculateDistance(distanceRef.latitude, distanceRef.longitude, lat, lng)
        : undefined;

      return {
        placeId: place.id || "",
        name: place.displayName?.text || "Unknown",
        address: place.formattedAddress || "",
        latitude: lat,
        longitude: lng,
        rating: place.rating || 0,
        category: mapGoogleTypeToCategory(place.types || []),
        photoUrl,
        distanceKm,
      };
    });

    // Sort by distance if requested
    if (sortByDistanceFrom) {
      results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    // Limit to maxResults
    results = results.slice(0, maxResults);

    return {
      results,
      count: results.length,
    };
  } catch (error) {
    console.error("Error searching Google Places:", error);
    throw error;
  }
}
