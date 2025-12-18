import { create } from "zustand";
import type { Trip, Place, TravelState } from "../types";

interface TravelStore extends TravelState {
  // User info (for API calls)
  userId: string | null;
  setUserId: (userId: string | null) => void;

  // Actions
  setTrips: (trips: Trip[]) => void;
  addTrip: (trip: Trip) => void;
  updateTrip: (tripId: string, updates: Partial<Trip>) => void;
  removeTrip: (tripId: string) => void;
  selectTrip: (tripId: string | null) => void;

  setPlaces: (places: Place[]) => void;
  addPlace: (place: Place) => void;
  removePlace: (placeId: string) => void;

  setSearchResults: (results: Place[]) => void;
  setIsSearching: (isSearching: boolean) => void;

  // Computed
  getSelectedTrip: () => Trip | undefined;
  getPlacesForTrip: (tripId: string) => Place[];
}

export const useTravelStore = create<TravelStore>((set, get) => ({
  // Initial state
  userId: null,
  trips: [],
  selectedTripId: null,
  places: [],
  isSearching: false,
  searchResults: [],

  // User
  setUserId: (userId) => set({ userId }),

  // Trip actions
  setTrips: (trips) => set({ trips }),

  addTrip: (trip) =>
    set((state) => ({
      trips: [...state.trips, trip],
    })),

  updateTrip: (tripId, updates) =>
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    })),

  removeTrip: (tripId) =>
    set((state) => ({
      trips: state.trips.filter((t) => t.id !== tripId),
      // Also remove places for this trip
      places: state.places.filter((p) => p.tripId !== tripId),
      // Clear selection if this was the selected trip
      selectedTripId: state.selectedTripId === tripId ? null : state.selectedTripId,
    })),

  selectTrip: (tripId) => set({ selectedTripId: tripId }),

  // Place actions
  setPlaces: (places) => set({ places }),

  addPlace: (place) =>
    set((state) => ({
      places: [...state.places, place],
    })),

  removePlace: (placeId) =>
    set((state) => ({
      places: state.places.filter((p) => p.id !== placeId),
    })),

  // Search actions
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (isSearching) => set({ isSearching }),

  // Computed getters
  getSelectedTrip: () => {
    const state = get();
    return state.trips.find((t) => t.id === state.selectedTripId);
  },

  getPlacesForTrip: (tripId) => {
    const state = get();
    return state.places.filter((p) => p.tripId === tripId);
  },
}));
