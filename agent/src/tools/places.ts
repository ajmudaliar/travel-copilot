import { Autonomous, z, context, user } from "@botpress/runtime";
import { placesTable } from "../tables/places";
import { tripsTable } from "../tables/trips";
import { notifyRefreshPlaces } from "../utils/stateSync";
import { isGooglePlacesConfigured, searchGooglePlaces } from "../utils/googlePlaces";

/**
 * Place management tools for the AI to use in conversations.
 */

/**
 * Place data for UI suggestions
 */
interface PlaceSuggestion {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  category: string;
  photoUrl?: string;
}

/**
 * Send place suggestions to the frontend as a custom message
 */
async function sendPlaceSuggestions(places: PlaceSuggestion[], tripId: string | null): Promise<void> {
  try {
    const client = context.get("client");
    const conversation = context.get("conversation");
    const botId = context.get("botId");

    if (!client || !conversation) {
      console.warn("No client/conversation context for place suggestions");
      return;
    }

    await client.createMessage({
      conversationId: conversation.id,
      userId: botId,
      type: "custom",
      payload: {
        name: "place_suggestions",
        url: "custom://place-suggestions",
        data: {
          type: "place_suggestions",
          places,
          tripId,
        },
      },
      tags: {},
    });
  } catch (error) {
    console.error("Failed to send place suggestions:", error);
  }
}

/**
 * Add a place to a trip
 */
export const addPlaceTool = new Autonomous.Tool({
  name: "addPlace",
  description: "Add a place to a trip. Use this when the user wants to add a location to their trip.",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to add the place to"),
    name: z.string().describe("Place name"),
    address: z.string().describe("Place address"),
    latitude: z.number().describe("Place latitude"),
    longitude: z.number().describe("Place longitude"),
    rating: z.number().optional().describe("Place rating (0-5)"),
    description: z.string().optional().describe("Brief description of the place"),
    category: z.string().optional().describe("Category: restaurant, hotel, attraction, cafe, etc."),
    photoUrl: z.string().optional().describe("Photo URL"),
  }),

  output: z.object({
    success: z.boolean(),
    placeId: z.string().optional(),
    placeName: z.string().optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      // Verify trip exists
      const tripResult = await tripsTable.findRows({
        filter: { id: { $eq: Number(input.tripId) } },
      });

      if (tripResult.rows.length === 0) {
        return {
          success: false,
          error: `Trip with ID ${input.tripId} not found`,
        };
      }

      // Check if place with same coordinates already exists in this trip
      const existing = await placesTable.findRows({
        filter: {
          tripId: { $eq: input.tripId },
          latitude: { $eq: input.latitude },
          longitude: { $eq: input.longitude },
        },
        limit: 1,
      });

      if (existing.rows.length > 0) {
        const existingPlace = existing.rows[0];
        return {
          success: true,
          placeId: String(existingPlace.id),
          placeName: existingPlace.name,
        };
      }

      const result = await placesTable.createRows({
        rows: [
          {
            tripId: input.tripId,
            name: input.name,
            address: input.address,
            latitude: input.latitude,
            longitude: input.longitude,
            rating: input.rating,
            description: input.description,
            category: input.category,
            photoUrl: input.photoUrl,
          },
        ],
      });

      if (result.errors?.length) {
        return {
          success: false,
          error: result.errors[0]?.message || "Failed to add place",
        };
      }

      const row = result.rows[0];
      if (!row) {
        return { success: false, error: "No place created" };
      }

      await notifyRefreshPlaces(input.tripId);

      return {
        success: true,
        placeId: String(row.id),
        placeName: row.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Remove a place from a trip
 */
export const removePlaceTool = new Autonomous.Tool({
  name: "removePlace",
  description: "Remove a place from a trip. Use this when the user wants to delete a place.",

  input: z.object({
    placeId: z.string().describe("The ID of the place to remove"),
  }),

  output: z.object({
    success: z.boolean(),
    removedPlaceName: z.string().optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      // Get place info first
      const existing = await placesTable.findRows({
        filter: { id: { $eq: Number(input.placeId) } },
      });

      const place = existing.rows[0];
      if (!place) {
        return {
          success: false,
          error: `Place with ID ${input.placeId} not found`,
        };
      }

      await placesTable.deleteRowIds([Number(input.placeId)]);

      await notifyRefreshPlaces(place.tripId);

      return {
        success: true,
        removedPlaceName: place.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * List places for a trip
 */
export const listPlacesTool = new Autonomous.Tool({
  name: "listPlaces",
  description: "List all places in a trip. Use this when the user wants to see places in their trip.",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to list places for"),
  }),

  output: z.object({
    places: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        address: z.string(),
        category: z.string().optional(),
        rating: z.number().optional(),
      })
    ),
    count: z.number(),
  }),

  async handler(input) {
    try {
      const result = await placesTable.findRows({
        filter: { tripId: { $eq: input.tripId } },
      });

      const places = result.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        address: row.address,
        category: row.category,
        rating: row.rating,
      }));

      return {
        places,
        count: places.length,
      };
    } catch (error) {
      console.error("Error listing places:", error);
      return { places: [], count: 0 };
    }
  },
});

/**
 * Mock place data for different cities/categories
 * Note: placeId is added as empty string when returning (Google Places UI Kit won't work with mock)
 */
const MOCK_PLACES: Record<string, Array<{
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  category: string;
}>> = {
  // Paris
  "paris:restaurant": [
    { name: "Le Comptoir du Panthéon", address: "10 Rue Soufflot, 75005 Paris", latitude: 48.8462, longitude: 2.3436, rating: 4.5, category: "restaurant" },
    { name: "Café de Flore", address: "172 Bd Saint-Germain, 75006 Paris", latitude: 48.8540, longitude: 2.3325, rating: 4.3, category: "restaurant" },
    { name: "Le Petit Cler", address: "29 Rue Cler, 75007 Paris", latitude: 48.8574, longitude: 2.3063, rating: 4.6, category: "restaurant" },
  ],
  "paris:cafe": [
    { name: "Les Deux Magots", address: "6 Pl. Saint-Germain des Prés, 75006 Paris", latitude: 48.8541, longitude: 2.3334, rating: 4.2, category: "cafe" },
    { name: "Café de la Paix", address: "5 Pl. de l'Opéra, 75009 Paris", latitude: 48.8700, longitude: 2.3319, rating: 4.4, category: "cafe" },
  ],
  "paris:attraction": [
    { name: "Eiffel Tower", address: "Champ de Mars, 5 Av. Anatole France, 75007 Paris", latitude: 48.8584, longitude: 2.2945, rating: 4.7, category: "attraction" },
    { name: "Louvre Museum", address: "Rue de Rivoli, 75001 Paris", latitude: 48.8606, longitude: 2.3376, rating: 4.8, category: "attraction" },
    { name: "Notre-Dame Cathedral", address: "6 Parvis Notre-Dame, 75004 Paris", latitude: 48.8530, longitude: 2.3499, rating: 4.7, category: "attraction" },
  ],
  "paris:hotel": [
    { name: "Hotel Le Marais", address: "2 Rue Commines, 75003 Paris", latitude: 48.8636, longitude: 2.3645, rating: 4.3, category: "hotel" },
    { name: "Hotel Saint-Louis", address: "75 Rue Saint-Louis en l'Île, 75004 Paris", latitude: 48.8513, longitude: 2.3567, rating: 4.5, category: "hotel" },
  ],
  // New York
  "newyork:restaurant": [
    { name: "Katz's Delicatessen", address: "205 E Houston St, New York, NY 10002", latitude: 40.7223, longitude: -73.9874, rating: 4.5, category: "restaurant" },
    { name: "Joe's Pizza", address: "7 Carmine St, New York, NY 10014", latitude: 40.7306, longitude: -74.0021, rating: 4.4, category: "restaurant" },
    { name: "The Smith", address: "956 2nd Ave, New York, NY 10022", latitude: 40.7575, longitude: -73.9657, rating: 4.3, category: "restaurant" },
  ],
  "newyork:cafe": [
    { name: "Blue Bottle Coffee", address: "450 W 15th St, New York, NY 10011", latitude: 40.7423, longitude: -74.0060, rating: 4.4, category: "cafe" },
    { name: "Stumptown Coffee", address: "18 W 29th St, New York, NY 10001", latitude: 40.7455, longitude: -73.9884, rating: 4.3, category: "cafe" },
  ],
  "newyork:attraction": [
    { name: "Statue of Liberty", address: "Liberty Island, New York, NY 10004", latitude: 40.6892, longitude: -74.0445, rating: 4.7, category: "attraction" },
    { name: "Central Park", address: "New York, NY 10022", latitude: 40.7829, longitude: -73.9654, rating: 4.8, category: "attraction" },
    { name: "Empire State Building", address: "350 5th Ave, New York, NY 10118", latitude: 40.7484, longitude: -73.9857, rating: 4.7, category: "attraction" },
  ],
  // Tokyo
  "tokyo:restaurant": [
    { name: "Ichiran Shibuya", address: "1-22-7 Jinnan, Shibuya City, Tokyo", latitude: 35.6619, longitude: 139.6982, rating: 4.5, category: "restaurant" },
    { name: "Tsukiji Sushiko", address: "4-13-9 Tsukiji, Chuo City, Tokyo", latitude: 35.6654, longitude: 139.7707, rating: 4.6, category: "restaurant" },
    { name: "Afuri Ramen", address: "1-1-7 Ebisu, Shibuya City, Tokyo", latitude: 35.6468, longitude: 139.7102, rating: 4.4, category: "restaurant" },
  ],
  "tokyo:cafe": [
    { name: "Blue Bottle Coffee Shinjuku", address: "4-1-6 Shinjuku, Shinjuku City, Tokyo", latitude: 35.6905, longitude: 139.7042, rating: 4.5, category: "cafe" },
    { name: "Streamer Coffee Company", address: "1-20-28 Shibuya, Shibuya City, Tokyo", latitude: 35.6580, longitude: 139.7016, rating: 4.4, category: "cafe" },
    { name: "Fuglen Tokyo", address: "1-16-11 Tomigaya, Shibuya City, Tokyo", latitude: 35.6679, longitude: 139.6889, rating: 4.6, category: "cafe" },
  ],
  "tokyo:hotel": [
    { name: "Park Hyatt Tokyo", address: "3-7-1-2 Nishi-Shinjuku, Shinjuku City, Tokyo", latitude: 35.6867, longitude: 139.6908, rating: 4.7, category: "hotel" },
    { name: "The Prince Gallery Tokyo", address: "1-2-1 Kioicho, Chiyoda City, Tokyo", latitude: 35.6811, longitude: 139.7349, rating: 4.6, category: "hotel" },
  ],
  "tokyo:attraction": [
    { name: "Senso-ji Temple", address: "2-3-1 Asakusa, Taito City, Tokyo", latitude: 35.7148, longitude: 139.7967, rating: 4.6, category: "attraction" },
    { name: "Tokyo Tower", address: "4-2-8 Shibakoen, Minato City, Tokyo", latitude: 35.6586, longitude: 139.7454, rating: 4.5, category: "attraction" },
    { name: "Meiji Shrine", address: "1-1 Yoyogikamizonocho, Shibuya City, Tokyo", latitude: 35.6764, longitude: 139.6993, rating: 4.7, category: "attraction" },
  ],
  // Montreal
  "montreal:restaurant": [
    { name: "Joe Beef", address: "2491 Rue Notre-Dame O, Montreal, QC H3J 1N6", latitude: 45.4833, longitude: -73.5804, rating: 4.7, category: "restaurant" },
    { name: "Schwartz's Deli", address: "3895 Bd Saint-Laurent, Montreal, QC H2W 1X9", latitude: 45.5168, longitude: -73.5778, rating: 4.5, category: "restaurant" },
    { name: "Au Pied de Cochon", address: "536 Av Duluth E, Montreal, QC H2L 1A9", latitude: 45.5192, longitude: -73.5721, rating: 4.6, category: "restaurant" },
  ],
  "montreal:cafe": [
    { name: "Crew Collective & Café", address: "360 Rue Saint-Jacques, Montreal, QC H2Y 1P5", latitude: 45.5045, longitude: -73.5594, rating: 4.6, category: "cafe" },
    { name: "Café Olimpico", address: "124 Rue Saint-Viateur O, Montreal, QC H2T 2L1", latitude: 45.5234, longitude: -73.6001, rating: 4.4, category: "cafe" },
    { name: "Tommy Cafe", address: "200 Rue Notre-Dame O, Montreal, QC H2Y 1T3", latitude: 45.5031, longitude: -73.5556, rating: 4.5, category: "cafe" },
  ],
  "montreal:attraction": [
    { name: "Mount Royal", address: "Montreal, QC H3H 1A1", latitude: 45.5048, longitude: -73.5874, rating: 4.8, category: "attraction" },
    { name: "Old Montreal", address: "Old Montreal, Montreal, QC", latitude: 45.5079, longitude: -73.5540, rating: 4.7, category: "attraction" },
    { name: "Notre-Dame Basilica", address: "110 Rue Notre-Dame O, Montreal, QC H2Y 1T1", latitude: 45.5046, longitude: -73.5566, rating: 4.8, category: "attraction" },
    { name: "Montreal Museum of Fine Arts", address: "1380 Rue Sherbrooke O, Montreal, QC H3G 1J5", latitude: 45.4986, longitude: -73.5794, rating: 4.6, category: "attraction" },
  ],
  "montreal:hotel": [
    { name: "Fairmont The Queen Elizabeth", address: "900 Bd René-Lévesque O, Montreal, QC H3B 4A5", latitude: 45.4996, longitude: -73.5679, rating: 4.5, category: "hotel" },
    { name: "Hotel William Gray", address: "421 Rue Saint-Vincent, Montreal, QC H2Y 3A6", latitude: 45.5082, longitude: -73.5529, rating: 4.6, category: "hotel" },
  ],
  // London
  "london:restaurant": [
    { name: "Dishoom King's Cross", address: "5 Stable St, London N1C 4AB", latitude: 51.5355, longitude: -0.1246, rating: 4.6, category: "restaurant" },
    { name: "The Ledbury", address: "127 Ledbury Rd, London W11 2AQ", latitude: 51.5154, longitude: -0.2010, rating: 4.7, category: "restaurant" },
  ],
  "london:attraction": [
    { name: "Tower of London", address: "St Katharine's & Wapping, London EC3N 4AB", latitude: 51.5081, longitude: -0.0759, rating: 4.6, category: "attraction" },
    { name: "British Museum", address: "Great Russell St, London WC1B 3DG", latitude: 51.5194, longitude: -0.1270, rating: 4.7, category: "attraction" },
    { name: "Big Ben", address: "Westminster, London SW1A 0AA", latitude: 51.5007, longitude: -0.1246, rating: 4.6, category: "attraction" },
  ],
  // Generic fallback
  "default:restaurant": [
    { name: "Local Bistro", address: "123 Main Street", latitude: 0, longitude: 0, rating: 4.2, category: "restaurant" },
    { name: "City Diner", address: "456 Central Ave", latitude: 0, longitude: 0, rating: 4.0, category: "restaurant" },
  ],
  "default:cafe": [
    { name: "Corner Coffee", address: "789 Oak Street", latitude: 0, longitude: 0, rating: 4.3, category: "cafe" },
  ],
  "default:attraction": [
    { name: "City Park", address: "Central District", latitude: 0, longitude: 0, rating: 4.5, category: "attraction" },
    { name: "Local Museum", address: "100 Museum Way", latitude: 0, longitude: 0, rating: 4.4, category: "attraction" },
  ],
};

/**
 * Search for places using Google Places API (with mock fallback)
 */
export const searchPlacesTool = new Autonomous.Tool({
  name: "searchPlaces",
  description: "Search for places like restaurants, cafes, hotels, bars, or attractions.",

  input: z.object({
    query: z.string().describe("Full search query including location context, e.g., 'coffee shops in Old Montreal' or 'bars near Peel Street'"),
    category: z.string().optional().describe("Category: restaurant, cafe, hotel, bar, attraction"),
    nearCity: z.string().optional().describe("City name for context"),
  }),

  output: z.object({
    results: z.array(
      z.object({
        placeId: z.string().describe("Google Place ID for UI Kit"),
        name: z.string(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        rating: z.number(),
        category: z.string(),
        photoUrl: z.string().optional().describe("Photo URL - pass this to addPlace"),
      })
    ),
    count: z.number(),
    note: z.string(),
  }),

  async handler(input) {
    // Get current selected trip ID for the suggestion cards
    const selectedTripId = user.state.selectedTripId;

    // Try Google Places API first
    if (isGooglePlacesConfigured()) {
      try {
        const { results, count } = await searchGooglePlaces(
          input.query,
          input.category,
          input.nearCity
        );

        // Send place suggestions to frontend as custom message
        await sendPlaceSuggestions(results, selectedTripId);

        return {
          results,
          count,
          note: "Results displayed in chat. User can click to add places to their trip.",
        };
      } catch (error) {
        console.error("Google Places API failed, falling back to mock:", error);
        // Fall through to mock data
      }
    }

    // Fallback to mock data
    const queryLower = input.query.toLowerCase();

    let city = input.nearCity?.toLowerCase() || "default";
    let category = input.category?.toLowerCase() || "restaurant";

    // Try to detect city from query
    if (queryLower.includes("paris")) city = "paris";
    else if (queryLower.includes("new york") || queryLower.includes("nyc")) city = "newyork";
    else if (queryLower.includes("tokyo")) city = "tokyo";
    else if (queryLower.includes("london")) city = "london";
    else if (queryLower.includes("montreal") || queryLower.includes("montréal")) city = "montreal";

    // Try to detect category from query
    if (queryLower.includes("restaurant") || queryLower.includes("food") || queryLower.includes("eat")) {
      category = "restaurant";
    } else if (queryLower.includes("coffee") || queryLower.includes("cafe") || queryLower.includes("café")) {
      category = "cafe";
    } else if (queryLower.includes("hotel") || queryLower.includes("stay") || queryLower.includes("accommodation")) {
      category = "hotel";
    } else if (queryLower.includes("attraction") || queryLower.includes("visit") || queryLower.includes("see") || queryLower.includes("museum") || queryLower.includes("landmark")) {
      category = "attraction";
    }

    // Get mock results
    const key = `${city}:${category}`;
    let results = MOCK_PLACES[key] || MOCK_PLACES[`default:${category}`] || MOCK_PLACES["default:restaurant"];

    // If using default, adjust coordinates based on city center
    if (city !== "default" && !MOCK_PLACES[key]) {
      const cityCenters: Record<string, { lat: number; lng: number }> = {
        paris: { lat: 48.8566, lng: 2.3522 },
        newyork: { lat: 40.7128, lng: -74.0060 },
        tokyo: { lat: 35.6762, lng: 139.6503 },
        london: { lat: 51.5074, lng: -0.1278 },
        montreal: { lat: 45.5017, lng: -73.5673 },
      };
      const center = cityCenters[city];
      if (center) {
        results = results.map((r) => ({
          ...r,
          latitude: center.lat + (Math.random() - 0.5) * 0.02,
          longitude: center.lng + (Math.random() - 0.5) * 0.02,
        }));
      }
    }

    // Add empty placeId for mock data (Google Places UI Kit won't work without real IDs)
    const resultsWithPlaceId = results.map((r) => ({
      placeId: "",
      ...r,
    }));

    // Send place suggestions to frontend as custom message
    await sendPlaceSuggestions(resultsWithPlaceId, selectedTripId);

    return {
      results: resultsWithPlaceId,
      count: resultsWithPlaceId.length,
      note: "Results displayed in chat (mock data - Google Places UI won't show photos). User can click to add places.",
    };
  },
});

// Export all place tools
export const placeTools = [
  addPlaceTool,
  removePlaceTool,
  listPlacesTool,
  searchPlacesTool,
];
