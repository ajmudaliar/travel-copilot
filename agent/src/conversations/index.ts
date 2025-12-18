import { Conversation, bot, z } from "@botpress/runtime";
import { tripTools } from "../tools/trips";

/**
 * Main chat conversation handler for the travel copilot.
 * Handles webchat messages and provides AI-powered travel planning assistance.
 */
export const Chat = new Conversation({
  channel: "webchat.channel",

  // Per-conversation state
  state: z.object({
    messageCount: z.number().default(0),
    lastIntent: z.string().optional(),
  }),

  async handler({ message, state, conversation, execute }) {
    // Track message count
    state.messageCount += 1;

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
        const tripCount = bot.state.trips.length;
        const selectedTrip = bot.state.trips.find(
          (t) => t.id === bot.state.selectedTripId
        );
        await conversation.send({
          type: "text",
          payload: {
            text: `Travel Copilot Status:\n- Messages in session: ${state.messageCount}\n- Total trips: ${tripCount}\n- Selected trip: ${selectedTrip?.name || "None"}\n- Connection: Active`,
          },
        });
        return;
      }
    }

    // Build current state context for the AI
    const tripCount = bot.state.trips.length;
    const selectedTrip = bot.state.trips.find(
      (t) => t.id === bot.state.selectedTripId
    );
    const tripListSummary =
      tripCount > 0
        ? bot.state.trips.map((t) => `- ${t.name} (ID: ${t.id})`).join("\n")
        : "No trips yet";

    // Use AI to handle the message with trip tools
    await execute({
      instructions: `You are a helpful travel planning assistant called Travel Copilot.

## Your capabilities:
- Create trips for users (e.g., "Create a trip to Paris")
- List all trips
- Select a trip to work with
- Update trip details (name, description, location)
- Delete trips (ask for confirmation first)

## Current state:
- Message #${state.messageCount} in this conversation
- Total trips: ${tripCount}
- Selected trip: ${selectedTrip ? `"${selectedTrip.name}" (ID: ${selectedTrip.id})` : "None"}

## Existing trips:
${tripListSummary}

## Guidelines:
1. When users want to create a trip, use the createTrip tool with a descriptive name
2. For location-based trips (like "Paris"), try to set appropriate coordinates:
   - Paris: 48.8566, 2.3522
   - New York: 40.7128, -74.0060
   - London: 51.5074, -0.1278
   - Tokyo: 35.6762, 139.6503
   - Use reasonable defaults for other locations
3. When listing trips, format them nicely for the user
4. Before deleting a trip, confirm with the user
5. Keep responses concise and helpful
6. After creating or modifying trips, summarize what was done

Be friendly and conversational while helping users plan their travels!`,
      tools: tripTools,
    });
  },
});

// Note: Don't use default export to avoid duplicate registration
