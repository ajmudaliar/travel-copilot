import { ChatSidebar } from "./components/ChatSidebar";
import { TripList } from "./components/TripList";
import { MapCanvas } from "./components/MapCanvas";
import { useTravelStore } from "./stores/travelStore";
import "./App.css";

// Get client ID from environment variable
const WEBCHAT_CLIENT_ID = import.meta.env.VITE_BOTPRESS_CLIENT_ID || "";

function App() {
  const selectedTrip = useTravelStore((state) => state.getSelectedTrip());
  const places = useTravelStore((state) => state.places);

  // Count places for selected trip
  const placesCount = selectedTrip
    ? places.filter((p) => p.tripId === selectedTrip.id).length
    : 0;

  // Show warning if no client ID is configured
  if (!WEBCHAT_CLIENT_ID) {
    return (
      <div className="app-container">
        <div className="config-warning">
          <h2>Configuration Required</h2>
          <p>
            Please set the <code>VITE_BOTPRESS_CLIENT_ID</code> environment
            variable to connect to your Botpress bot.
          </p>
          <p>
            Create a <code>.env</code> file in the frontend directory with:
          </p>
          <pre>VITE_BOTPRESS_CLIENT_ID=your_client_id_here</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Main content area with map */}
      <main className="main-content">
        {/* Map */}
        <div className="map-wrapper">
          <MapCanvas />
        </div>

        {/* Floating trip panel */}
        <div className="trip-panel">
          <h3>Your Trips</h3>
          <TripList />
          {selectedTrip && (
            <div className="selected-trip-detail">
              <p>
                <strong>{selectedTrip.name}</strong>
              </p>
              {selectedTrip.description && (
                <p className="trip-description">{selectedTrip.description}</p>
              )}
              <p className="trip-places-count">
                {placesCount} {placesCount === 1 ? "place" : "places"}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Chat sidebar */}
      <aside className="chat-aside">
        <ChatSidebar clientId={WEBCHAT_CLIENT_ID} />
      </aside>
    </div>
  );
}

export default App;
