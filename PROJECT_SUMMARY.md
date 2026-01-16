# Robotics Intelligence Globe - Detailed Project Summary

## Project Overview

**Robotics Intelligence Globe** is a comprehensive, intelligence-grade 3D visualization dashboard for tracking and analyzing the global robotics sector. Built with Next.js 14, Three.js, and React Three Fiber, it provides an interactive 3D globe interface that displays:

- **Robotics companies** (both public and private) mapped by their headquarters locations
- **Real-time market data** including stock prices, ETF comparisons, and crypto indices
- **Polymarket signals** for prediction market data related to robotics
- **Strategic intelligence heatmap** showing power concentration across regions
- **Company funding data** with detailed rounds and history
- **Event tracking** for funding, product launches, partnerships, and other activities

The application combines multiple data sources to create a comprehensive intelligence platform for monitoring the robotics industry.

---

## File Structure & Purpose

### 📁 **Root Configuration Files**

#### `package.json`
- **Purpose**: Defines project dependencies, scripts, and metadata
- **Key Scripts**: 
  - `dev`: Runs development server on port 3001
  - `build:companies`: Builds private companies dataset
  - `build:v2`: Builds v2 dataset with funding data
  - `validate:companies`: Validates company data integrity

#### `tsconfig.json`
- **Purpose**: TypeScript configuration for type checking and compilation
- **Details**: Defines compiler options, paths, and includes

#### `next.config.js`
- **Purpose**: Next.js framework configuration
- **Details**: Handles routing, API routes, and build settings

#### `tailwind.config.ts`
- **Purpose**: Tailwind CSS configuration
- **Details**: Custom color schemes, fonts, and utility classes for styling

#### `postcss.config.js`
- **Purpose**: PostCSS configuration for CSS processing
- **Details**: Enables Tailwind CSS preprocessing

#### `.eslintrc.json`
- **Purpose**: ESLint configuration for code quality
- **Details**: Defines linting rules for TypeScript/React

#### `.gitignore`
- **Purpose**: Specifies files/directories to exclude from version control
- **Details**: Ignores node_modules, build outputs, cache files

#### `README.md`
- **Purpose**: Project documentation
- **Details**: Overview, features, setup instructions, architecture

---

### 📁 **App Directory** (`app/`)

#### `app/layout.tsx`
- **Purpose**: Root layout component for Next.js App Router
- **Details**: Defines HTML structure, metadata, and global styles

#### `app/page.tsx`
- **Purpose**: Main dashboard page component
- **Details**: Orchestrates all UI sections:
  - Left sidebar: Company list + Polymarket signal
  - Center: 3D Globe + Heatmap
  - Right sidebar: Company details + Indices + Event stream
  - Scrollable sections: Startups and single stocks

#### `app/globals.css`
- **Purpose**: Global CSS styles and Tailwind directives
- **Details**: Custom typography, colors, glass effects, animations

#### **API Routes** (`app/api/`)

##### `app/api/indices/robotics/route.ts`
- **Purpose**: API endpoint for robotics index data
- **Details**: Returns calculated robotics index metrics

##### `app/api/indices/robotics-crypto/route.ts`
- **Purpose**: API endpoint for robotics-crypto correlation index
- **Details**: Returns combined robotics/crypto market metrics

##### `app/api/market/health/route.ts`
- **Purpose**: Health check endpoint for market data services
- **Details**: Verifies market data API connectivity

##### `app/api/market/history/route.ts`
- **Purpose**: Historical market data endpoint
- **Details**: Returns historical price/volume data for robotics stocks

##### `app/api/market/compare-history/route.ts`
- **Purpose**: Comparative historical analysis endpoint
- **Details**: Returns comparison data between multiple securities

##### `app/api/polymarket/health/route.ts`
- **Purpose**: Polymarket API health check
- **Details**: Verifies Polymarket prediction market API connectivity

##### `app/api/polymarket/markets/route.ts`
- **Purpose**: Polymarket markets listing endpoint
- **Details**: Returns available prediction markets related to robotics

##### `app/api/polymarket/event-markets/route.ts`
- **Purpose**: Polymarket event-specific markets endpoint
- **Details**: Returns markets filtered by robotics events

##### `app/api/polymarket/clob/price/route.ts`
- **Purpose**: Polymarket CLOB (Central Limit Order Book) price endpoint
- **Details**: Returns current prices from Polymarket order book

##### `app/api/polymarket/clob/prices-history/route.ts`
- **Purpose**: Historical Polymarket price data endpoint
- **Details**: Returns historical price movements for prediction markets

---

### 📁 **Components Directory** (`components/`)

#### **Core Globe Components**

##### `components/GlobeScene.tsx`
- **Purpose**: Three.js canvas setup and scene initialization
- **Details**: Creates WebGL context, camera, lighting, post-processing effects

##### `components/Globe.tsx`
- **Purpose**: Main 3D globe component
- **Details**: Renders sphere, grid lines, company nodes, arcs, handles camera animations

##### `components/Coastlines.tsx`
- **Purpose**: Renders geographic coastlines on the globe
- **Details**: Loads and displays GeoJSON coastline data as 3D lines

##### `components/CompanyLabels.tsx`
- **Purpose**: 3D text labels for companies on the globe
- **Details**: Billboard text that always faces camera, positioned at company locations

##### `components/GlobeControls.tsx`
- **Purpose**: UI controls for globe interactions
- **Details**: Toggles for grid/arcs/nodes, rotation speed, camera controls

##### `components/StarsBackground.tsx`
- **Purpose**: Starfield background effect
- **Details**: Animated stars for space-like aesthetic

#### **Company & Data Components**

##### `components/PrivateCompaniesBootstrap.tsx`
- **Purpose**: Loads private companies data on app initialization
- **Details**: Fetches JSON data and populates global store

##### `components/PrivateCompaniesLayer.tsx`
- **Purpose**: Renders private companies as 3D markers on globe
- **Details**: Displays companies with funding data, handles hover/click interactions

##### `components/CompanyList.tsx`
- **Purpose**: Left sidebar company listing
- **Details**: Searchable, filterable list with company cards, click to fly camera

##### `components/CompanyDetailsPanel.tsx`
- **Purpose**: Right sidebar company detail view
- **Details**: Shows detailed info when company is hovered/selected

##### `components/CompanyTooltip.tsx`
- **Purpose**: Hover tooltip for company markers
- **Details**: Quick info display on mouse hover

##### `components/EventStream.tsx`
- **Purpose**: Event timeline display
- **Details**: Shows chronologically ordered events (funding, launches, etc.)

##### `components/StartupsSection.tsx`
- **Purpose**: Scrollable section for startup companies
- **Details**: Grid view of private robotics startups with details

#### **Market Data Components**

##### `components/RoboticsCryptoIndex.tsx`
- **Purpose**: Displays robotics-crypto correlation index
- **Details**: Shows combined market metrics, charts correlation trends

##### `components/RoboticsIndexChart.tsx`
- **Purpose**: Chart visualization for robotics index
- **Details**: Time-series chart of robotics sector performance

##### `components/ETFComparisonChart.tsx`
- **Purpose**: ETF comparison visualization
- **Details**: Compares robotics-related ETFs side-by-side

##### `components/SingleStocksSection.tsx`
- **Purpose**: Individual stock charts section
- **Details**: Displays multiple stock charts for robotics companies

##### `components/StockChartCard.tsx`
- **Purpose**: Individual stock chart card component
- **Details**: Reusable card showing single stock price history

##### `components/PolymarketSignal.tsx`
- **Purpose**: Polymarket prediction market signals
- **Details**: Shows relevant prediction market odds/trends for robotics

##### `components/FundingChart.tsx`
- **Purpose**: Funding round visualization
- **Details**: Chart showing funding amounts and rounds over time

#### **Visualization Components**

##### `components/HeatmapMap.tsx`
- **Purpose**: 2D heatmap showing power concentration
- **Details**: Geographic heatmap of robotics company density/value

##### `components/StrategicPowerStats.tsx`
- **Purpose**: Statistical summary of strategic power distribution
- **Details**: Metrics for top regions, countries, cities by company count/value

#### **Layout Components**

##### `components/Navbar.tsx`
- **Purpose**: Top navigation bar
- **Details**: App branding, navigation links, user controls

##### `components/Footer.tsx`
- **Purpose**: Bottom footer
- **Details**: Copyright, links, additional information

---

### 📁 **Data Directory** (`data/`)

#### **Raw Data**

##### `data/raw/private_companies.csv`
- **Purpose**: Source CSV file with private company data
- **Details**: Raw company information before processing

#### **Processed Data**

##### `data/processed/private_companies.v1.json`
- **Purpose**: Processed v1 dataset of private companies
- **Details**: Cleaned, validated company data with coordinates

##### `data/processed/private_companies.v1.qa.json`
- **Purpose**: Quality assurance report for v1 dataset
- **Details**: Duplicate merges, coordinate fixes, data quality metrics

##### `data/processed/private_companies.v1.summary.json`
- **Purpose**: Summary statistics for v1 dataset
- **Details**: Totals, percentages, field completion stats

##### `data/processed/private_companies.v2.json`
- **Purpose**: Processed v2 dataset with funding data
- **Details**: Enhanced dataset including funding round information

##### `data/processed/private_companies.v2.qa.json`
- **Purpose**: Quality assurance report for v2 dataset
- **Details**: QA metrics for enhanced dataset

##### `data/processed/private_companies.v2.summary.json`
- **Purpose**: Summary statistics for v2 dataset
- **Details**: Enhanced dataset statistics

##### `data/processed/private_companies.v2.funding_index.json`
- **Purpose**: Funding index calculations
- **Details**: Aggregated funding metrics by time period

##### `data/processed/llm_funding_cache.json`
- **Purpose**: LLM-assisted funding data cache
- **Details**: Cached results from AI parsing of funding information

#### **GeoJSON Data**

##### `data/coastline50.geojson`
- **Purpose**: Coastline boundary data
- **Details**: GeoJSON features for rendering coastlines on globe

##### `data/land50.geojson`
- **Purpose**: Landmass boundary data
- **Details**: GeoJSON features for rendering land on globe

##### `data/mockData.ts`
- **Purpose**: Mock/sample data for development
- **Details**: Sample companies and events for testing UI

#### **Public Data** (`public/data/`)
- **Purpose**: Static files served directly by Next.js
- **Details**: Copies of JSON/GeoJSON files for client-side loading

---

### 📁 **Scripts Directory** (`scripts/`)

##### `scripts/build_private_companies_dataset.ts`
- **Purpose**: Builds v1 private companies dataset
- **Details**: Parses CSV, geocodes locations, deduplicates, validates data

##### `scripts/build_private_companies_v2.ts`
- **Purpose**: Builds v2 dataset with funding information
- **Details**: Enhances v1 data by parsing and attaching funding rounds

##### `scripts/funding_parser.ts`
- **Purpose**: Parser for funding round data (v1)
- **Details**: Extracts funding amounts, dates, rounds from text

##### `scripts/funding_parser_v2.ts`
- **Purpose**: Enhanced funding parser (v2)
- **Details**: Improved parsing logic with better regex/pattern matching

##### `scripts/normalize_funding.ts`
- **Purpose**: Normalizes funding data formats
- **Details**: Standardizes currency, dates, round types

##### `scripts/llm_funding_assist.ts`
- **Purpose**: LLM-assisted funding data extraction
- **Details**: Uses AI to parse complex/unstructured funding information

##### `scripts/geocode.ts`
- **Purpose**: Geocoding utility for addresses
- **Details**: Converts addresses to lat/lon coordinates

##### `scripts/geocode_cache.json`
- **Purpose**: Cache for geocoding results
- **Details**: Stores API responses to avoid redundant geocoding calls

##### `scripts/validate_private_companies_dataset.ts`
- **Purpose**: Validates dataset integrity
- **Details**: Checks for duplicates, missing fields, coordinate issues

---

### 📁 **Store Directory** (`store/`)

##### `store/globeStore.ts`
- **Purpose**: Global state management using Zustand
- **Details**: Manages:
  - Company and event data
  - Filter/search state
  - Globe visualization toggles
  - Selected/hovered companies
  - Private companies data
  - Heatmap focus
  - Event filters

---

### 📁 **Types Directory** (`types/`)

##### `types/index.ts`
- **Purpose**: Core TypeScript type definitions
- **Details**: Defines `Company`, `Event`, `GlobeState` interfaces

##### `types/companies.ts`
- **Purpose**: Company-related type definitions
- **Details**: Defines `PrivateCompany`, `CompanyHQ`, QA report types

##### `types/funding.ts`
- **Purpose**: Funding data type definitions
- **Details**: Defines `FundingRoundData`, funding-related interfaces

---

### 📁 **Utils Directory** (`utils/`)

##### `utils/coordinates.ts`
- **Purpose**: Coordinate conversion utilities
- **Details**: 
  - `latLonToVector3()`: Convert geographic to 3D coordinates
  - `vector3ToLatLon()`: Convert 3D to geographic coordinates
  - `createArc()`: Generate great circle arcs
  - `getCameraPositionForLocation()`: Calculate camera positions

##### `utils/companyHelpers.ts`
- **Purpose**: Company data manipulation helpers
- **Details**: Filtering, sorting, grouping utilities

##### `utils/companyMapping.ts`
- **Purpose**: Company data mapping/transformation
- **Details**: Converts between different company data formats

##### `utils/polymarketMapping.ts`
- **Purpose**: Polymarket data mapping
- **Details**: Transforms Polymarket API responses to app format

---

### 📁 **Other Files**

##### `next-env.d.ts`
- **Purpose**: Next.js TypeScript declarations
- **Details**: Auto-generated type definitions

##### `tsconfig.tsbuildinfo`
- **Purpose**: TypeScript build cache
- **Details**: Incremental compilation information

---

## Key Features

### 1. **3D Globe Visualization**
- Interactive 3D globe using Three.js
- Company markers positioned by headquarters
- Great circle arcs connecting major hubs
- Grid lines and coastlines for geographic context

### 2. **Multi-Source Data Integration**
- Private company database with funding data
- Public stock market data (Yahoo Finance)
- Polymarket prediction market signals
- Real-time API endpoints for live data

### 3. **Strategic Intelligence**
- Heatmap showing geographic power concentration
- Statistical analysis by region/country/city
- Funding trends and round tracking
- Event timeline for industry activities

### 4. **Market Analytics**
- Robotics index calculations
- ETF comparisons
- Crypto correlation tracking
- Historical price analysis

### 5. **Interactive Features**
- Click companies to fly camera to location
- Search and filter company lists
- Hover tooltips with quick info
- Detailed company panels

---

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **3D Graphics**: Three.js, React Three Fiber, Drei
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Data Fetching**: Next.js API Routes
- **Charts**: Custom React components
- **Data Processing**: CSV parsing, GeoJSON processing

---

## Data Flow

1. **Initialization**: `PrivateCompaniesBootstrap` loads JSON data → `globeStore`
2. **Globe Rendering**: `GlobeScene` → `Globe` → `PrivateCompaniesLayer` displays markers
3. **Interactions**: User clicks/hovers → Store updates → Components re-render
4. **API Calls**: Components fetch from `/api/*` routes → Display in charts/panels
5. **Data Updates**: Scripts process CSV → Generate JSON → Loaded at runtime

---

This project provides a comprehensive intelligence platform for monitoring and analyzing the global robotics industry through an interactive 3D visualization interface.

