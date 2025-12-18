import { bot, context } from "@botpress/runtime";

/**
 * State sync utilities for keeping the frontend in sync with bot state.
 *
 * The frontend listens for custom events to update its local state.
 */

export interface TravelStatePayload {
  trips: typeof bot.state.trips;
  selectedTripId: typeof bot.state.selectedTripId;
  places: typeof bot.state.places;
}

/**
 * Emit the current travel state to the frontend via custom event.
 * Call this after any state-modifying operation.
 */
export async function emitStateUpdate(): Promise<void> {
  try {
    const conversation = context.get("conversation");

    if (!conversation) {
      console.warn("No conversation context available for state sync");
      return;
    }

    const payload: TravelStatePayload = {
      trips: bot.state.trips,
      selectedTripId: bot.state.selectedTripId,
      places: bot.state.places,
    };

    // Emit custom event that frontend can listen for
    await conversation.send({
      type: "custom",
      payload: {
        type: "travel_state_update",
        data: payload,
      },
    });
  } catch (error) {
    console.error("Failed to emit state update:", error);
  }
}

/**
 * Get the current travel state.
 * Useful for tools that need to report state.
 */
export function getCurrentState(): TravelStatePayload {
  return {
    trips: bot.state.trips,
    selectedTripId: bot.state.selectedTripId,
    places: bot.state.places,
  };
}
