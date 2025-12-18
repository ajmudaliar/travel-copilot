import type { Trip } from "../types";
import { useTravelStore } from "../stores/travelStore";
import "./TripCard.css";

interface TripCardProps {
  trip: Trip;
}

export function TripCard({ trip }: TripCardProps) {
  const { selectedTripId, selectTrip, getPlacesForTrip } = useTravelStore();
  const isSelected = selectedTripId === trip.id;
  const places = getPlacesForTrip(trip.id);

  const handleClick = () => {
    selectTrip(isSelected ? null : trip.id);
  };

  // Format date nicely
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={`trip-card ${isSelected ? "trip-card--selected" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
    >
      <div className="trip-card__header">
        <h4 className="trip-card__name">{trip.name}</h4>
        {isSelected && <span className="trip-card__badge">Selected</span>}
      </div>

      {trip.description && (
        <p className="trip-card__description">{trip.description}</p>
      )}

      <div className="trip-card__meta">
        <span className="trip-card__places">
          {places.length} {places.length === 1 ? "place" : "places"}
        </span>
        <span className="trip-card__date">Created {formatDate(trip.createdAt)}</span>
      </div>
    </div>
  );
}
