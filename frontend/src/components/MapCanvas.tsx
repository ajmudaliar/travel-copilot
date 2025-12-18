import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
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

// Category colors for place markers
const CATEGORY_COLORS: Record<string, string> = {
  restaurant: "#ef4444", // red
  cafe: "#f59e0b", // amber
  hotel: "#3b82f6", // blue
  attraction: "#8b5cf6", // purple
  default: "#10b981", // green
};

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
  const places = useTravelStore((state) => state.places);
  const selectedTripId = useTravelStore((state) => state.selectedTripId);
  const selectTrip = useTravelStore((state) => state.selectTrip);

  // Filter places for selected trip
  const tripPlaces = selectedTripId
    ? places.filter((p) => p.tripId === selectedTripId)
    : [];

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

      {/* Place markers for selected trip */}
      {tripPlaces.map((place) => (
        <CircleMarker
          key={place.id}
          center={[place.latitude, place.longitude]}
          radius={8}
          pathOptions={{
            color: CATEGORY_COLORS[place.category || "default"] || CATEGORY_COLORS.default,
            fillColor: CATEGORY_COLORS[place.category || "default"] || CATEGORY_COLORS.default,
            fillOpacity: 0.8,
          }}
        >
          <Popup>
            <div className="place-popup">
              <strong>{place.name}</strong>
              {place.category && (
                <span className="place-category">{place.category}</span>
              )}
              <p className="place-address">{place.address}</p>
              {place.rating && (
                <p className="place-rating">Rating: {place.rating}/5</p>
              )}
              {place.description && (
                <p className="place-description">{place.description}</p>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
