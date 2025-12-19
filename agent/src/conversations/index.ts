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
      instructions: `You are Travel Copilot, a friendly travel planning assistant.

## Context
- Selected trip: ${selectedTrip ? `"${selectedTrip.name}" (ID: ${selectedTrip.id})` : "None"}
- User's trips: ${tripCount === 0 ? "None yet" : trips.map((t) => `${t.name} (ID: ${t.id})`).join(", ")}
${selectedTrip && places.length > 0 ? `- Places in trip: ${places.map((p) => p.name).join(", ")}` : ""}

## What you can do
- **Trips**: Create, list, select, update, delete trips
- **Places**: Search for places, add them to trips, list/remove places

## Key behaviors
1. **Creating trips**: Use createTrip with the city name. Set coordinates (e.g., Paris: 48.8566, 2.3522; NYC: 40.7128, -74.0060; SF: 37.7749, -122.4194). Estimate for other cities.

2. **Deleting trips**: Confirm with user first.

3. **Adding places**: Use tripId: ${selectedTrip?.id || "none"}. If no trip selected, ask user to select one first.

## IMPORTANT
- Use markdown for formatting (e.g., **bold**, *italic*), NOT HTML tags.
- When searching for places with searchPlaces, DO NOT list or describe the results in your response. The results are automatically displayed as interactive cards in the UI. Just say something brief like "Here are some options:".
- CRITICAL: When adding places that were just shown in search results, use the place data from those results. DO NOT search again - you already have the info. Only search for new things.

Keep responses concise. Only call each tool once per response.`,
      tools: [...tripTools, ...placeTools],
    });
  },
});

// Note: Don't use default export to avoid duplicate registration
