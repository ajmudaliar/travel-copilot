import { Conversation, z, user } from "@botpress/runtime";
import { tripTools } from "../tools/trips";
import { placeTools } from "../tools/places";
import { tripsTable } from "../tables/trips";
import { placesTable } from "../tables/places";
import { notifyRefreshTrips } from "../utils/stateSync";
import { getCurrentUserId } from "../utils/context";

/**
 * Main chat conversation handler for the travel copilot.
 * Handles webchat messages and provides AI-powered travel planning assistance.
 */
export const Chat = new Conversation({
  channel: "webchat.channel",

  // Per-conversation state
  state: z.object({
    messageCount: z.number().default(0),
  }),

  async handler({ message, state, conversation, execute }) {
    // Track message count
    state.messageCount += 1;

    // Notify frontend to refresh on first message
    if (state.messageCount === 1) {
      await notifyRefreshTrips();
    }

    // Query trips from table for context (filtered by user)
    const userId = getCurrentUserId();
    const tripsResult = await tripsTable.findRows({
      filter: { userId: { $eq: userId } },
    });
    const trips = tripsResult.rows;
    const tripCount = trips.length;

    // Find selected trip from user state (persists across conversations)
    const selectedTripId = user.state.selectedTripId;
    const selectedTrip = selectedTripId
      ? trips.find((t) => String(t.id) === selectedTripId)
      : undefined;

    // Query places for selected trip
    let places: typeof placesTable.inferRow[] = [];
    if (selectedTrip) {
      const placesResult = await placesTable.findRows({
        filter: { tripId: { $eq: String(selectedTrip.id) } },
      });
      places = placesResult.rows;
    }

    // Handle text messages
    if (message?.type === "text") {
      const text = message.payload.text?.trim() || "";

      // Command handling for debugging
      if (text.toLowerCase() === "/ping") {
        await conversation.send({
          type: "text",
          payload: { text: "Pong! The travel copilot is running." },
        });
        return;
      }

      if (text.toLowerCase() === "/status") {
        await conversation.send({
          type: "text",
          payload: {
            text: `Travel Copilot Status:\n- Messages in session: ${state.messageCount}\n- Total trips: ${tripCount}\n- Selected trip: ${selectedTrip?.name || "None"}\n- Connection: Active`,
          },
        });
        return;
      }
    }

    // Build trip list summary for AI context
    const tripListSummary =
      tripCount > 0
        ? trips.map((t) => `- ${t.name} (ID: ${t.id})`).join("\n")
        : "No trips yet";

    // Build places summary for selected trip
    const placesSummary =
      places.length > 0
        ? places.map((p) => `- ${p.name} (${p.category || "place"}, ID: ${p.id})`).join("\n")
        : "No places added yet";

    // Use AI to handle the message with trip and place tools
    await execute({
      hooks: {
        onAfterTool: async ({ tool, input, output }) => {
          // Update user state when selectTrip or createTrip is called
          if (tool.name === "selectTrip" && output?.success && input?.tripId) {
            user.state.selectedTripId = String(input.tripId);
          }
          if (tool.name === "createTrip" && output?.success && output?.tripId) {
            user.state.selectedTripId = output.tripId;
          }
        },
      },
      instructions: `You are a helpful travel planning assistant called Travel Copilot.

## Your capabilities:
**Trip Management:**
- Create trips for users (e.g., "Create a trip to Paris")
- List all trips
- Select a trip to work with
- Update trip details (name, description, location)
- Delete trips (ask for confirmation first)

**Place Management:**
- Search for places (restaurants, cafes, hotels, attractions)
- Add places to the selected trip
- List places in a trip
- Remove places from a trip

## Current state:
- Message #${state.messageCount} in this conversation
- Total trips: ${tripCount}
- Selected trip: ${selectedTrip ? `"${selectedTrip.name}" (ID: ${selectedTrip.id})` : "None"}
- Places in selected trip: ${places.length}

## Existing trips:
${tripListSummary}

## Places in selected trip:
${selectedTrip ? placesSummary : "Select a trip first to see places"}

## Guidelines:
1. When users want to create a trip, use the createTrip tool with a descriptive name
2. IMPORTANT: Always set appropriate coordinates for the destination. Common locations:
   - Paris: 48.8566, 2.3522
   - New York: 40.7128, -74.0060
   - London: 51.5074, -0.1278
   - Tokyo: 35.6762, 139.6503
   - Montreal: 45.5017, -73.5673
   - Toronto: 43.6532, -79.3832
   - Los Angeles: 34.0522, -118.2437
   - San Francisco: 37.7749, -122.4194
   - Sydney: -33.8688, 151.2093
   - Dubai: 25.2048, 55.2708
   - Singapore: 1.3521, 103.8198
   - India/Delhi: 28.6139, 77.2090
   - Mumbai: 19.0760, 72.8777
   - Rome: 41.9028, 12.4964
   - Barcelona: 41.3851, 2.1734
   - Amsterdam: 52.3676, 4.9041
   - Berlin: 52.5200, 13.4050
   - For other cities, estimate reasonable lat/lng based on the region
3. When listing trips, format them nicely for the user
4. Before deleting a trip, confirm with the user
5. Keep responses concise and helpful
6. After creating or modifying trips, summarize what was done
7. IMPORTANT: Use markdown for formatting (e.g., **bold**, *italic*), NOT HTML tags
8. IMPORTANT: When searching for places with searchPlaces, DO NOT list or describe the results in your response. The results are automatically displayed as interactive cards in the UI. Just say something brief like "Here are some options:" or "I found these places for you."
9. IMPORTANT: When adding a place, use the tripId from the "Selected trip" info above. The selected trip ID is: ${selectedTrip?.id || "none"}
10. When adding a place from search results, use the exact coordinates from the search result

Be friendly and conversational while helping users plan their travels!`,
      tools: [...tripTools, ...placeTools],
    });
  },
});

// Note: Don't use default export to avoid duplicate registration
