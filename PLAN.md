# Travel Copilot - Implementation Plan

A travel planning application built with Botpress ADK and a custom React frontend, inspired by [CopilotKit's coagents-travel example](https://github.com/CopilotKit/CopilotKit/tree/main/examples/coagents-travel).

## Overview

### What We're Building

A conversational travel planner where users can:
- Create and manage trips via natural language
- Search for places using Google Maps API
- Add places to trips
- View trips and places on an interactive map
- Have the map UI stay in sync with the conversation

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │    Leaflet Map      │  │   @botpress/webchat      │  │
│  │  - Trip markers     │  │   - Chat sidebar         │  │
│  │  - Place pins       │  │   - Message history      │  │
│  │  - Route display    │  │   - Typing indicator     │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│            │                         │                   │
│            └────────┬────────────────┘                   │
│                     │                                    │
│         ┌───────────▼───────────┐                        │
│         │    State Manager      │                        │
│         │  (Zustand/Context)    │                        │
│         └───────────────────────┘                        │
└─────────────────────┬───────────────────────────────────┘
                      │ Webchat Client / Events
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Botpress ADK Agent                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Actions   │  │  Workflows  │  │     Tables      │  │
│  │ - addTrip   │  │ - planning  │  │ - trips         │  │
│  │ - addPlace  │  │ - search    │  │ - places        │  │
│  │ - search    │  │             │  │                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                          │                               │
│                          ▼                               │
│              ┌───────────────────────┐                   │
│              │   Google Maps API     │                   │
│              └───────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Data Models

```typescript
// Trip
interface Trip {
  id: string
  name: string
  description?: string
  centerLatitude: number
  centerLongitude: number
  zoomLevel: number
  createdAt: string
  updatedAt: string
}

// Place
interface Place {
  id: string
  tripId: string
  name: string
  address: string
  latitude: number
  longitude: number
  rating?: number
  description?: string
  category?: string // restaurant, hotel, attraction, etc.
  createdAt: string
}

// Agent State (synced to frontend)
interface AgentState {
  trips: Trip[]
  selectedTripId: string | null
  searchResults?: Place[]
  isSearching: boolean
}
```

---

## Phase 1: Foundation

**Goal**: Establish working communication between frontend and ADK agent with basic state sync.

### 1.1 Agent Setup

- [ ] Define bot state schema in `agent.config.ts`
  ```typescript
  botState: z.object({
    trips: z.array(TripSchema).default([]),
    selectedTripId: z.string().nullable().default(null),
  })
  ```

- [ ] Create basic conversation handler that responds to messages
- [ ] Implement a simple `ping` action to verify agent is working
- [ ] Test agent locally with `adk dev`

### 1.2 Frontend Webchat Integration

- [ ] Install `@botpress/webchat` package
- [ ] Create `WebchatProvider` component with client configuration
- [ ] Implement basic chat sidebar using `useWebchat` hook
- [ ] Display connection state (connecting/connected/error)
- [ ] Verify messages flow between frontend and agent

### 1.3 State Sync Foundation

- [ ] Create `useTravelState` hook to manage local trip state
- [ ] Listen for `customEvent` from webchat to receive state updates
- [ ] Implement agent action to emit state via custom event
- [ ] Verify state flows from agent → frontend

### Validation Checkpoint
- [ ] Can send a message from frontend and receive a response
- [ ] Agent can emit a custom event that frontend receives
- [ ] Connection state displays correctly in UI

---

## Phase 2: Trip Management

**Goal**: Full CRUD operations for trips via conversation.

### 2.1 Agent Tables

- [x] Define `trips` table schema
  ```typescript
  // src/tables/trips.ts
  export const trips = defineTable({
    name: 'trips',
    schema: z.object({
      name: z.string(),
      description: z.string().optional(),
      centerLatitude: z.number(),
      centerLongitude: z.number(),
      zoomLevel: z.number().default(13),
    })
  })
  ```

### 2.2 Trip Actions

- [x] `createTrip` action
  - Input: name, optional location (defaults to user's location or a default)
  - Creates table row
  - Updates bot state
  - Emits state update event

- [x] `listTrips` action
  - Returns all trips from table
  - Updates bot state with trips array

- [x] `selectTrip` action
  - Input: tripId
  - Updates selectedTripId in bot state
  - Emits state update event

- [x] `updateTrip` action
  - Input: tripId, fields to update
  - Updates table row
  - Emits state update event

- [x] `deleteTrip` action
  - Input: tripId
  - Removes from table
  - Clears selection if deleted trip was selected
  - Emits state update event

### 2.3 Trip Conversation Flow

- [x] Create conversation handler that understands trip intents:
  - "Create a trip to Paris"
  - "Show my trips"
  - "Select the NYC trip"
  - "Delete the Paris trip"
  - "Rename my trip to Summer Vacation"

- [x] Implement natural language parsing for trip operations (via AI with tools)
- [x] Add confirmation for destructive actions (delete) - AI prompted to confirm

### 2.4 Frontend Trip UI

- [x] Create `TripList` component showing all trips
- [x] Create `TripCard` component with name, place count, actions
- [x] Implement trip selection (click to select, highlight selected)
- [ ] Add "New Trip" button that sends message to bot (deferred - can use chat)
- [x] Sync UI state when `customEvent` received

### Validation Checkpoint
- [ ] Can create a trip via chat: "Create a trip called Paris Adventure"
- [ ] Can list trips via chat: "Show my trips"
- [ ] Can select a trip via chat: "Select Paris Adventure"
- [ ] Trip list UI updates when state changes
- [ ] Selected trip is highlighted in UI

---

## Phase 3: Map Integration

**Goal**: Interactive map displaying trips and places.

### 3.1 Map Setup

- [ ] Install Leaflet and React-Leaflet
  ```bash
  bun add leaflet react-leaflet
  bun add -D @types/leaflet
  ```

- [ ] Create `MapCanvas` component
- [ ] Configure tile layer (OpenStreetMap)
- [ ] Handle SSR issues (dynamic import with ssr: false if needed)

### 3.2 Map-State Integration

- [ ] Display markers for selected trip's places
- [ ] Center map on selected trip's coordinates
- [ ] Update zoom level from trip data
- [ ] Add click handler on map for future "add place here" feature

### 3.3 Map Markers

- [ ] Create custom marker icons for different place categories
- [ ] Show popup on marker click with place details
- [ ] Implement marker clustering for trips with many places

### 3.4 Layout

- [ ] Create responsive layout: Map (left/main) + Chat sidebar (right)
- [ ] Mobile: Stack vertically or use drawer for chat
- [ ] Add toggle to show/hide chat sidebar

### Validation Checkpoint
- [ ] Map renders with OpenStreetMap tiles
- [ ] Selecting a trip centers the map on that trip's location
- [ ] Map is responsive alongside chat sidebar

---

## Phase 4: Place Management

**Goal**: Add, search, and manage places within trips.

### 4.1 Places Table

- [ ] Define `places` table schema
  ```typescript
  export const places = defineTable({
    name: 'places',
    schema: z.object({
      tripId: z.string(),
      name: z.string(),
      address: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      rating: z.number().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
    })
  })
  ```

### 4.2 Place Actions

- [ ] `addPlace` action
  - Input: tripId, place details
  - Creates table row
  - Emits state update

- [ ] `removePlace` action
  - Input: placeId
  - Removes from table
  - Emits state update

- [ ] `listPlaces` action
  - Input: tripId
  - Returns places for that trip

### 4.3 Google Maps Search Integration

- [ ] Create `searchPlaces` action
  - Input: query string, optional location bias
  - Calls Google Places API
  - Returns search results
  - Emits search results via custom event

- [ ] Handle API key securely (environment variable)
- [ ] Parse Google Places response into our Place format
- [ ] Include rating, address, coordinates, category

### 4.4 Place Conversation Flow

- [ ] Understand place-related intents:
  - "Search for restaurants in Paris"
  - "Find hotels near the Eiffel Tower"
  - "Add Le Petit Bistro to my trip"
  - "Remove the hotel from my trip"
  - "Show me places in my trip"

- [ ] Display search results as carousel or list in chat
- [ ] Use `ButtonBlock` for "Add to trip" action on search results

### 4.5 Frontend Place UI

- [ ] Show places in trip detail panel
- [ ] Display search results with "Add" buttons
- [ ] Show place markers on map
- [ ] Click marker to see place details

### Validation Checkpoint
- [ ] Can search: "Find coffee shops in Brooklyn"
- [ ] Search results appear in chat with add buttons
- [ ] Can add a place: click "Add" or say "Add the first one"
- [ ] Places appear as markers on map
- [ ] Can remove a place via chat

---

## Phase 5: Enhanced UX

**Goal**: Polish the experience with better UI, feedback, and features.

### 5.1 Rich Message Blocks

- [ ] Use `LocationBlock` when mentioning specific places
- [ ] Use `CarouselBlock` for search results
- [ ] Use `ImageBlock` for place photos (from Google Places)
- [ ] Add quick reply buttons for common actions

### 5.2 Loading States

- [ ] Show typing indicator during searches
- [ ] Display "Searching..." state in UI
- [ ] Handle long-running operations gracefully

### 5.3 Error Handling

- [ ] Handle Google API errors gracefully
- [ ] Show user-friendly error messages
- [ ] Implement retry logic for transient failures
- [ ] Handle offline/disconnected state

### 5.4 Map Enhancements

- [ ] Fit map bounds to show all places in trip
- [ ] Draw route/path between places (optional)
- [ ] Add place directly by clicking on map
- [ ] Reverse geocode clicked location

### 5.5 Conversation Memory

- [ ] Remember context within session
- [ ] "Add that to my trip" should understand "that" refers to last search result
- [ ] "Delete it" should understand context

### Validation Checkpoint
- [ ] Search results show as carousel with images
- [ ] Loading states provide feedback during operations
- [ ] Errors are handled gracefully with helpful messages
- [ ] Conversation feels natural with context understanding

---

## Phase 6: Production Readiness

**Goal**: Prepare for deployment and real-world use.

### 6.1 Environment Configuration

- [ ] Set up `.env` files for development/production
- [ ] Configure Google Maps API key securely
- [ ] Set Botpress client ID and API URL

### 6.2 Deployment

- [ ] Deploy agent to Botpress Cloud (`adk deploy`)
- [ ] Deploy frontend (Vercel/Netlify/Render)
- [ ] Configure CORS if needed
- [ ] Set up custom domain (optional)

### 6.3 Testing

- [ ] Write unit tests for actions
- [ ] Test conversation flows
- [ ] Test error scenarios
- [ ] Cross-browser testing for frontend

### 6.4 Documentation

- [ ] Update README with setup instructions
- [ ] Document environment variables
- [ ] Add usage examples
- [ ] Include screenshots/demo

### Validation Checkpoint
- [ ] App works in production environment
- [ ] All features function correctly when deployed
- [ ] Documentation is complete

---

## File Structure (Target)

```
travel-copilot/
├── agent/
│   ├── src/
│   │   ├── actions/
│   │   │   ├── index.ts
│   │   │   ├── trips.ts        # createTrip, updateTrip, deleteTrip, selectTrip
│   │   │   ├── places.ts       # addPlace, removePlace, listPlaces
│   │   │   └── search.ts       # searchPlaces (Google Maps)
│   │   ├── tables/
│   │   │   ├── index.ts
│   │   │   ├── trips.ts
│   │   │   └── places.ts
│   │   ├── workflows/
│   │   │   └── index.ts
│   │   ├── conversations/
│   │   │   └── index.ts        # Main conversation handler
│   │   └── utils/
│   │       ├── googleMaps.ts   # Google Places API client
│   │       └── stateSync.ts    # Helper to emit state updates
│   ├── agent.config.ts
│   ├── agent.json
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapCanvas.tsx
│   │   │   ├── ChatSidebar.tsx
│   │   │   ├── TripList.tsx
│   │   │   ├── TripCard.tsx
│   │   │   ├── PlaceMarker.tsx
│   │   │   └── SearchResults.tsx
│   │   ├── hooks/
│   │   │   ├── useTravelState.ts
│   │   │   └── useWebchatEvents.ts
│   │   ├── types/
│   │   │   └── index.ts        # Trip, Place, AgentState types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
│
├── PLAN.md                     # This file
└── README.md
```

---

## Dependencies to Add

### Agent
```json
{
  "dependencies": {
    "@botpress/runtime": "^1.11.2",
    "zod": "^3.x"
  }
}
```
*Note: Google Maps API calls will be made via fetch, no additional package needed*

### Frontend
```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@botpress/webchat": "^4.2.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "zustand": "^4.4.1"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.8"
  }
}
```

---

## Environment Variables

### Agent
```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Frontend
```env
VITE_BOTPRESS_CLIENT_ID=your_webchat_client_id
VITE_BOTPRESS_API_URL=https://api.botpress.cloud  # optional, defaults to cloud
```

---

## Getting Started

Once we begin implementation:

```bash
# Terminal 1: Agent development
cd agent
bun install
bun run dev

# Terminal 2: Frontend development
cd frontend
bun install
bun run dev
```

---

## Success Criteria

The project is complete when:

1. **Conversation works**: Users can chat naturally about travel planning
2. **Trips are managed**: Create, list, select, update, delete trips
3. **Places are searchable**: Google Maps search returns relevant results
4. **Places are manageable**: Add/remove places from trips
5. **Map is interactive**: Shows selected trip with place markers
6. **State stays in sync**: UI updates reflect conversation changes
7. **UX is polished**: Loading states, error handling, responsive design
8. **It's deployed**: Working in production environment
