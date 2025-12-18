import { useCallback } from "react";
import { Client } from "@botpress/client";
import { useTravelStore } from "../stores/travelStore";

const BOT_ID = import.meta.env.VITE_BOT_ID || "";
const TOKEN = import.meta.env.VITE_BOTPRESS_TOKEN || "";

let client: Client | null = null;

function getClient() {
  if (!client && BOT_ID && TOKEN) {
    client = new Client({ botId: BOT_ID, token: TOKEN });
  }
  return client;
}

export function useTripData() {
  const setTrips = useTravelStore((state) => state.setTrips);
  const selectTrip = useTravelStore((state) => state.selectTrip);

  const fetchTrips = useCallback(async (userId?: string) => {
    const bpClient = getClient();
    if (!bpClient || !userId) {
      return;
    }

    try {
      const result = await bpClient.findTableRows({
        table: "tripsTable",
        filter: { userId: { $eq: userId } },
        limit: 100,
        orderBy: "createdAt",
        orderDirection: "desc",
      });

      const trips = result.rows.map((row) => ({
        id: String(row.id),
        name: row.name as string,
        description: row.description as string | undefined,
        centerLatitude: row.centerLatitude as number,
        centerLongitude: row.centerLongitude as number,
        zoomLevel: row.zoomLevel as number,
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: row.updatedAt || new Date().toISOString(),
      }));

      setTrips(trips);

      // Auto-select first trip if none selected
      if (trips.length > 0) {
        const currentSelected = useTravelStore.getState().selectedTripId;
        if (!currentSelected) {
          selectTrip(trips[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch trips:", error);
    }
  }, [setTrips, selectTrip]);

  return { fetchTrips };
}
