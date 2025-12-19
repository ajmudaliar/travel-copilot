import { Action, z } from "@botpress/runtime";
import { placesTable } from "../tables/places";
import { tripsTable } from "../tables/trips";
import { notifyRefreshPlaces } from "../utils/stateSync";

/**
 * Action for adding a place to a trip.
 * This can be called from the frontend via client.callAction()
 */
export const addPlaceToTrip = new Action({
  name: "addPlaceToTrip",
  description: "Add a place to a trip. Called from the frontend when user clicks 'Add to Trip' button.",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to add the place to"),
    placeId: z.string().optional().describe("Google Place ID (for reference)"),
    name: z.string().describe("Place name"),
    address: z.string().describe("Place address"),
    latitude: z.number().describe("Place latitude"),
    longitude: z.number().describe("Place longitude"),
    rating: z.number().optional().describe("Place rating (0-5)"),
    category: z.string().optional().describe("Category: restaurant, hotel, attraction, cafe, etc."),
  }),

  output: z.object({
    success: z.boolean(),
    placeId: z.string().optional().describe("ID of the created place in our database"),
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

      // Create the place
      const result = await placesTable.createRows({
        rows: [
          {
            tripId: input.tripId,
            name: input.name,
            address: input.address,
            latitude: input.latitude,
            longitude: input.longitude,
            rating: input.rating,
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

      // Notify frontend to refresh places
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
