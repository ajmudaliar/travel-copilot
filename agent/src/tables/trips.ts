import { Table, z } from "@botpress/runtime";

/**
 * Trips table - stores user trips with map view configuration.
 *
 * Note: `id`, `createdAt`, `updatedAt` are reserved columns and auto-generated.
 * Table names must end with "Table".
 */
export const tripsTable = new Table({
  name: "tripsTable",
  columns: {
    userId: z.string().describe("Owner user ID"),
    name: z.string().describe("Trip name"),
    description: z.string().optional().describe("Trip description"),
    centerLatitude: z.number().describe("Center latitude for map view"),
    centerLongitude: z.number().describe("Center longitude for map view"),
    zoomLevel: z.number().default(13).describe("Map zoom level"),
  },
});
