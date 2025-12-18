import type { Trip } from "../types";
import { useTravelStore } from "../stores/travelStore";
import "./TripCard.css";

interface TripCardProps {
  trip: Trip;
}

export function TripCard({ trip }: TripCardProps) {
  const selectedTripId = useTravelStore((state) => state.selectedTripId);
  const isSelected = selectedTripId === trip.id;

  return (
    <div className={`trip-row ${isSelected ? "trip-row--selected" : ""}`}>
      <span className="trip-row__name">{trip.name}</span>
      {isSelected && <span className="trip-row__dot" />}
    </div>
  );
}
