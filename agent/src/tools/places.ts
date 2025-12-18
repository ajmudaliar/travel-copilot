import { Autonomous, z } from "@botpress/runtime";
import { placesTable } from "../tables/places";
import { tripsTable } from "../tables/trips";
import { notifyRefreshPlaces } from "../utils/stateSync";

/**
 * Place management tools for the AI to use in conversations.
 */

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

      await placesTable.deleteRows({
        filter: { id: { $eq: Number(input.placeId) } },
      });

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
 * Search for places (mock implementation)
 */
export const searchPlacesTool = new Autonomous.Tool({
  name: "searchPlaces",
  description: "Search for places like restaurants, cafes, hotels, or attractions. Returns mock results for now. Use this when the user wants to find places to add to their trip.",

  input: z.object({
    query: z.string().describe("Search query, e.g., 'restaurants in Paris' or 'coffee shops near Eiffel Tower'"),
    category: z.string().optional().describe("Category filter: restaurant, cafe, hotel, attraction"),
    nearCity: z.string().optional().describe("City to search in: paris, newyork, tokyo, london"),
  }),

  output: z.object({
    results: z.array(
      z.object({
        name: z.string(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        rating: z.number(),
        category: z.string(),
      })
    ),
    count: z.number(),
    note: z.string(),
  }),

  async handler(input) {
    // Parse query to extract city and category
    const queryLower = input.query.toLowerCase();

    let city = input.nearCity?.toLowerCase() || "default";
    let category = input.category?.toLowerCase() || "restaurant";

    // Try to detect city from query
    if (queryLower.includes("paris")) city = "paris";
    else if (queryLower.includes("new york") || queryLower.includes("nyc")) city = "newyork";
    else if (queryLower.includes("tokyo")) city = "tokyo";
    else if (queryLower.includes("london")) city = "london";

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

    return {
      results,
      count: results.length,
      note: "These are mock results. Connect Google Places API for real data.",
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
