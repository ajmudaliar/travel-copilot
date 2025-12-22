import { useState, useCallback, useEffect } from "react";
import { Toaster } from "sonner";
import { ChatSidebar } from "./components/ChatSidebar";
import { TripList } from "./components/TripList";
import { TripDetail } from "./components/TripDetail";
import { MapCanvas } from "./components/MapCanvas";
import { useTravelStore } from "./stores/travelStore";
import "./App.css";

// Get client ID from environment variable
const WEBCHAT_CLIENT_ID = import.meta.env.VITE_BOTPRESS_CLIENT_ID || "";

const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 400;

function App() {
  const selectedTrip = useTravelStore((state) => state.getSelectedTrip());
  const places = useTravelStore((state) => state.places);
  const trips = useTravelStore((state) => state.trips);

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // Filter places for selected trip
  const tripPlaces = selectedTrip
    ? places.filter((p) => p.tripId === selectedTrip.id)
    : [];

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle mouse move during resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

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
      <Toaster position="bottom-left" richColors closeButton />

      {/* Main content area with map */}
      <main className="main-content">
        {/* Map */}
        <div className="map-wrapper">
          <MapCanvas />
        </div>

        {/* Floating trip panel */}
        <div className="trip-panel">
          <div className="trip-panel__header">
            <h3>Your Trips</h3>
            {trips.length > 0 && (
              <span className="trip-panel__count">{trips.length}</span>
            )}
          </div>

          <TripList />

          {selectedTrip && (
            <TripDetail trip={selectedTrip} places={tripPlaces} />
          )}
        </div>
      </main>

      {/* Resize handle */}
      <div
        className={`resize-handle ${isResizing ? "resize-handle--active" : ""}`}
        onMouseDown={handleMouseDown}
      />

      {/* Chat sidebar */}
      <aside className="chat-aside" style={{ width: sidebarWidth }}>
        <ChatSidebar clientId={WEBCHAT_CLIENT_ID} />
      </aside>
    </div>
  );
}

export default App;
