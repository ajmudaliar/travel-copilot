import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTravelStore } from "../stores/travelStore";

// Fix default marker icons in Leaflet (they get broken by bundlers)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Default center (world view) and zoom
const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

// Component to handle map view changes
function MapController() {
  const map = useMap();
  const selectedTrip = useTravelStore((state) => state.getSelectedTrip());
  const prevTripIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedTrip && selectedTrip.id !== prevTripIdRef.current) {
      map.flyTo(
        [selectedTrip.centerLatitude, selectedTrip.centerLongitude],
        selectedTrip.zoomLevel,
        { duration: 1 }
      );
      prevTripIdRef.current = selectedTrip.id;
    }
  }, [selectedTrip, map]);

  return null;
}

export function MapCanvas() {
  const trips = useTravelStore((state) => state.trips);
  const selectedTripId = useTravelStore((state) => state.selectedTripId);
  const selectTrip = useTravelStore((state) => state.selectTrip);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="map-container"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController />

      {/* Trip markers */}
      {trips.map((trip) => (
        <Marker
          key={trip.id}
          position={[trip.centerLatitude, trip.centerLongitude]}
          eventHandlers={{
            click: () => selectTrip(trip.id),
          }}
        >
          <Popup>
            <div className="trip-popup">
              <strong>{trip.name}</strong>
              {trip.description && <p>{trip.description}</p>}
              {selectedTripId === trip.id && (
                <span className="selected-badge">Selected</span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
