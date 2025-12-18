import { Autonomous, z } from "@botpress/runtime";
import { tripsTable } from "../tables/trips";
import { notifyRefreshTrips, notifySelectTrip } from "../utils/stateSync";
import { getCurrentUserId } from "../utils/context";

/**
 * Trip management tools for the AI to use in conversations.
 * These wrap the trip business logic and emit state updates.
 */

/**
 * Create a new trip
 */
export const createTripTool = new Autonomous.Tool({
  name: "createTrip",
  description:
    "Create a new trip with a name and location. Use this when the user wants to plan a new trip.",

  input: z.object({
    name: z.string().describe("Trip name, e.g., 'Paris Adventure' or 'NYC Weekend'"),
    description: z.string().optional().describe("Brief description of the trip"),
    centerLatitude: z.number().default(40.7128).describe("Center latitude for map (defaults to NYC)"),
    centerLongitude: z.number().default(-74.006).describe("Center longitude for map (defaults to NYC)"),
    zoomLevel: z.number().default(13).describe("Map zoom level (default 13)"),
  }),

  output: z.object({
    success: z.boolean(),
    tripId: z.string().optional(),
    tripName: z.string().optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      const userId = getCurrentUserId();
      const result = await tripsTable.createRows({
        rows: [
          {
            userId,
            name: input.name,
            description: input.description,
            centerLatitude: input.centerLatitude,
            centerLongitude: input.centerLongitude,
            zoomLevel: input.zoomLevel,
          },
        ],
      });

      if (result.errors?.length) {
        return {
          success: false,
          error: result.errors[0]?.message || "Failed to create trip",
        };
      }

      const row = result.rows[0];
      if (!row) {
        return { success: false, error: "No trip created" };
      }

      const tripId = String(row.id);

      // Notify frontend to refresh and select the new trip
      await notifyRefreshTrips();
      await notifySelectTrip(tripId);

      return {
        success: true,
        tripId,
        tripName: row.name,
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
 * List all trips
 */
export const listTripsTool = new Autonomous.Tool({
  name: "listTrips",
  description: "Get all trips. Use this when the user asks to see their trips.",

  input: z.object({}),

  output: z.object({
    trips: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })
    ),
    count: z.number(),
  }),

  async handler() {
    try {
      const userId = getCurrentUserId();
      const result = await tripsTable.findRows({
        filter: { userId: { $eq: userId } },
      });

      const trips = result.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        description: row.description,
      }));

      // Notify frontend to refresh
      await notifyRefreshTrips();

      return {
        trips,
        count: trips.length,
      };
    } catch (error) {
      console.error("Error listing trips:", error);
      return { trips: [], count: 0 };
    }
  },
});

/**
 * Select a trip
 */
export const selectTripTool = new Autonomous.Tool({
  name: "selectTrip",
  description:
    "Select a trip to work with. Use this when the user wants to focus on a specific trip.",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to select"),
  }),

  output: z.object({
    success: z.boolean(),
    tripName: z.string().optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      const result = await tripsTable.findRows({
        filter: { id: { $eq: Number(input.tripId) } },
      });

      if (result.rows.length === 0) {
        return {
          success: false,
          error: `Trip with ID ${input.tripId} not found`,
        };
      }

      const trip = result.rows[0];

      // Notify frontend to select this trip
      await notifySelectTrip(input.tripId);

      return {
        success: true,
        tripName: trip.name,
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
 * Update a trip
 */
export const updateTripTool = new Autonomous.Tool({
  name: "updateTrip",
  description: "Update an existing trip's name, description, or location.",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to update"),
    name: z.string().optional().describe("New trip name"),
    description: z.string().optional().describe("New description"),
    centerLatitude: z.number().optional().describe("New center latitude"),
    centerLongitude: z.number().optional().describe("New center longitude"),
  }),

  output: z.object({
    success: z.boolean(),
    tripName: z.string().optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      const { tripId, ...updates } = input;

      // Get current trip
      const current = await tripsTable.findRows({
        filter: { id: { $eq: Number(tripId) } },
      });

      if (current.rows.length === 0) {
        return {
          success: false,
          error: `Trip with ID ${tripId} not found`,
        };
      }

      // Build update object
      const updateData: Record<string, unknown> = { id: Number(tripId) };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.centerLatitude !== undefined) updateData.centerLatitude = updates.centerLatitude;
      if (updates.centerLongitude !== undefined) updateData.centerLongitude = updates.centerLongitude;

      const result = await tripsTable.updateRows({
        rows: [updateData as { id: number }],
      });

      if (result.errors?.length) {
        return {
          success: false,
          error: result.errors[0]?.message || "Failed to update trip",
        };
      }

      const updatedRow = result.rows[0];
      const currentRow = current.rows[0];
      const tripName = updatedRow?.name ?? currentRow.name;

      // Notify frontend to refresh
      await notifyRefreshTrips();

      return {
        success: true,
        tripName,
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
 * Delete a trip
 */
export const deleteTripTool = new Autonomous.Tool({
  name: "deleteTrip",
  description:
    "Delete a trip. Use this only after confirming with the user that they want to delete the trip.",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to delete"),
  }),

  output: z.object({
    success: z.boolean(),
    deletedTripName: z.string().optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      // Get trip name first
      const existing = await tripsTable.findRows({
        filter: { id: { $eq: Number(input.tripId) } },
      });

      const tripName = existing.rows[0]?.name;

      // Delete from table
      await tripsTable.deleteRows({
        filter: { id: { $eq: Number(input.tripId) } },
      });

      // Notify frontend to refresh
      await notifyRefreshTrips();

      return {
        success: true,
        deletedTripName: tripName,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Export all tools as an array for easy use in conversations
export const tripTools = [
  createTripTool,
  listTripsTool,
  selectTripTool,
  updateTripTool,
  deleteTripTool,
];
