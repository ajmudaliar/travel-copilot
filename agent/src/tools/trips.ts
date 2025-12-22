import { Autonomous, z } from "@botpress/runtime";
import { tripsTable } from "../tables/trips";
import { placesTable } from "../tables/places";
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

      // Check if trip with same name already exists for this user
      const existing = await tripsTable.findRows({
        filter: { userId: { $eq: userId }, name: { $eq: input.name } },
        limit: 1,
      });

      if (existing.rows.length > 0) {
        const existingTrip = existing.rows[0];
        return {
          success: true,
          tripId: String(existingTrip.id),
          tripName: existingTrip.name,
        };
      }

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

  input: z.object({
    limit: z.number().optional().describe("Max results (default 50)"),
    offset: z.number().optional().describe("Skip first N results"),
  }),

  output: z.object({
    trips: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })
    ),
    count: z.number(),
    hasMore: z.boolean(),
  }),

  async handler(input) {
    try {
      const userId = getCurrentUserId();
      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;

      // Get owned trips
      const ownedResult = await tripsTable.findRows({
        filter: { userId: { $eq: userId } },
        limit: limit + 1,
        offset,
      });

      // Get shared trips where user is a collaborator
      // Note: We fetch all and filter client-side since array contains isn't directly supported
      const sharedResult = await tripsTable.findRows({
        filter: { isShared: { $eq: true } },
        limit: 100,
      });

      const collaboratorTrips = sharedResult.rows.filter(
        (row) => row.collaborators?.includes(userId) && row.userId !== userId
      );

      // Combine and dedupe
      const allTrips = [...ownedResult.rows, ...collaboratorTrips];
      const seen = new Set<number>();
      const uniqueTrips = allTrips.filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });

      const hasMore = uniqueTrips.length > limit;
      const rows = hasMore ? uniqueTrips.slice(0, limit) : uniqueTrips;

      const trips = rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        description: row.description,
      }));

      // Notify frontend to refresh
      await notifyRefreshTrips();

      return {
        trips,
        count: trips.length,
        hasMore,
      };
    } catch (error) {
      console.error("Error listing trips:", error);
      return { trips: [], count: 0, hasMore: false };
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

      // Delete associated places first
      const placesResult = await placesTable.findRows({
        filter: { tripId: { $eq: input.tripId } },
      });

      if (placesResult.rows.length > 0) {
        const placeIds = placesResult.rows.map((p) => p.id);
        await placesTable.deleteRowIds(placeIds);
      }

      // Delete the trip
      await tripsTable.deleteRowIds([Number(input.tripId)]);

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

/**
 * Generate a unique 6-character share code
 */
function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars like 0/O, 1/I/L
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Share a trip and get a share code
 */
export const shareTripTool = new Autonomous.Tool({
  name: "shareTrip",
  description: "Share a trip with others. Generates a share code that others can use to view or collaborate on the trip.",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to share"),
    permission: z.enum(["view", "edit"]).default("view").describe("Permission level: 'view' (read-only) or 'edit' (can add places)"),
  }),

  output: z.object({
    success: z.boolean(),
    shareCode: z.string().optional(),
    shareUrl: z.string().optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      const userId = getCurrentUserId();

      // Verify trip exists and user owns it
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
      if (trip.userId !== userId) {
        return {
          success: false,
          error: "You can only share trips you own",
        };
      }

      // Generate share code if not already shared
      let shareCode = trip.shareCode;
      if (!shareCode) {
        shareCode = generateShareCode();
      }

      // Update trip with sharing info
      await tripsTable.updateRows({
        rows: [
          {
            id: Number(input.tripId),
            shareCode,
            isShared: true,
            sharePermission: input.permission,
          },
        ],
      });

      await notifyRefreshTrips();

      return {
        success: true,
        shareCode,
        shareUrl: `Share code: ${shareCode}`,
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
 * Stop sharing a trip
 */
export const unshareTrip = new Autonomous.Tool({
  name: "unshareTrip",
  description: "Stop sharing a trip. Revokes access for all collaborators.",

  input: z.object({
    tripId: z.string().describe("The ID of the trip to stop sharing"),
  }),

  output: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      const userId = getCurrentUserId();

      // Verify ownership
      const result = await tripsTable.findRows({
        filter: { id: { $eq: Number(input.tripId) } },
      });

      if (result.rows.length === 0) {
        return { success: false, error: "Trip not found" };
      }

      const trip = result.rows[0];
      if (trip.userId !== userId) {
        return { success: false, error: "You can only unshare trips you own" };
      }

      await tripsTable.updateRows({
        rows: [
          {
            id: Number(input.tripId),
            isShared: false,
            shareCode: undefined,
            collaborators: [],
          },
        ],
      });

      await notifyRefreshTrips();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Join a shared trip using a share code
 */
export const joinTripTool = new Autonomous.Tool({
  name: "joinTrip",
  description: "Join a shared trip using a share code. This adds the trip to your trip list.",

  input: z.object({
    shareCode: z.string().describe("The 6-character share code"),
  }),

  output: z.object({
    success: z.boolean(),
    tripId: z.string().optional(),
    tripName: z.string().optional(),
    permission: z.string().optional(),
    error: z.string().optional(),
  }),

  async handler(input) {
    try {
      const userId = getCurrentUserId();
      const code = input.shareCode.toUpperCase().trim();

      // Find trip by share code
      const result = await tripsTable.findRows({
        filter: {
          shareCode: { $eq: code },
          isShared: { $eq: true },
        },
      });

      if (result.rows.length === 0) {
        return {
          success: false,
          error: "Invalid or expired share code",
        };
      }

      const trip = result.rows[0];

      // Check if user already has access
      if (trip.userId === userId) {
        return {
          success: true,
          tripId: String(trip.id),
          tripName: trip.name,
          permission: "owner",
        };
      }

      const collaborators = trip.collaborators || [];
      if (collaborators.includes(userId)) {
        return {
          success: true,
          tripId: String(trip.id),
          tripName: trip.name,
          permission: trip.sharePermission,
        };
      }

      // Add user as collaborator
      await tripsTable.updateRows({
        rows: [
          {
            id: trip.id,
            collaborators: [...collaborators, userId],
          },
        ],
      });

      await notifyRefreshTrips();
      await notifySelectTrip(String(trip.id));

      return {
        success: true,
        tripId: String(trip.id),
        tripName: trip.name,
        permission: trip.sharePermission,
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
  shareTripTool,
  unshareTrip,
  joinTripTool,
];
