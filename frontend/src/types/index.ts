/**
 * Core data types for the Travel Copilot application.
 * These mirror the schemas defined in the ADK agent.
 */

export interface Trip {
  id: string;
  name: string;
  description?: string;
  centerLatitude: number;
  centerLongitude: number;
  zoomLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface Place {
  id: string;
  tripId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  description?: string;
  category?: string;
  createdAt: string;
}

export interface TravelState {
  trips: Trip[];
  selectedTripId: string | null;
  places: Place[];
  isSearching: boolean;
  searchResults: Place[];
}

export interface WebchatConfig {
  clientId: string;
  apiUrl?: string;
}
