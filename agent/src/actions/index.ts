import { Action, bot, z } from "@botpress/runtime";

/**
 * Simple ping action to verify the agent is working.
 * Can be called from conversations or externally via API.
 */
export const ping = new Action({
  name: "ping",
  description: "Simple health check that returns a pong response",

  input: z.object({
    message: z.string().optional().describe("Optional message to echo back"),
  }),

  output: z.object({
    status: z.string(),
    message: z.string(),
    timestamp: z.string(),
  }),

  async handler(input) {
    return {
      status: "ok",
      message: input.message ? `Pong: ${input.message}` : "Pong!",
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Get the current travel state (trips and places).
 * This action retrieves the bot state for syncing with the frontend.
 */
export const getTravelState = new Action({
  name: "getTravelState",
  description: "Get the current travel state including trips and places",

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
    selectedTripId: z.string().nullable(),
    places: z.array(
      z.object({
        id: z.string(),
        tripId: z.string(),
        name: z.string(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        rating: z.number().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        createdAt: z.string(),
      })
    ),
  }),

  async handler(_input) {
    // Return current bot state
    return {
      trips: bot.state.trips,
      selectedTripId: bot.state.selectedTripId,
      places: bot.state.places,
    };
  },
});

// Note: Don't use default export to avoid duplicate registration
