import { Table, z } from "@botpress/runtime";

/**
 * Places table - stores places within trips.
 * Each place belongs to a trip and has location data.
 */
export const placesTable = new Table({
  name: "placesTable",
  columns: {
    tripId: z.string().describe("ID of the trip this place belongs to"),
    name: z.string().describe("Place name"),
    address: z.string().describe("Place address"),
    latitude: z.number().describe("Place latitude"),
    longitude: z.number().describe("Place longitude"),
    rating: z.number().optional().describe("Place rating (0-5)"),
    description: z.string().optional().describe("Place description"),
    category: z.string().optional().describe("Category: restaurant, hotel, attraction, cafe, etc."),
    photoUrl: z.string().optional().describe("Photo URL from Google Places"),
  },
});
