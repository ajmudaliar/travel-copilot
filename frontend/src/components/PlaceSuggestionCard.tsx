import { useState } from "react";
import { ExternalLink, Plus, Check, UtensilsCrossed, Coffee, Hotel, MapPin, Camera } from "lucide-react";
import { useTravelStore } from "../stores/travelStore";
import { useTripData } from "../hooks/useTripData";
import "./PlaceSuggestionCard.css";

export interface PlaceSuggestion {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  category: string;
  photoUrl?: string;
}

interface PlaceSuggestionCardProps {
  place: PlaceSuggestion;
  tripId: string | null;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  restaurant: <UtensilsCrossed size={20} />,
  cafe: <Coffee size={20} />,
  hotel: <Hotel size={20} />,
  attraction: <Camera size={20} />,
  default: <MapPin size={20} />,
};

export function PlaceSuggestionCard({ place, tripId }: PlaceSuggestionCardProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const panMapTo = useTravelStore((state) => state.panMapTo);
  const setPreviewPlace = useTravelStore((state) => state.setPreviewPlace);
  const { fetchPlaces, addPlaceToTrip } = useTripData();

  // Show preview marker on hover (stays until user clicks map)
  const handleMouseEnter = () => {
    setPreviewPlace({
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.category,
      photoUrl: place.photoUrl,
      rating: place.rating,
    });
  };

  // Pan and zoom to location on click
  const handleCardClick = () => {
    setPreviewPlace({
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.category,
      photoUrl: place.photoUrl,
      rating: place.rating,
    });
    panMapTo(place.latitude, place.longitude, 16);
  };

  const handleOpenGoogleMaps = () => {
    const url = place.placeId
      ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.address)}`;
    window.open(url, "_blank");
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
        photoUrl: place.photoUrl,
      });

      if (result.success) {
        setIsAdded(true);
        fetchPlaces(tripId);
      }
    } catch (error) {
      console.error("Error adding place:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const placeholderIcon = CATEGORY_ICONS[place.category] || CATEGORY_ICONS.default;

  // Stop event propagation for action buttons
  const handleButtonClick = (e: React.MouseEvent, handler: () => void) => {
    e.stopPropagation();
    handler();
  };

  return (
    <div
      className="place-suggestion-card"
      onMouseEnter={handleMouseEnter}
      onClick={handleCardClick}
    >
      <div className="place-suggestion-card__photo">
        {place.photoUrl ? (
          <img src={place.photoUrl} alt={place.name} />
        ) : (
          <span className="place-suggestion-card__photo-placeholder">{placeholderIcon}</span>
        )}
      </div>

      <div className="place-suggestion-card__content">
        <h4 className="place-suggestion-card__name">{place.name}</h4>
        <div className="place-suggestion-card__meta">
          <span className="place-suggestion-card__category">{place.category}</span>
          {place.rating > 0 && (
            <span className="place-suggestion-card__rating">★ {place.rating.toFixed(1)}</span>
          )}
        </div>
        <p className="place-suggestion-card__address">{place.address}</p>
      </div>

      <div className="place-suggestion-card__actions">
        <button
          className="place-suggestion-card__btn"
          onClick={(e) => handleButtonClick(e, handleOpenGoogleMaps)}
          title="Open in Google Maps"
        >
          <ExternalLink size={14} />
        </button>
        <button
          className={`place-suggestion-card__btn place-suggestion-card__btn--add ${isAdded ? "place-suggestion-card__btn--added" : ""}`}
          onClick={(e) => handleButtonClick(e, handleAddToTrip)}
          disabled={!tripId || isAdded || isAdding}
          title={!tripId ? "Select a trip first" : isAdded ? "Added" : "Add to trip"}
        >
          {isAdded ? <Check size={14} /> : <Plus size={14} />}
        </button>
      </div>
    </div>
  );
}
