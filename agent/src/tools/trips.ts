import { Autonomous, bot, z } from "@botpress/runtime";
import { tripsTable } from "../tables/trips";
import { emitStateUpdate } from "../utils/stateSync";

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
      const result = await tripsTable.createRows({
        rows: [
          {
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

      const trip = {
        id: String(row.id),
        name: row.name,
        description: row.description,
        centerLatitude: row.centerLatitude,
        centerLongitude: row.centerLongitude,
        zoomLevel: row.zoomLevel,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };

      // Update bot state
      bot.state.trips = [...bot.state.trips, trip];
      bot.state.selectedTripId = trip.id;

      // Emit state update
      await emitStateUpdate();

      return {
        success: true,
        tripId: trip.id,
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
      const result = await tripsTable.findRows({});

      const trips = result.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        description: row.description,
        centerLatitude: row.centerLatitude,
        centerLongitude: row.centerLongitude,
        zoomLevel: row.zoomLevel,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));

      // Sync to bot state
      bot.state.trips = trips;
      await emitStateUpdate();

      return {
        trips: trips.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        })),
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
      bot.state.selectedTripId = input.tripId;
      await emitStateUpdate();

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

      const trip = {
        id: String(updatedRow?.id ?? currentRow.id),
        name: updatedRow?.name ?? currentRow.name,
        description: updatedRow?.description ?? currentRow.description,
        centerLatitude: updatedRow?.centerLatitude ?? currentRow.centerLatitude,
        centerLongitude: updatedRow?.centerLongitude ?? currentRow.centerLongitude,
        zoomLevel: updatedRow?.zoomLevel ?? currentRow.zoomLevel,
        createdAt: updatedRow?.createdAt ?? currentRow.createdAt,
        updatedAt: updatedRow?.updatedAt ?? currentRow.updatedAt,
      };

      bot.state.trips = bot.state.trips.map((t) => (t.id === tripId ? trip : t));
      await emitStateUpdate();

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

      // Update bot state
      bot.state.trips = bot.state.trips.filter((t) => t.id !== input.tripId);
      if (bot.state.selectedTripId === input.tripId) {
        bot.state.selectedTripId = null;
      }
      bot.state.places = bot.state.places.filter((p) => p.tripId !== input.tripId);

      await emitStateUpdate();

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
