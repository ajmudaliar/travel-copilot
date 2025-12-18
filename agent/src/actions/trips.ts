import { Action, bot, z } from "@botpress/runtime";
import { tripsTable } from "../tables/trips";
import { emitStateUpdate } from "../utils/stateSync";

/**
 * Create a new trip.
 * Creates a table row and updates bot state.
 */
export const createTrip = new Action({
  name: "createTrip",
  description: "Create a new trip with a name and optional location",

  input: z.object({
    name: z.string().describe("Trip name"),
    description: z.string().optional().describe("Trip description"),
    centerLatitude: z.number().default(40.7128).describe("Center latitude (defaults to NYC)"),
    centerLongitude: z.number().default(-74.006).describe("Center longitude (defaults to NYC)"),
    zoomLevel: z.number().default(13).describe("Map zoom level"),
  }),

  output: z.object({
    success: z.boolean(),
    trip: z
      .object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        centerLatitude: z.number(),
        centerLongitude: z.number(),
        zoomLevel: z.number(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      // Create the trip in the table
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

      const createdRow = result.rows[0];
      if (!createdRow) {
        return {
          success: false,
          error: "No trip was created",
        };
      }

      const trip = {
        id: String(createdRow.id),
        name: createdRow.name,
        description: createdRow.description,
        centerLatitude: createdRow.centerLatitude,
        centerLongitude: createdRow.centerLongitude,
        zoomLevel: createdRow.zoomLevel,
        createdAt: createdRow.createdAt,
        updatedAt: createdRow.updatedAt,
      };

      // Update bot state with the new trip
      bot.state.trips = [...bot.state.trips, trip];

      // Auto-select the newly created trip
      bot.state.selectedTripId = trip.id;

      // Emit state update to frontend
      await emitStateUpdate();

      return {
        success: true,
        trip,
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
 * List all trips.
 * Returns trips from the table and syncs to bot state.
 */
export const listTrips = new Action({
  name: "listTrips",
  description: "Get all trips",

  input: z.object({}),

  output: z.object({
    trips: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        centerLatitude: z.number(),
        centerLongitude: z.number(),
        zoomLevel: z.number(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
    ),
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

      // Emit state update to frontend
      await emitStateUpdate();

      return { trips };
    } catch (error) {
      console.error("Error listing trips:", error);
      return { trips: [] };
    }
  },
});

/**
 * Select a trip by ID.
 * Updates the selectedTripId in bot state.
 */
export const selectTrip = new Action({
  name: "selectTrip",
  description: "Select a trip by its ID",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to select"),
  }),

  output: z.object({
    success: z.boolean(),
    selectedTripId: z.string().nullable(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      // Verify trip exists
      const result = await tripsTable.findRows({
        filter: { id: { $eq: Number(input.tripId) } },
      });

      if (result.rows.length === 0) {
        return {
          success: false,
          selectedTripId: bot.state.selectedTripId,
          error: `Trip with ID ${input.tripId} not found`,
        };
      }

      // Update bot state
      bot.state.selectedTripId = input.tripId;

      // Emit state update to frontend
      await emitStateUpdate();

      return {
        success: true,
        selectedTripId: input.tripId,
      };
    } catch (error) {
      return {
        success: false,
        selectedTripId: bot.state.selectedTripId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Update a trip.
 * Updates the table row and bot state.
 */
export const updateTrip = new Action({
  name: "updateTrip",
  description: "Update an existing trip",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to update"),
    name: z.string().optional().describe("New trip name"),
    description: z.string().optional().describe("New description"),
    centerLatitude: z.number().optional().describe("New center latitude"),
    centerLongitude: z.number().optional().describe("New center longitude"),
    zoomLevel: z.number().optional().describe("New zoom level"),
  }),

  output: z.object({
    success: z.boolean(),
    trip: z
      .object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        centerLatitude: z.number(),
        centerLongitude: z.number(),
        zoomLevel: z.number(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .optional(),
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

      const currentRow = current.rows[0];

      // Build update object (only include defined values)
      const updateData: Record<string, unknown> = { id: Number(tripId) };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.centerLatitude !== undefined) updateData.centerLatitude = updates.centerLatitude;
      if (updates.centerLongitude !== undefined) updateData.centerLongitude = updates.centerLongitude;
      if (updates.zoomLevel !== undefined) updateData.zoomLevel = updates.zoomLevel;

      // Update in table
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

      // Update bot state
      bot.state.trips = bot.state.trips.map((t) => (t.id === tripId ? trip : t));

      // Emit state update to frontend
      await emitStateUpdate();

      return {
        success: true,
        trip,
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
 * Delete a trip.
 * Removes from table and clears selection if needed.
 */
export const deleteTrip = new Action({
  name: "deleteTrip",
  description: "Delete a trip by its ID",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to delete"),
  }),

  output: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      // Delete from table
      await tripsTable.deleteRows({
        filter: { id: { $eq: Number(input.tripId) } },
      });

      // Update bot state - remove the trip
      bot.state.trips = bot.state.trips.filter((t) => t.id !== input.tripId);

      // Clear selection if the deleted trip was selected
      if (bot.state.selectedTripId === input.tripId) {
        bot.state.selectedTripId = null;
      }

      // Also remove places associated with this trip
      bot.state.places = bot.state.places.filter((p) => p.tripId !== input.tripId);

      // Emit state update to frontend
      await emitStateUpdate();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
