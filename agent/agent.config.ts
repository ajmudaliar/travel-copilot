import { z, defineConfig } from "@botpress/runtime";

// Trip schema
const TripSchema = z.object({
  id: z.string().describe("Unique trip identifier"),
  name: z.string().describe("Trip name"),
  description: z.string().optional().describe("Trip description"),
  centerLatitude: z.number().describe("Center latitude for map view"),
  centerLongitude: z.number().describe("Center longitude for map view"),
  zoomLevel: z.number().default(13).describe("Map zoom level"),
  createdAt: z.string().describe("Creation timestamp as ISO string"),
  updatedAt: z.string().describe("Last update timestamp as ISO string"),
});

// Place schema
const PlaceSchema = z.object({
  id: z.string().describe("Unique place identifier"),
  tripId: z.string().describe("Parent trip ID"),
  name: z.string().describe("Place name"),
  address: z.string().describe("Place address"),
  latitude: z.number().describe("Place latitude"),
  longitude: z.number().describe("Place longitude"),
  rating: z.number().optional().describe("Place rating (0-5)"),
  description: z.string().optional().describe("Place description"),
  category: z
    .string()
    .optional()
    .describe("Place category (restaurant, hotel, attraction, etc.)"),
  createdAt: z.string().describe("Creation timestamp as ISO string"),
});

export default defineConfig({
  name: "travel-copilot",
  description: "A conversational travel planning assistant",

  bot: {
    state: z.object({
      trips: z.array(TripSchema).default([]).describe("All trips"),
      selectedTripId: z
        .string()
        .nullable()
        .default(null)
        .describe("Currently selected trip ID"),
      places: z
        .array(PlaceSchema)
        .default([])
        .describe("All places across trips"),
    }),
  },

  user: {
    state: z.object({
      preferredLanguage: z
        .string()
        .default("en")
        .describe("User's preferred language"),
    }),
  },

  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
      chat: { version: "chat@0.7.4", enabled: true },
    },
  },
});
