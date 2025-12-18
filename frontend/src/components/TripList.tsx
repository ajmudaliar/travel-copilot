import { useTravelStore } from "../stores/travelStore";
import { TripCard } from "./TripCard";
import "./TripList.css";

export function TripList() {
  const trips = useTravelStore((state) => state.trips);

  if (trips.length === 0) {
    return (
      <div className="trip-list-empty">
        <p>No trips yet. Ask me to create one!</p>
      </div>
    );
  }

  return (
    <div className="trip-list">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}
