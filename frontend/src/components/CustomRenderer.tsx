import { useEffect, useRef } from "react";
import type { FC } from "react";
import type { BlockObjects } from "@botpress/webchat";
import { useTravelStore } from "../stores/travelStore";
import { useTripData } from "../hooks/useTripData";

// Notification types from bot
type UINotification =
  | { type: "refresh_trips"; userId: string }
  | { type: "select_trip"; tripId: string }
  | { type: "pan_to"; lat: number; lng: number; zoom?: number }
  | { type: "refresh_places"; tripId: string };

/**
 * Custom renderer for handling UI notifications from the bot.
 * Notifications trigger actions like refreshing data from tables.
 */
const CustomRenderer: FC<BlockObjects["custom"]> = (props) => {
  const selectTrip = useTravelStore((state) => state.selectTrip);
  const { fetchTrips, fetchPlaces } = useTripData();
  const processedRef = useRef<string | null>(null);

  const url = props.url || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (props as any).data as UINotification | undefined;
  const messageId = (props as { messageId?: string }).messageId;

  useEffect(() => {
    // Only process each message once
    if (!data || messageId === processedRef.current) return;
    if (url !== "custom://travel-notification") return;

    processedRef.current = messageId ?? null;

    switch (data.type) {
      case "refresh_trips":
        fetchTrips(data.userId);
        break;

      case "select_trip":
        selectTrip(data.tripId);
        fetchPlaces(data.tripId);
        break;

      case "pan_to":
        // TODO: Implement map panning via store or event
        break;

      case "refresh_places":
        fetchPlaces(data.tripId);
        break;
    }
  }, [url, data, messageId, fetchTrips, fetchPlaces, selectTrip]);

  // Never render anything - these are control messages
  return null;
};

export default CustomRenderer;
