# Robotics Intelligence Globe

A comprehensive, intelligence-grade 3D globe visualization for tracking live events in the robotics sector. Built with Next.js, Three.js, and React Three Fiber.

## Features

- **3D Globe Visualization**: Dark, wireframe globe with subtle surface fill and grid lines
- **Company Tracking**: View robotics companies on the globe with their headquarters locations
- **Live Events**: Track events (funding, product launches, partnerships, etc.) in real-time
- **Interactive Navigation**: Click companies in the list to fly the camera to their location
- **Coordinate Conversion**: Convert real-world lat/lon coordinates to globe 3D coordinates and vice versa
- **Filtering & Search**: Filter companies by tags and search by name/description
- **Event Stream**: View detailed event information in the right sidebar

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Three.js** - 3D graphics
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for R3F
- **@react-three/postprocessing** - Post-processing effects
- **Zustand** - State management
- **Tailwind CSS** - Styling

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Globe.tsx          # Main 3D globe component
│   ├── GlobeScene.tsx     # Three.js canvas setup
│   ├── CompanyList.tsx    # Left sidebar company list
│   ├── EventStream.tsx    # Right sidebar event stream
│   └── CoordinateConverter.tsx  # Coordinate conversion tool
├── utils/                 # Utility functions
│   └── coordinates.ts     # Lat/lon ↔ 3D coordinate conversion
├── store/                 # State management
│   └── globeStore.ts      # Zustand store
├── types/                 # TypeScript types
│   └── index.ts           # Company, Event, GlobeState types
└── data/                  # Mock data
    └── mockData.ts        # Sample companies and events
```

## Coordinate System

The globe uses a standard sphere coordinate system:

- **Latitude**: -90° (South Pole) to +90° (North Pole)
- **Longitude**: -180° to +180°
- **Globe Radius**: 1 unit (normalized)

Conversion formulas are implemented in `utils/coordinates.ts`:
- `latLonToVector3()` - Convert lat/lon to 3D position
- `vector3ToLatLon()` - Convert 3D position to lat/lon
- `createArc()` - Create great circle arcs between points
- `getCameraPositionForLocation()` - Calculate camera position for a location

## Adding Companies

Edit `data/mockData.ts` to add new companies:

```typescript
{
  id: 'unique-id',
  name: 'Company Name',
  tags: ['tag1', 'tag2'],
  hq_lat: 37.7749,  // San Francisco
  hq_lon: -122.4194,
  website: 'https://example.com',
  description: 'Company description',
  latestActivity: new Date(),
  activityScore: 85,
}
```

## Adding Events

Events are linked to companies via `company_id`:

```typescript
{
  id: 'event-id',
  company_id: 'company-id',
  timestamp: new Date(),
  type: 'funding' | 'product' | 'partnership' | 'hiring' | 'research' | 'patent' | 'other',
  title: 'Event title',
  description: 'Event description',
  lat: 37.7749,  // Optional location
  lon: -122.4194,
  severity: 'low' | 'medium' | 'high',
}
```

## Visual Design

The globe follows an intelligence-grade aesthetic:

- **Background**: Near-black (#0D1015)
- **Globe**: Dark wireframe with subtle surface fill
- **Grid Lines**: Thin latitude/longitude lines
- **Nodes**: Pulsing cyan markers for companies
- **Arcs**: Connecting lines between major hubs
- **Effects**: Subtle bloom, vignette, and noise

## Future Enhancements

- Real-time data ingestion from APIs
- More sophisticated arc calculations (great circle paths)
- Scanning sweep animations
- Moving dots along arcs
- Hot zone clustering visualization
- Export functionality
- Time-based event filtering
- Multiple view modes (2D map, etc.)

## License

MIT

