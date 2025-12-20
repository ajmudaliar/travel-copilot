# Travel Copilot - Implementation Plan

A travel planning application built with Botpress ADK and a custom React frontend.

## Overview

### What We Built

A conversational travel planner where users can:
- Create and manage trips via natural language
- Search for places using Google Places API
- Add places to trips (via chat or clicking cards)
- View trips and places on an interactive map
- See rich place cards with Google Places UI Kit

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Frontend                             │
│  ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │   Leaflet Map    │  │  Trip Panel   │  │  Chat Sidebar    │  │
│  │  - Trip markers  │  │  - TripList   │  │  - Webchat       │  │
│  │  - Place pins    │  │  - TripDetail │  │  - CustomRenderer│  │
│  │  - Preview pin   │  │  - PlaceCards │  │  - PlaceCards    │  │
│  └──────────────────┘  └───────────────┘  └──────────────────┘  │
│           │                    │                   │             │
│           └────────────────────┼───────────────────┘             │
│                                │                                 │
│                    ┌───────────▼───────────┐                     │
│                    │   Zustand Store       │                     │
│                    │   + @botpress/client  │                     │
│                    └───────────────────────┘                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ Webchat / API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Botpress ADK Agent                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Tools    │  │   Actions   │  │        Tables           │  │
│  │ - createTrip│  │ - ping      │  │ - tripsTable            │  │
│  │ - addPlace  │  │ - addPlace  │  │ - placesTable           │  │
│  │ - search    │  │ - getState  │  │                         │  │
│  │ - delete    │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                          │                                       │
│              ┌───────────▼───────────┐                          │
│              │   Google Places API   │                          │
│              │   (Text Search)       │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status

### Phase 1: Foundation ✅

- [x] Agent setup with bot/user state schemas
- [x] Basic conversation handler
- [x] Ping action for verification
- [x] Frontend webchat integration with `@botpress/webchat`
- [x] Connection state display
- [x] State sync via custom events

### Phase 2: Trip Management ✅

- [x] `tripsTable` with userId, name, coordinates, zoomLevel
- [x] `createTrip` tool with deduplication (by name)
- [x] `listTrips` tool
- [x] `selectTrip` tool with user state persistence
- [x] `updateTrip` tool
- [x] `deleteTrip` tool (fixed to use deleteRowIds)
- [x] Natural language trip operations
- [x] TripList and TripCard components
- [x] Trip selection UI with map sync

### Phase 3: Map Integration ✅

- [x] Leaflet + React-Leaflet setup
- [x] MapCanvas component with OpenStreetMap tiles
- [x] Trip markers with popups
- [x] Custom place markers (category-based icons/colors)
- [x] Map centers on selected trip
- [x] Preview marker with pulsing animation
- [x] Click map to dismiss preview
- [x] Responsive layout (Map + Trips + Chat)

### Phase 4: Place Management ✅

- [x] `placesTable` with tripId, name, address, coordinates, rating, category
- [x] `addPlace` tool with deduplication (by coordinates)
- [x] `removePlace` tool (fixed to use deleteRowIds)
- [x] `listPlaces` tool
- [x] `searchPlaces` tool with Google Places API
- [x] `addPlaceToTrip` action (callable from frontend)
- [x] Place search via conversation
- [x] PlaceSuggestionCard with Lucide icons (replaced Google UI Kit to reduce API costs)
- [x] Hover card to preview on map, click to zoom
- [x] "Add to Trip" button on cards
- [x] "Open in Google Maps" external link

### Phase 5: Enhanced UX ✅

- [x] Custom PlaceSuggestionCard (photos, ratings from search - no extra API calls)
- [x] Custom message rendering via CustomRenderer
- [x] UI notifications (refresh_trips, refresh_places, select_trip)
- [x] Typing indicator during operations
- [x] Map panning from chat actions
- [x] Cached search results in conversation state (don't re-search when adding)
- [x] Interactive card hover/click for map preview
- [x] Distinct purple preview marker with pulse animation

### Phase 6: Production Readiness 🔄

- [x] Environment configuration (.env files)
- [x] Google Maps API key setup
- [x] Botpress credentials setup
- [ ] Deploy agent to Botpress Cloud
- [ ] Deploy frontend
- [ ] Testing
- [x] Documentation (README with diagrams)

---

## File Structure (Current)

```
travel-copilot/
├── agent/
│   ├── src/
│   │   ├── actions/
│   │   │   ├── index.ts          # ping, getTravelState
│   │   │   └── addPlace.ts       # addPlaceToTrip action
│   │   ├── tables/
│   │   │   ├── trips.ts          # tripsTable
│   │   │   └── places.ts         # placesTable
│   │   ├── tools/
│   │   │   ├── trips.ts          # createTrip, selectTrip, updateTrip, deleteTrip, listTrips
│   │   │   └── places.ts         # addPlace, removePlace, listPlaces, searchPlaces
│   │   ├── conversations/
│   │   │   └── index.ts          # Main chat handler with AI tools
│   │   └── utils/
│   │       ├── googlePlaces.ts   # Google Places Text Search API
│   │       ├── stateSync.ts      # notifyRefreshTrips, notifyRefreshPlaces, etc.
│   │       └── context.ts        # getCurrentUserId
│   ├── agent.config.ts           # Bot/user state schemas
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapCanvas.tsx         # Leaflet map with markers
│   │   │   ├── MapCanvas.css         # Marker styles, animations
│   │   │   ├── ChatSidebar.tsx       # Webchat integration
│   │   │   ├── CustomRenderer.tsx    # Custom message handling
│   │   │   ├── TripList.tsx          # Trip selection panel
│   │   │   ├── TripCard.tsx          # Individual trip card
│   │   │   ├── TripDetail.tsx        # Selected trip details + places
│   │   │   ├── PlaceSuggestionCard.tsx   # Google Places UI card
│   │   │   └── PlaceSuggestionCard.css
│   │   ├── hooks/
│   │   │   └── useTripData.ts    # fetchTrips, fetchPlaces, addPlaceToTrip
│   │   ├── stores/
│   │   │   └── travelStore.ts    # Zustand store (trips, places, mapTarget, previewPlace)
│   │   ├── types/
│   │   │   └── index.ts          # Trip, Place, TravelState interfaces
│   │   ├── App.tsx               # Main layout
│   │   └── App.css
│   ├── package.json
│   └── vite.config.ts
│
├── PLAN.md                       # This file
└── README.md                     # Demo walkthrough with diagrams
```

---

## Key Design Decisions

### 1. Tools vs Actions
- **Tools**: Used by AI during conversation (createTrip, searchPlaces)
- **Actions**: Called directly from frontend (addPlaceToTrip)

### 2. State Sync Pattern
- Agent sends custom messages with notification type
- Frontend's CustomRenderer handles notifications
- Frontend fetches updated data from tables via `@botpress/client`

### 3. Deduplication
- `createTrip`: Checks for existing trip by name for same user
- `addPlace`: Checks for existing place by coordinates in same trip
- Prevents duplicates when AI calls tools multiple times

### 4. Google Places Integration
- Backend: Text Search API via fetch (agent/src/utils/googlePlaces.ts)
- Frontend: Custom cards using data from search (no additional API calls)
- Photo URLs captured during search and displayed in cards
- Removed Google Extended Component Library to reduce API costs

### 5. Map Preview
- Hovering card shows preview marker on map
- Clicking card pans/zooms to location
- Preview marker uses distinct purple color (#667eea) with pulse animation
- Clicking map clears preview

### 6. Search Result Caching
- Search results cached in conversation state (lastSearchResults)
- When user asks to add a place, bot uses cached data instead of re-searching
- Reduces API calls and improves response time

---

## Environment Variables

### Agent (.env)
```env
GOOGLE_PLACES_API_KEY=your_key
```

### Frontend (.env)
```env
VITE_WEBCHAT_CLIENT_ID=your_client_id
VITE_BOT_ID=your_bot_id
VITE_BOTPRESS_TOKEN=your_pat_token
```

---

## Running Locally

```bash
# Terminal 1: Agent
cd agent
bun install
adk dev

# Terminal 2: Frontend
cd frontend
bun install
bun run dev
```

- Frontend: http://localhost:5173
- Agent console: http://localhost:3001
