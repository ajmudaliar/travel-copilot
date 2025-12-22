import { Link2, Users } from "lucide-react";
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
      <span className="trip-row__name">
        {trip.name}
        {trip.isShared && (
          <span className="trip-row__shared-icon" title={trip.isOwner ? "Shared by you" : "Shared with you"}>
            {trip.isOwner ? <Link2 size={12} /> : <Users size={12} />}
          </span>
        )}
      </span>
      {isSelected && <span className="trip-row__dot" />}
    </div>
  );
}
