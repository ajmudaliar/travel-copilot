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
  const setPlaces = useTravelStore((state) => state.setPlaces);
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
      // Selection is restored from server state via restoreUserState()
    } catch (error) {
      console.error("Failed to fetch trips:", error);
    }
  }, [setTrips]);

  const fetchPlaces = useCallback(async (tripId: string) => {
    const bpClient = getClient();
    if (!bpClient || !tripId) {
      return;
    }

    try {
      const result = await bpClient.findTableRows({
        table: "placesTable",
        filter: { tripId: { $eq: tripId } },
        limit: 100,
        orderBy: "createdAt",
        orderDirection: "desc",
      });

      const places = result.rows.map((row) => ({
        id: String(row.id),
        tripId: row.tripId as string,
        name: row.name as string,
        address: row.address as string,
        latitude: row.latitude as number,
        longitude: row.longitude as number,
        rating: row.rating as number | undefined,
        description: row.description as string | undefined,
        category: row.category as string | undefined,
        photoUrl: row.photoUrl as string | undefined,
        createdAt: row.createdAt || new Date().toISOString(),
      }));

      setPlaces(places);
    } catch (error) {
      console.error("Failed to fetch places:", error);
    }
  }, [setPlaces]);

  /**
   * Fetch user state from server and restore selected trip + places.
   * Call this on initial load to sync state from server.
   */
  const restoreUserState = useCallback(async (userId: string) => {
    const bpClient = getClient();
    if (!bpClient || !userId) {
      return;
    }

    try {
      const result = await bpClient.getState({
        type: "user",
        id: userId,
        name: "userState",
      });

      // The payload structure is { value: { selectedTripId, ... } }
      const payload = result.state?.payload;
      const selectedTripId = payload?.value?.selectedTripId || payload?.selectedTripId;

      if (selectedTripId) {
        selectTrip(selectedTripId);
        await fetchPlaces(selectedTripId);
      }
    } catch {
      // State might not exist yet, that's OK for new users
    }
  }, [selectTrip, fetchPlaces]);

  /**
   * Add a place to a trip by calling the bot action.
   */
  const addPlaceToTrip = useCallback(async (input: {
    tripId: string;
    placeId?: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    rating?: number;
    category?: string;
    photoUrl?: string;
  }): Promise<{ success: boolean; placeId?: string; error?: string }> => {
    const bpClient = getClient();
    if (!bpClient) {
      return { success: false, error: "Client not initialized" };
    }

    try {
      const result = await bpClient.callAction({
        type: "addPlaceToTrip",
        input,
      });

      const output = result.output as { success: boolean; placeId?: string; error?: string };
      return output;
    } catch (error) {
      console.error("Failed to add place:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }, []);

  return { fetchTrips, fetchPlaces, restoreUserState, addPlaceToTrip };
}
