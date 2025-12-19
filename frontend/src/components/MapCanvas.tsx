import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTravelStore } from "../stores/travelStore";
import "./MapCanvas.css";

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

// Category colors and icons for place markers
const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
  restaurant: { color: "#ef4444", icon: "🍴" },
  cafe: { color: "#f59e0b", icon: "☕" },
  hotel: { color: "#3b82f6", icon: "🏨" },
  attraction: { color: "#8b5cf6", icon: "📸" },
  default: { color: "#10b981", icon: "📍" },
};

// Create custom pin icon for a category
function createPlaceIcon(category?: string): L.DivIcon {
  const config = CATEGORY_CONFIG[category || "default"] || CATEGORY_CONFIG.default;

  return L.divIcon({
    className: "place-marker",
    html: `
      <div class="place-marker__pin" style="background-color: ${config.color}">
        <span class="place-marker__icon">${config.icon}</span>
      </div>
      <div class="place-marker__shadow"></div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

// Default center (world view) and zoom
const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

// Component to handle map view changes
function MapController() {
  const map = useMap();
  const selectedTrip = useTravelStore((state) => state.getSelectedTrip());
  const mapTarget = useTravelStore((state) => state.mapTarget);
  const clearMapTarget = useTravelStore((state) => state.clearMapTarget);
  const prevTripIdRef = useRef<string | null>(null);

  // Handle trip selection changes
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

  // Handle panMapTo from store (e.g., when clicking "Show on Map" in chat)
  useEffect(() => {
    if (mapTarget) {
      map.flyTo(
        [mapTarget.lat, mapTarget.lng],
        mapTarget.zoom || 15,
        { duration: 1 }
      );
      // Clear target after flying
      clearMapTarget();
    }
  }, [mapTarget, map, clearMapTarget]);

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
        <Marker
          key={place.id}
          position={[place.latitude, place.longitude]}
          icon={createPlaceIcon(place.category)}
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
        </Marker>
      ))}
    </MapContainer>
  );
}
