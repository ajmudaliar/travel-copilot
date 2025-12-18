import { context } from "@botpress/runtime";
import { getCurrentUserId } from "./context";

/**
 * UI notification utilities for messaging between bot and frontend.
 *
 * The frontend listens for custom messages and reacts accordingly:
 * - refresh_trips: Reload trips from table for the user
 * - select_trip: Select and pan to a specific trip
 * - pan_to: Pan map to coordinates
 */

// Message types for bot -> frontend communication
export type UINotification =
  | { type: "refresh_trips"; userId: string }
  | { type: "select_trip"; tripId: string }
  | { type: "pan_to"; lat: number; lng: number; zoom?: number }
  | { type: "refresh_places"; tripId: string };

/**
 * Send a notification to the frontend via custom message.
 */
async function sendNotification(notification: UINotification): Promise<void> {
  try {
    const client = context.get("client");
    const conversation = context.get("conversation");
    const botId = context.get("botId");

    if (!client || !conversation) {
      console.warn("No client/conversation context available");
      return;
    }

    await client.createMessage({
      conversationId: conversation.id,
      userId: botId,
      type: "custom",
      payload: {
        name: "travel_ui_notification",
        url: "custom://travel-notification",
        data: notification,
      },
      tags: {},
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}

/**
 * Notify frontend to refresh trips from table for current user
 */
export async function notifyRefreshTrips(): Promise<void> {
  const userId = getCurrentUserId();
  await sendNotification({ type: "refresh_trips", userId });
}

/**
 * Notify frontend to select and pan to a trip
 */
export async function notifySelectTrip(tripId: string): Promise<void> {
  await sendNotification({ type: "select_trip", tripId });
}

/**
 * Notify frontend to pan map to coordinates
 */
export async function notifyPanTo(lat: number, lng: number, zoom?: number): Promise<void> {
  await sendNotification({ type: "pan_to", lat, lng, zoom });
}

/**
 * Notify frontend to refresh places for a trip
 */
export async function notifyRefreshPlaces(tripId: string): Promise<void> {
  await sendNotification({ type: "refresh_places", tripId });
}
