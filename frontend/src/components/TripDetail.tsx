import { useState } from "react";
import type { Trip, Place } from "../types";
import "./TripDetail.css";

interface TripDetailProps {
  trip: Trip;
  places: Place[];
}

export function TripDetail({ trip, places }: TripDetailProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="trip-detail">
      <div className="trip-detail__header">
        <h4 className="trip-detail__name">{trip.name}</h4>
      </div>

      {trip.description && (
        <p className="trip-detail__description">{trip.description}</p>
      )}

      <button
        className="trip-detail__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="trip-detail__toggle-icon">
          {isExpanded ? "▼" : "▶"}
        </span>
        <span className="trip-detail__toggle-text">
          {places.length} {places.length === 1 ? "place" : "places"}
        </span>
      </button>

      {isExpanded && places.length > 0 && (
        <ul className="trip-detail__places">
          {places.map((place) => (
            <li key={place.id} className="trip-detail__place">
              <span className="trip-detail__place-name">{place.name}</span>
              {place.category && (
                <span className="trip-detail__place-category">
                  {place.category}
                </span>
              )}
              {place.rating && (
                <span className="trip-detail__place-rating">
                  {place.rating.toFixed(1)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {isExpanded && places.length === 0 && (
        <p className="trip-detail__no-places">
          No places yet. Ask me to search for restaurants, hotels, or attractions!
        </p>
      )}
    </div>
  );
}
