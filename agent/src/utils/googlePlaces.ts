import dotenv from "dotenv";

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface PlaceResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  category: string;
}

interface GooglePlaceResult {
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  primaryType?: string;
  types?: string[];
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
 */
export async function searchGooglePlaces(
  query: string,
  category?: string,
  nearCity?: string
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

  try {
    // Use Text Search (New) API
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.rating,places.types,places.primaryType",
        },
        body: JSON.stringify({
          textQuery: searchQuery,
          ...(includedType && { includedType }),
          maxResultCount: 10,
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

    const results: PlaceResult[] = places.map((place) => ({
      name: place.displayName?.text || "Unknown",
      address: place.formattedAddress || "",
      latitude: place.location?.latitude || 0,
      longitude: place.location?.longitude || 0,
      rating: place.rating || 0,
      category: mapGoogleTypeToCategory(place.types || []),
    }));

    return {
      results,
      count: results.length,
    };
  } catch (error) {
    console.error("Error searching Google Places:", error);
    throw error;
  }
}
