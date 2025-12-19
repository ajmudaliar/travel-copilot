import { useEffect, useRef, createContext, useContext } from "react";
import type { FC, ReactNode } from "react";
import type { BlockObjects } from "@botpress/webchat";
import { useTravelStore } from "../stores/travelStore";
import { useTripData } from "../hooks/useTripData";
import { PlaceSuggestionCard, type PlaceSuggestion } from "./PlaceSuggestionCard";

// Webchat client type for callAction
interface WebchatClient {
  callAction: (input: { type: string; input: Record<string, unknown> }) => Promise<{
    output: Record<string, unknown>;
  }>;
}

// Context to pass webchat client to custom renderers
const WebchatClientContext = createContext<WebchatClient | null>(null);

export function WebchatClientProvider({
  client,
  children,
}: {
  client: WebchatClient | null;
  children: ReactNode;
}) {
  return (
    <WebchatClientContext.Provider value={client}>
      {children}
    </WebchatClientContext.Provider>
  );
}

// Notification types from bot
type UINotification =
  | { type: "refresh_trips"; userId: string }
  | { type: "select_trip"; tripId: string }
  | { type: "pan_to"; lat: number; lng: number; zoom?: number }
  | { type: "refresh_places"; tripId: string };

// Place suggestions data from bot
interface PlaceSuggestionsData {
  type: "place_suggestions";
  places: PlaceSuggestion[];
  tripId: string | null;
}

/**
 * Custom renderer for handling UI notifications and place suggestions from the bot.
 */
const CustomRenderer: FC<BlockObjects["custom"]> = (props) => {
  const client = useContext(WebchatClientContext);
  const selectTrip = useTravelStore((state) => state.selectTrip);
  const panMapTo = useTravelStore((state) => state.panMapTo);
  const { fetchTrips, fetchPlaces } = useTripData();
  const processedRef = useRef<string | null>(null);

  const url = props.url || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (props as any).data as UINotification | PlaceSuggestionsData | undefined;
  const messageId = (props as { messageId?: string }).messageId;

  // Handle UI notifications (side effects)
  useEffect(() => {
    if (!data || messageId === processedRef.current) return;
    if (url !== "custom://travel-notification") return;

    processedRef.current = messageId ?? null;

    const notification = data as UINotification;
    switch (notification.type) {
      case "refresh_trips":
        fetchTrips(notification.userId);
        break;

      case "select_trip":
        selectTrip(notification.tripId);
        fetchPlaces(notification.tripId);
        break;

      case "pan_to":
        panMapTo(notification.lat, notification.lng, notification.zoom);
        break;

      case "refresh_places":
        fetchPlaces(notification.tripId);
        break;
    }
  }, [url, data, messageId, fetchTrips, fetchPlaces, selectTrip, panMapTo]);

  // Render place suggestions
  if (url === "custom://place-suggestions" && data && "places" in data) {
    const suggestionsData = data as PlaceSuggestionsData;
    return (
      <div className="place-suggestions-container">
        {suggestionsData.places.map((place, index) => (
          <PlaceSuggestionCard
            key={`${place.placeId || place.name}-${index}`}
            place={place}
            tripId={suggestionsData.tripId}
            client={client}
          />
        ))}
      </div>
    );
  }

  // Notifications don't render anything
  return null;
};

export default CustomRenderer;
