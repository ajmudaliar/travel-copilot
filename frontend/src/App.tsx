import { ChatSidebar } from "./components/ChatSidebar";
import { TripList } from "./components/TripList";
import { useTravelStore } from "./stores/travelStore";
import "./App.css";

// Get client ID from environment variable
const WEBCHAT_CLIENT_ID = import.meta.env.VITE_BOTPRESS_CLIENT_ID || "";

function App() {
  const selectedTrip = useTravelStore((state) => state.getSelectedTrip());

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
      {/* Main content area - Map will go here in Phase 3 */}
      <main className="main-content">
        <div className="map-placeholder">
          <h2>Travel Copilot</h2>
          <p>Your AI-powered travel planning assistant</p>

          {/* Trip list */}
          <TripList />

          {/* Selected trip info */}
          {selectedTrip && (
            <div className="selected-trip-info">
              <p>
                📍 Viewing: <strong>{selectedTrip.name}</strong>
              </p>
              {selectedTrip.description && (
                <p className="selected-trip-description">
                  {selectedTrip.description}
                </p>
              )}
            </div>
          )}

          {/* Phase indicator */}
          <div className="phase-indicator">
            <p>
              <strong>Phase 2:</strong> Trip Management
            </p>
            <ul>
              <li>Create trips via chat</li>
              <li>List and select trips</li>
              <li>Update trip details</li>
              <li>Delete trips</li>
            </ul>
            <p className="coming-soon">Map integration coming in Phase 3</p>
          </div>
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
