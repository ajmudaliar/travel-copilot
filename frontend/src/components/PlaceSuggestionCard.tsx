import { useState } from "react";
import { PlaceDataProvider, PlaceOverview } from "@googlemaps/extended-component-library/react";
import { useTravelStore } from "../stores/travelStore";
import { useTripData } from "../hooks/useTripData";
import "./PlaceSuggestionCard.css";

// Place data from the bot
export interface PlaceSuggestion {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  category: string;
}

interface PlaceSuggestionCardProps {
  place: PlaceSuggestion;
  tripId: string | null;
}

// Category icons for fallback display
const CATEGORY_ICONS: Record<string, string> = {
  restaurant: "🍴",
  cafe: "☕",
  hotel: "🏨",
  attraction: "📸",
  default: "📍",
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export function PlaceSuggestionCard({ place, tripId }: PlaceSuggestionCardProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const panMapTo = useTravelStore((state) => state.panMapTo);
  const setPreviewPlace = useTravelStore((state) => state.setPreviewPlace);
  const { fetchPlaces, addPlaceToTrip } = useTripData();

  const handleShowOnMap = () => {
    // Set preview marker and pan to location
    setPreviewPlace({
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.category,
    });
    panMapTo(place.latitude, place.longitude, 16);
  };

  const handleOpenGoogleMaps = () => {
    const url = place.placeId
      ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`;
    window.open(url, '_blank');
  };

  const handleAddToTrip = async () => {
    if (!tripId || isAdded || isAdding) return;

    setIsAdding(true);
    try {
      const result = await addPlaceToTrip({
        tripId,
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        rating: place.rating,
        category: place.category,
      });

      if (result.success) {
        setIsAdded(true);
        // Refresh places in the trip panel
        fetchPlaces(tripId);
      } else {
        console.error("Failed to add place:", result.error);
      }
    } catch (error) {
      console.error("Error adding place:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const categoryIcon = CATEGORY_ICONS[place.category] || CATEGORY_ICONS.default;
  const hasGooglePlaceId = place.placeId && GOOGLE_MAPS_API_KEY;

  return (
    <div className="place-suggestion-card">
      {/* Place Content */}
      <div className="place-suggestion-card__content">
        {hasGooglePlaceId ? (
          <PlaceDataProvider place={place.placeId}>
            <PlaceOverview size="medium" googleLogoAlreadyDisplayed />
          </PlaceDataProvider>
        ) : (
          <div className="place-suggestion-card__fallback">
            <div className="place-suggestion-card__header">
              <span className="place-suggestion-card__icon">{categoryIcon}</span>
              <div className="place-suggestion-card__info">
                <h4 className="place-suggestion-card__name">{place.name}</h4>
                <span className="place-suggestion-card__category">{place.category}</span>
              </div>
              {place.rating > 0 && (
                <div className="place-suggestion-card__rating">
                  <span className="place-suggestion-card__star">⭐</span>
                  <span>{place.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <p className="place-suggestion-card__address">{place.address}</p>
          </div>
        )}
      </div>

      {/* Action Buttons - Right Side */}
      <div className="place-suggestion-card__actions">
        <button
          className="place-suggestion-card__btn"
          onClick={handleShowOnMap}
          title="Show on map"
        >
          📍
        </button>
        <button
          className="place-suggestion-card__btn"
          onClick={handleOpenGoogleMaps}
          title="Open in Google Maps"
        >
          ↗
        </button>
        <button
          className={`place-suggestion-card__btn place-suggestion-card__btn--add ${
            isAdded ? "place-suggestion-card__btn--added" : ""
          }`}
          onClick={handleAddToTrip}
          disabled={!tripId || isAdded || isAdding}
          title={!tripId ? "Select a trip first" : isAdded ? "Added" : "Add to trip"}
        >
          {isAdding ? "..." : isAdded ? "✓" : "+"}
        </button>
      </div>
    </div>
  );
}
