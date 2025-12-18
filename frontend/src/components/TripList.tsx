import { useTravelStore } from "../stores/travelStore";
import { TripCard } from "./TripCard";
import "./TripList.css";

export function TripList() {
  const { trips } = useTravelStore();

  if (trips.length === 0) {
    return (
      <div className="trip-list trip-list--empty">
        <div className="trip-list__empty-state">
          <div className="trip-list__empty-icon">🗺️</div>
          <h3>No trips yet</h3>
          <p>
            Start planning your next adventure! Ask the Travel Copilot to create
            a trip for you.
          </p>
          <div className="trip-list__suggestions">
            <p className="trip-list__suggestions-label">Try saying:</p>
            <ul>
              <li>"Create a trip to Paris"</li>
              <li>"Plan a weekend in NYC"</li>
              <li>"Start a Tokyo adventure trip"</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-list">
      <div className="trip-list__header">
        <h3>Your Trips</h3>
        <span className="trip-list__count">{trips.length}</span>
      </div>
      <div className="trip-list__items">
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
}
