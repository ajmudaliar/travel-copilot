import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
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
function createPlaceIcon(category?: string, isPreview = false): L.DivIcon {
  const config = CATEGORY_CONFIG[category || "default"] || CATEGORY_CONFIG.default;
  const previewClass = isPreview ? " place-marker--preview" : "";

  return L.divIcon({
    className: `place-marker${previewClass}`,
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

// Custom cluster icon
function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? "small" : count < 50 ? "medium" : "large";

  return L.divIcon({
    html: `<div class="cluster-marker cluster-marker--${size}"><span>${count}</span></div>`,
    className: "cluster-marker-container",
    iconSize: L.point(40, 40, true),
  });
}

// Component to handle map view changes and events
function MapController() {
  const map = useMap();
  const selectedTrip = useTravelStore((state) => state.getSelectedTrip());
  const mapTarget = useTravelStore((state) => state.mapTarget);
  const clearMapTarget = useTravelStore((state) => state.clearMapTarget);
  const setPreviewPlace = useTravelStore((state) => state.setPreviewPlace);
  const prevTripIdRef = useRef<string | null>(null);

  // Clear preview marker when clicking on the map
  useEffect(() => {
    const handleClick = () => {
      setPreviewPlace(null);
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, setPreviewPlace]);

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
    if (mapTarget && !isNaN(mapTarget.lat) && !isNaN(mapTarget.lng)) {
      map.flyTo(
        [mapTarget.lat, mapTarget.lng],
        mapTarget.zoom || 15,
        { duration: 1 }
      );
      // Clear target after flying
      clearMapTarget();
    } else if (mapTarget) {
      // Invalid coordinates, just clear the target
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
  const previewPlace = useTravelStore((state) => state.previewPlace);

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
              <h4 className="trip-popup__name">{trip.name}</h4>
              {trip.description && <p className="trip-popup__description">{trip.description}</p>}
              {selectedTripId === trip.id && (
                <span className="trip-popup__badge">Selected</span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Place markers for selected trip (clustered) */}
      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={50}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
      >
        {tripPlaces.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={createPlaceIcon(place.category)}
          >
            <Popup>
              <div className="place-popup">
                {place.photoUrl && (
                  <div className="place-popup__photo">
                    <img src={place.photoUrl} alt={place.name} />
                  </div>
                )}
                <h4 className="place-popup__name">{place.name}</h4>
                <div className="place-popup__meta">
                  {place.category && (
                    <span className="place-popup__category">{place.category}</span>
                  )}
                  {place.rating && (
                    <span className="place-popup__rating">★ {place.rating.toFixed(1)}</span>
                  )}
                </div>
                <p className="place-popup__address">{place.address}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>

      {/* Preview marker (from chat suggestions) */}
      {previewPlace && (
        <Marker
          position={[previewPlace.latitude, previewPlace.longitude]}
          icon={createPlaceIcon(previewPlace.category, true)}
        >
          <Popup>
            <div className="place-popup">
              {previewPlace.photoUrl && (
                <div className="place-popup__photo">
                  <img src={previewPlace.photoUrl} alt={previewPlace.name} />
                </div>
              )}
              <h4 className="place-popup__name">{previewPlace.name}</h4>
              {(previewPlace.category || previewPlace.rating) && (
                <div className="place-popup__meta">
                  {previewPlace.category && (
                    <span className="place-popup__category">{previewPlace.category}</span>
                  )}
                  {previewPlace.rating && previewPlace.rating > 0 && (
                    <span className="place-popup__rating">★ {previewPlace.rating.toFixed(1)}</span>
                  )}
                </div>
              )}
              <p className="place-popup__hint">Click + in chat to add to trip</p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
