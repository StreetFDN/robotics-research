'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useGlobeStore } from '@/store/globeStore';
import { Event, Company } from '@/types';
import { privateCompanyToCompany } from '@/utils/companyMapping';

const HEAT_HALF_LIFE_DAYS = 14;
const HEAT_SPREAD_RADIUS_DEG = 5; // Degrees for Gaussian falloff
const BASELINE_HEAT_DEFAULT = 6; // Default baseline heat per company
const BASELINE_HEAT_MIN = 4;
const BASELINE_HEAT_MAX = 12;

// DEBUG: Render stage toggle (1-5) - only active in debug mode
// 1 = ocean + test lines ONLY
// 2 = stage1 + coastlines
// 3 = stage2 + heat
// 4 = stage3 + noise
// 5 = full pipeline (base + coastlines + heat + noise)
const PRODUCTION_STAGE = 5; // Production mode always shows Stage 5

// Debug mode detection: query param or localStorage
const getDebugMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debug') === '1') return true;
  try {
    return localStorage.getItem('heatmapDebug') === 'true';
  } catch {
    return false;
  }
};

const DEBUG_MODE = getDebugMode();
const HEAT_RESOLUTION_SCALE = 0.5; // Render heat at 0.5x for soft blur effect
const DECAY_UPDATE_INTERVAL_MS = 60000; // Update decay every minute (10s in debug)

// Calculate baseline heat contribution from company
function getBaselineHeatContribution(company: Company): number {
  // Weight by activityScore if available (4-12 range)
  if (company.activityScore != null && company.activityScore > 0) {
    // Map activityScore (0-100) to heat range (4-12)
    const normalized = company.activityScore / 100;
    return BASELINE_HEAT_MIN + normalized * (BASELINE_HEAT_MAX - BASELINE_HEAT_MIN);
  }
  return BASELINE_HEAT_DEFAULT;
}

// Calculate heat contribution from event
function getEventHeatContribution(event: Event): number {
  switch (event.type) {
    case 'funding':
      if (event.funding_usd != null && event.funding_usd > 0) {
        return Math.log10(event.funding_usd) * 20;
      }
      return 20;
    case 'partnership':
      return 30;
    case 'product':
      return 15;
    case 'hiring':
      return 10; // New startup equivalent
    default:
      return 5;
  }
}

// Calculate heat decay over time
function getTimeDecay(timestamp: Date, halfLifeDays: number): number {
  const now = new Date();
  const daysSince = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, daysSince / halfLifeDays);
}

// Gaussian falloff (precomputed kernel for performance)
const GAUSSIAN_KERNEL_CACHE = new Map<string, number[]>();
function gaussianFalloff(distance: number, radius: number): number {
  // Cache kernel for common radius values
  const cacheKey = radius.toFixed(2);
  if (!GAUSSIAN_KERNEL_CACHE.has(cacheKey)) {
    // Precompute kernel for distances 0..radius*2 in 0.1 degree steps
    const kernel: number[] = [];
    for (let d = 0; d <= radius * 2; d += 0.1) {
      kernel.push(Math.exp(-(d * d) / (2 * radius * radius)));
    }
    GAUSSIAN_KERNEL_CACHE.set(cacheKey, kernel);
  }
  
  // Use cached kernel or compute directly
  if (distance > radius * 2) return 0;
  const kernel = GAUSSIAN_KERNEL_CACHE.get(cacheKey);
  if (kernel) {
    const idx = Math.floor(distance / 0.1);
    return kernel[Math.min(idx, kernel.length - 1)] || 0;
  }
  return Math.exp(-(distance * distance) / (2 * radius * radius));
}

// Color ramp: muted teal → amber → muted red (polished for intelligence aesthetic)
function getHeatColor(value: number, maxHeat: number): { r: number; g: number; b: number; a: number } {
  if (maxHeat === 0 || value === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const normalized = Math.min(1, value / maxHeat);
  
  let r, g, b;
  if (normalized < 0.33) {
    // Muted teal (#00B8A3) to amber (#FFB020)
    const t = normalized / 0.33;
    r = Math.floor(0 + t * 255);
    g = Math.floor(184 + t * 8);
    b = Math.floor(163 - t * 131);
  } else if (normalized < 0.66) {
    // Amber to muted red (#FF4444)
    const t = (normalized - 0.33) / 0.33;
    r = 255;
    g = Math.floor(176 - t * 108);
    b = Math.floor(32 - t * 32);
  } else {
    // Muted red (saturated)
    r = 255;
    g = 68;
    b = 68;
  }
  
  // Increased max alpha for better visibility (cap at ~0.7 = 178/255)
  const alpha = Math.min(178, normalized * 178);
  return { r, g, b, a: alpha };
}

interface HeatEmitter {
  lat: number;
  lon: number;
  intensity: number;
  type: 'baseline' | 'event';
  source?: Company | Event;
}

export default function HeatmapMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { events, companies, privateCompanies, heatmapFocus, setHeatmapFocus } = useGlobeStore();
  const [coastlineData, setCoastlineData] = useState<any>(null);
  const [landData, setLandData] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    intensity: number;
    companies: Company[];
    events: Event[];
  } | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // Handle heatmap focus from store
  useEffect(() => {
    if (heatmapFocus && canvasSize.width > 0 && canvasSize.height > 0) {
      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvasSize.width / dpr;
      const cssHeight = canvasSize.height / dpr;
      const targetAspect = 2;
      const canvasAspect = cssWidth / cssHeight;
      
      let mapRect: { x: number; y: number; w: number; h: number };
      if (canvasAspect > targetAspect) {
        mapRect = { h: cssHeight, w: cssHeight * targetAspect, x: (cssWidth - cssHeight * targetAspect) / 2, y: 0 };
      } else {
        mapRect = { w: cssWidth, h: cssWidth / targetAspect, x: 0, y: (cssHeight - cssWidth / targetAspect) / 2 };
      }
      
      // Convert lat/lon to mapRect coordinates
      const mapX = ((heatmapFocus.lon + 180) / 360) * mapRect.w;
      const mapY = ((90 - heatmapFocus.lat) / 180) * mapRect.h;
      
      // Center the focus point in the viewport
      const viewportCenterX = cssWidth / 2;
      const viewportCenterY = cssHeight / 2;
      
      // Calculate transform to center the focus point
      const currentScale = transform.scale;
      const targetX = viewportCenterX - (mapRect.x + mapX) * currentScale;
      const targetY = viewportCenterY - (mapRect.y + mapY) * currentScale;
      
      setTransform({ x: targetX, y: targetY, scale: currentScale });
      
      // Clear focus after applying (one-time action)
      setTimeout(() => setHeatmapFocus(null), 100);
    }
  }, [heatmapFocus, canvasSize, transform.scale, setHeatmapFocus]);
  const hasWarnedSizeTooSmall = useRef(false);
  const hasWarnedLandMissing = useRef(false);
  const interactionLayerRef = useRef<HTMLDivElement>(null);
  // Initialize stage: production mode = 5, debug mode = from localStorage or default
  const getInitialStage = (): number => {
    if (!DEBUG_MODE) return PRODUCTION_STAGE;
    try {
      const saved = localStorage.getItem('heatmapRenderStage');
      if (saved) {
        const stage = parseInt(saved, 10);
        if (stage >= 1 && stage <= 5) return stage;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 5; // Default debug stage
  };
  
  const [renderStage, setRenderStage] = useState(getInitialStage);
  const renderRequestRef = useRef<number | null>(null);
  const [timeNow, setTimeNow] = useState(new Date()); // For decay updates
  const coastlineCacheRef = useRef<{
    mapRect: { w: number; h: number };
    lineStrings: Array<{ coords: number[][]; bbox: any }>;
  } | null>(null);
  
  // Periodic decay update (makes it feel "always online")
  useEffect(() => {
    if (!DEBUG_MODE) {
      const interval = setInterval(() => {
        setTimeNow(new Date());
      }, DECAY_UPDATE_INTERVAL_MS);
      return () => clearInterval(interval);
    } else {
      // Faster updates in debug mode
      const interval = setInterval(() => {
        setTimeNow(new Date());
      }, 10000);
      return () => clearInterval(interval);
    }
  }, []);

  // Load GeoJSON data
  useEffect(() => {
    // Load coastline (required)
    fetch('/data/coastline50.geojson')
      .then((res) => {
        console.log('[HeatmapMap] Coastline fetch status:', res.status);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const featureCount = data?.features?.length || 0;
        console.log('[HeatmapMap] Coastline loaded:', featureCount, 'features');
        setCoastlineData(data);
      })
      .catch((err) => {
        console.error('[HeatmapMap] Failed to load coastline data:', err);
        setCoastlineData(null);
      });

    // Load land (optional - only warn once if missing)
    fetch('/data/land50.geojson')
      .then((res) => {
        if (res.status === 404) {
          if (!hasWarnedLandMissing.current) {
            console.warn(
              '[HeatmapMap] land50.geojson not found (404); continuing with coastline-only map.\n' +
              'To enable land fill, add /public/data/land50.geojson'
            );
            hasWarnedLandMissing.current = true;
          }
          setLandData(null);
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data) {
          const featureCount = data?.features?.length || 0;
          console.log('[HeatmapMap] Land loaded:', featureCount, 'features');
          setLandData(data);
        }
      })
      .catch((err) => {
        if (!hasWarnedLandMissing.current) {
          console.warn('[HeatmapMap] Failed to load land data:', err);
          hasWarnedLandMissing.current = true;
        }
        setLandData(null);
      });
  }, []);

  // Update canvas size based on container using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const updateSize = () => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.floor(rect.width * dpr);
      const height = Math.floor(rect.height * dpr);
      
      // Only set size if valid (>= 2px)
      if (width >= 2 && height >= 2) {
        setCanvasSize({ width, height });
        hasWarnedSizeTooSmall.current = false; // Reset warning flag when size becomes valid
      } else if (rect.width === 0 && rect.height === 0) {
        // Only warn once, and only if size is actually 0 (not just small)
        // Silently wait for ResizeObserver to detect when size becomes valid
        // No warning needed - ResizeObserver will trigger when container gets size
      }
    };

    // Initial measurement with slight delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      updateSize();
    }, 0);

    // Use ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateSize();
      }
    });

    resizeObserver.observe(containerRef.current);

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateSize);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Create unified heat emitters from companies (baseline) and events (spikes)
  const heatEmitters = useMemo(() => {
    const emitters: HeatEmitter[] = [];

    // Convert privateCompanies to Company format and merge with companies
    const convertedPrivateCompanies = privateCompanies.map(privateCompanyToCompany);
    const allCompanies = [...companies, ...convertedPrivateCompanies];

    // Filter out crypto/tradfi companies (exclude tags: crypto, blockchain, defi, tradfi, finance, fintech)
    const excludeTags = ['crypto', 'blockchain', 'defi', 'tradfi', 'finance', 'fintech'];
    const roboticsCompanies = allCompanies.filter((c) => {
      const hasExcludedTag = c.tags?.some((tag) => 
        excludeTags.some((excludeTag) => tag.toLowerCase().includes(excludeTag.toLowerCase()))
      );
      return !hasExcludedTag;
    });

    // 1) Baseline emitters from companies (always-on, no decay)
    const validCompanies = roboticsCompanies.filter(
      (c) =>
        c.hq_lat != null &&
        c.hq_lon != null &&
        !isNaN(c.hq_lat) &&
        !isNaN(c.hq_lon) &&
        c.hq_lat >= -90 &&
        c.hq_lat <= 90 &&
        c.hq_lon >= -180 &&
        c.hq_lon <= 180
    );

    validCompanies.forEach((company) => {
      const intensity = getBaselineHeatContribution(company);
      
      // Add HQ location
      emitters.push({
        lat: company.hq_lat,
        lon: company.hq_lon,
        intensity,
        type: 'baseline',
        source: company,
      });

      // Add additional locations if present
      if (company.locations) {
        company.locations.forEach((location) => {
          if (
            location.lat != null &&
            location.lon != null &&
            !isNaN(location.lat) &&
            !isNaN(location.lon) &&
            location.lat >= -90 &&
            location.lat <= 90 &&
            location.lon >= -180 &&
            location.lon <= 180
          ) {
            emitters.push({
              lat: location.lat,
              lon: location.lon,
              intensity,
              type: 'baseline',
              source: company,
            });
          }
        });
      }
    });

    // 2) Event emitters (time-decaying spikes)
    const validEvents = events.filter(
      (e) =>
        e.lat != null &&
        e.lon != null &&
        !isNaN(e.lat) &&
        !isNaN(e.lon) &&
        e.lat >= -90 &&
        e.lat <= 90 &&
        e.lon >= -180 &&
        e.lon <= 180
    );

    validEvents.forEach((event) => {
      const baseIntensity = getEventHeatContribution(event);
      const timeDecay = getTimeDecay(event.timestamp, HEAT_HALF_LIFE_DAYS);
      const intensity = baseIntensity * timeDecay;

      emitters.push({
        lat: event.lat!,
        lon: event.lon!,
        intensity,
        type: 'event',
        source: event,
      });
    });

    return emitters;
  }, [companies, privateCompanies, events]);

  // Calculate heat map from unified emitters
  // Heat buffer is mapRect-sized (not full canvas)
  const heatMap = useMemo(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) {
      return { data: null, width: 0, height: 0 };
    }

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvasSize.width / dpr;
    const cssHeight = canvasSize.height / dpr;
    
    // Compute mapRect dimensions (2:1 aspect ratio)
    const targetAspect = 2;
    const canvasAspect = cssWidth / cssHeight;
    let mapRectW: number, mapRectH: number;
    if (canvasAspect > targetAspect) {
      mapRectH = cssHeight;
      mapRectW = cssHeight * targetAspect;
    } else {
      mapRectW = cssWidth;
      mapRectH = cssWidth / targetAspect;
    }
    
    // Heat buffer is mapRect-sized (in CSS pixels)
    const width = Math.floor(mapRectW);
    const height = Math.floor(mapRectH);
    const heatData = new Float32Array(width * height);

    // Debug logging
    const baselineEmitters = heatEmitters.filter((e) => e.type === 'baseline');
    const eventEmitters = heatEmitters.filter((e) => e.type === 'event');
    console.log('[HeatmapMap] Baseline emitters:', baselineEmitters.length);
    console.log('[HeatmapMap] Event emitters:', eventEmitters.length);
    console.log('[HeatmapMap] Canvas size:', width, 'x', height);

    // Process each heat emitter
    heatEmitters.forEach((emitter) => {
      const { lat, lon, intensity } = emitter;

      // Convert lat/lon to mapRect coordinates (NOT full canvas)
      // centerX and centerY are in mapRect space (0..width, 0..height)
      const centerX = ((lon + 180) / 360) * width;
      const centerY = ((90 - lat) / 180) * height;
      const radiusPixels = (HEAT_SPREAD_RADIUS_DEG / 180) * height;

      const minX = Math.max(0, Math.floor(centerX - radiusPixels));
      const maxX = Math.min(width - 1, Math.ceil(centerX + radiusPixels));
      const minY = Math.max(0, Math.floor(centerY - radiusPixels));
      const maxY = Math.min(height - 1, Math.ceil(centerY + radiusPixels));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          // Convert pixel coords back to lat/lon for distance calculation
          const pixelLon = (x / width) * 360 - 180;
          const pixelLat = 90 - (y / height) * 180;

          // Great circle distance approximation (degrees)
          const dLat = pixelLat - lat;
          const dLon = pixelLon - lon;
          const distance = Math.sqrt(dLat * dLat + dLon * dLon);

          if (distance <= HEAT_SPREAD_RADIUS_DEG) {
            const falloff = gaussianFalloff(distance, HEAT_SPREAD_RADIUS_DEG);
            const idx = y * width + x;
            heatData[idx] += intensity * falloff;
          }
        }
      }
    });

    // Find max heat for debug
    let maxHeat = 0;
    for (let i = 0; i < heatData.length; i++) {
      maxHeat = Math.max(maxHeat, heatData[i]);
    }
    if (DEBUG_MODE) {
      console.log('[HeatmapMap] Max heat:', maxHeat.toFixed(2));
    }

    return { data: heatData, width, height };
  }, [heatEmitters, canvasSize, timeNow]); // Recompute when time updates for decay or data changes

  // Render map (debounced)
  const renderMap = useCallback(() => {
    // Debounce render requests
    if (renderRequestRef.current) {
      cancelAnimationFrame(renderRequestRef.current);
    }
    
    renderRequestRef.current = requestAnimationFrame(() => {
      renderRequestRef.current = null;
      
      const canvas = canvasRef.current;
      const container = containerRef.current;
      
      if (!canvas) {
        console.log('[HeatmapMap] Canvas ref not available');
        return;
      }

      // If canvasSize is invalid, try to measure container directly
      let cssWidth = 0;
      let cssHeight = 0;
      
      if (canvasSize.width < 2 || canvasSize.height < 2) {
        if (container) {
          const rect = container.getBoundingClientRect();
          cssWidth = rect.width;
          cssHeight = rect.height;
          
          if (cssWidth >= 2 && cssHeight >= 2) {
            const dpr = window.devicePixelRatio || 1;
            const width = Math.floor(cssWidth * dpr);
            const height = Math.floor(cssHeight * dpr);
            console.log('[HeatmapMap] Using direct container measurement:', { cssWidth, cssHeight, width, height });
            setCanvasSize({ width, height });
            return; // Will re-render with new size
          } else {
            // Only log once per mount to avoid spam
            if (!hasWarnedSizeTooSmall.current) {
              console.log('[HeatmapMap] Canvas size too small, skipping render:', { cssWidth, cssHeight });
              hasWarnedSizeTooSmall.current = true;
            }
            return;
          }
        } else {
          console.log('[HeatmapMap] Canvas size too small and no container, skipping render');
          return;
        }
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        console.error('[HeatmapMap] Failed to get 2D context');
        return;
      }
      // TypeScript: ctx is guaranteed non-null after the check above
      const ctxNonNull = ctx;

      const dpr = window.devicePixelRatio || 1;
      // Use CSS dimensions for drawing coordinates
      cssWidth = canvasSize.width / dpr;
      cssHeight = canvasSize.height / dpr;

      const bufferWidth = canvasSize.width;
      const bufferHeight = canvasSize.height;

      // Compute letterboxed mapRect (2:1 aspect ratio)
      const targetAspect = 2; // Equirectangular is 2:1
      const canvasAspect = cssWidth / cssHeight;
      
      let mapRect: { x: number; y: number; w: number; h: number };
      if (canvasAspect > targetAspect) {
        // Canvas is wider than 2:1 - letterbox vertically
        mapRect = {
          h: cssHeight,
          w: cssHeight * targetAspect,
          x: (cssWidth - cssHeight * targetAspect) / 2,
          y: 0,
        };
      } else {
        // Canvas is taller than 2:1 - letterbox horizontally
        mapRect = {
          w: cssWidth,
          h: cssWidth / targetAspect,
          x: 0,
          y: (cssHeight - cssWidth / targetAspect) / 2,
        };
      }

      console.log('[HeatmapMap] Rendering stage', renderStage, 'with size:', {
        cssWidth,
        cssHeight,
        bufferWidth,
        bufferHeight,
        dpr,
        mapRect,
      });

      // Set canvas buffer size (DPR pixels)
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      // CRITICAL: Reset ALL context state at start of EVERY render
      ctxNonNull.setTransform(1, 0, 0, 1, 0, 0);
      ctxNonNull.globalAlpha = 1;
      ctxNonNull.globalCompositeOperation = 'source-over';
      ctxNonNull.imageSmoothingEnabled = true;
      ctxNonNull.clearRect(0, 0, bufferWidth, bufferHeight);

      // Apply DPR scale transform ONCE - from now on, use CSS pixels
      ctxNonNull.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Render base map (ocean + coastlines) - called by all stages
      const renderBase = () => {
        // Ocean background (full canvas)
        ctxNonNull.fillStyle = '#0D1015';
        ctxNonNull.fillRect(0, 0, cssWidth, cssHeight);
        
        // Fill mapRect with slightly lighter ocean (subtle boundary)
        ctxNonNull.fillStyle = '#0F1218';
        ctxNonNull.fillRect(mapRect.x, mapRect.y, mapRect.w, mapRect.h);
        
        // Coastlines (Stage 2+)
        if (renderStage >= 2) {
          ctxNonNull.save();
          ctxNonNull.globalCompositeOperation = 'source-over';
          ctxNonNull.globalAlpha = 1;
          
          if (coastlineData && coastlineData.features) {
            // Performance: Cache extracted lineStrings per mapRect size
            const mapRectKey = `${mapRect.w.toFixed(0)}x${mapRect.h.toFixed(0)}`;
            let validLineStrings: Array<{ coords: number[][]; bbox: any }>;
            
            if (coastlineCacheRef.current && 
                coastlineCacheRef.current.mapRect.w === mapRect.w && 
                coastlineCacheRef.current.mapRect.h === mapRect.h) {
              validLineStrings = coastlineCacheRef.current.lineStrings;
            } else {
              // Extract and filter lineStrings
              const extractLineStrings = (geojson: any): number[][][] => {
                const lineStrings: number[][][] = [];
                const processFeature = (feature: any) => {
                  if (!feature.geometry) return;
                  if (feature.geometry.type === 'LineString') {
                    lineStrings.push(feature.geometry.coordinates);
                  } else if (feature.geometry.type === 'MultiLineString') {
                    feature.geometry.coordinates.forEach((lineString: number[][]) => {
                      lineStrings.push(lineString);
                    });
                  }
                };
                if (geojson.type === 'FeatureCollection') {
                  geojson.features.forEach(processFeature);
                }
                return lineStrings;
              };
              
              const computeBbox = (lineString: number[][], asLonLat: boolean) => {
                let minLon = Infinity, maxLon = -Infinity;
                let minLat = Infinity, maxLat = -Infinity;
                lineString.forEach((coord) => {
                  const [a, b] = coord;
                  const lon = asLonLat ? a : b;
                  const lat = asLonLat ? b : a;
                  minLon = Math.min(minLon, lon);
                  maxLon = Math.max(maxLon, lon);
                  minLat = Math.min(minLat, lat);
                  maxLat = Math.max(maxLat, lat);
                });
                return { minLon, maxLon, minLat, maxLat, lonSpan: maxLon - minLon, latSpan: maxLat - minLat };
              };
              
              const allLineStrings = extractLineStrings(coastlineData);
              const MIN_BBOX_SPAN = 10;
              const MAX_LINESTRINGS_TO_DRAW = 300;
              validLineStrings = [];
              
              allLineStrings.forEach((lineString) => {
                if (lineString.length < 2) return;
                const bboxLonLat = computeBbox(lineString, true);
                const bboxLatLon = computeBbox(lineString, false);
                const useLonLat = bboxLonLat.lonSpan >= bboxLatLon.lonSpan;
                const bbox = useLonLat ? bboxLonLat : bboxLatLon;
                const validBounds = bbox.minLon >= -180 && bbox.maxLon <= 180 && bbox.minLat >= -90 && bbox.maxLat <= 90;
                const hasSignificantSpan = bbox.lonSpan >= MIN_BBOX_SPAN || bbox.latSpan >= MIN_BBOX_SPAN;
                if (validBounds && hasSignificantSpan) {
                  const coords = useLonLat ? lineString : lineString.map(([a, b]) => [b, a]);
                  validLineStrings.push({ coords, bbox });
                }
              });
              
              coastlineCacheRef.current = {
                mapRect: { w: mapRect.w, h: mapRect.h },
                lineStrings: validLineStrings.slice(0, MAX_LINESTRINGS_TO_DRAW),
              };
              validLineStrings = coastlineCacheRef.current.lineStrings;
            }
            
            // Dual-pass coastline rendering (matches globe style)
            // Pass 1: Faint glow (thicker line, low alpha)
            ctxNonNull.strokeStyle = '#00B8A3';
            ctxNonNull.lineWidth = 2;
            ctxNonNull.globalAlpha = 0.12; // Subtle glow to match globe softness
            validLineStrings.forEach((item) => {
              const { coords } = item;
              ctxNonNull.beginPath();
              coords.forEach(([lon, lat], pointIdx) => {
                const x = mapRect.x + ((lon + 180) / 360) * mapRect.w;
                const y = mapRect.y + ((90 - lat) / 180) * mapRect.h;
                if (pointIdx === 0) ctxNonNull.moveTo(x, y);
                else ctxNonNull.lineTo(x, y);
              });
              ctxNonNull.stroke();
            });
            
            // Pass 2: Crisp line (thin, matches globe opacity 0.35)
            ctxNonNull.strokeStyle = '#00B8A3';
            ctxNonNull.lineWidth = 1;
            ctxNonNull.globalAlpha = 0.35; // Match globe coastline opacity
            validLineStrings.forEach((item) => {
              const { coords } = item;
              ctxNonNull.beginPath();
              coords.forEach(([lon, lat], pointIdx) => {
                const x = mapRect.x + ((lon + 180) / 360) * mapRect.w;
                const y = mapRect.y + ((90 - lat) / 180) * mapRect.h;
                if (pointIdx === 0) ctxNonNull.moveTo(x, y);
                else ctxNonNull.lineTo(x, y);
              });
              ctxNonNull.stroke();
            });
          }
          ctxNonNull.restore();
        }
        
        // Subtle lat/lon grid (matches globe grid style)
        if (renderStage >= 2 && !DEBUG_MODE) {
          ctxNonNull.save();
          ctxNonNull.strokeStyle = '#2A3A4A';
          ctxNonNull.lineWidth = 0.5;
          ctxNonNull.globalAlpha = 0.3; // Match globe grid opacity
          
          // Vertical lines (longitude) every 30 degrees (matches globe)
          for (let lon = -180; lon <= 180; lon += 30) {
            const x = mapRect.x + ((lon + 180) / 360) * mapRect.w;
            ctxNonNull.beginPath();
            ctxNonNull.moveTo(x, mapRect.y);
            ctxNonNull.lineTo(x, mapRect.y + mapRect.h);
            ctxNonNull.stroke();
          }
          
          // Horizontal lines (latitude) every 20 degrees (matches globe)
          for (let lat = -80; lat <= 80; lat += 20) {
            const y = mapRect.y + ((90 - lat) / 180) * mapRect.h;
            ctxNonNull.beginPath();
            ctxNonNull.moveTo(mapRect.x, y);
            ctxNonNull.lineTo(mapRect.x + mapRect.w, y);
            ctxNonNull.stroke();
          }
          
          ctxNonNull.restore();
        }
        
        // DEBUG: Draw mapRect border and center point
        if (DEBUG_MODE) {
          ctxNonNull.strokeStyle = '#00B8A3';
          ctxNonNull.lineWidth = 1;
          ctxNonNull.strokeRect(mapRect.x, mapRect.y, mapRect.w, mapRect.h);
          const centerX = mapRect.x + mapRect.w / 2;
          const centerY = mapRect.y + mapRect.h / 2;
          ctxNonNull.fillStyle = '#00FFFF';
          ctxNonNull.beginPath();
          ctxNonNull.arc(centerX, centerY, 3, 0, Math.PI * 2);
          ctxNonNull.fill();
          ctxNonNull.strokeStyle = '#00B8A3';
          ctxNonNull.lineWidth = 2;
          ctxNonNull.beginPath();
          ctxNonNull.moveTo(10, 10);
          ctxNonNull.lineTo(cssWidth - 10, cssHeight - 10);
          ctxNonNull.moveTo(cssWidth - 10, 10);
          ctxNonNull.lineTo(10, cssHeight - 10);
          ctxNonNull.stroke();
        }
      };

      // STAGE 1: Base map only (debug only)
      if (renderStage >= 1 && renderStage < 2) {
        if (DEBUG_MODE) console.log('[HeatmapMap] STAGE 1: Rendering base map');
        renderBase();
      }

      // TEMPORARILY DISABLE pan/zoom transform for Stage 2/3 debugging
      // Transform will be reintroduced after coastlines and heat render correctly
      const useTransform = false; // Set to false for debugging
      
      if (useTransform) {
        ctxNonNull.save();
        ctxNonNull.translate(transform.x, transform.y);
        ctxNonNull.scale(transform.scale, transform.scale);
      }

      // STAGE 5: Same as Stage 3 for now (heat only, no land fill until coastlines work)
      // STAGE 5 ONLY: Land fill (TEMPORARILY DISABLED - enable only after base map works)
      if (renderStage >= 5 && false) { // Disabled for now
        ctxNonNull.save();
        ctxNonNull.globalCompositeOperation = 'source-over';
        if (landData && landData.features) {
          console.log('[HeatmapMap] STAGE 5: Drawing land fill from', landData.features.length, 'features');
          ctxNonNull.fillStyle = '#151A25';
          landData.features.forEach((feature: any) => {
            ctxNonNull.beginPath();
            if (feature.geometry.type === 'Polygon') {
              const coords = feature.geometry.coordinates[0] as number[][];
              coords.forEach(([lon, lat], idx) => {
                const x = ((lon + 180) / 360) * cssWidth;
                const y = ((90 - lat) / 180) * cssHeight;
                if (idx === 0) {
                  ctxNonNull.moveTo(x, y);
                } else {
                  ctxNonNull.lineTo(x, y);
                }
              });
              ctxNonNull.closePath();
            } else if (feature.geometry.type === 'MultiPolygon') {
              feature.geometry.coordinates.forEach((polygon: number[][][]) => {
                const coords = polygon[0];
                coords.forEach(([lon, lat], idx) => {
                  const x = ((lon + 180) / 360) * cssWidth;
                  const y = ((90 - lat) / 180) * cssHeight;
                  if (idx === 0) {
                    ctxNonNull.moveTo(x, y);
                  } else {
                    ctxNonNull.lineTo(x, y);
                  }
                });
                ctxNonNull.closePath();
              });
            }
            ctxNonNull.fill();
          });
        }
        ctxNonNull.restore();
      }

    // STAGE 3: Heatmap overlay - INCLUDES Stage 1 + 2
    if (renderStage >= 3) {
      // Render base map first
      renderBase();
      
      // DEBUG: Force a visible heat spot at center (only in debug mode)
      if (DEBUG_MODE) {
        const centerX = mapRect.x + mapRect.w / 2;
        const centerY = mapRect.y + mapRect.h / 2;
        const gradient = ctxNonNull.createRadialGradient(centerX, centerY, 0, centerX, centerY, 50);
        gradient.addColorStop(0, 'rgba(0, 184, 163, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 184, 163, 0)');
        ctxNonNull.fillStyle = gradient;
        ctxNonNull.beginPath();
        ctxNonNull.arc(centerX, centerY, 50, 0, Math.PI * 2);
        ctxNonNull.fill();
      }
      
      // Recalculate heat if size changed - heatMap must match mapRect size
      const mapRectW = Math.floor(mapRect.w);
      const mapRectH = Math.floor(mapRect.h);
      const heatData = heatMap.data && heatMap.width === mapRectW && heatMap.height === mapRectH
        ? heatMap.data
        : null;
      
      if (heatData) {
        let maxHeat = 0;
        for (let i = 0; i < heatData.length; i++) {
          maxHeat = Math.max(maxHeat, heatData[i]);
        }

        if (DEBUG_MODE) {
          console.log('[HeatmapMap] STAGE 3: Max heat:', maxHeat.toFixed(2), 'Heat data size:', mapRectW, 'x', mapRectH);
        }

        if (maxHeat > 0) {
          // Performance: Render heat at reduced resolution for soft blur effect
          const heatW = Math.floor(mapRectW * HEAT_RESOLUTION_SCALE);
          const heatH = Math.floor(mapRectH * HEAT_RESOLUTION_SCALE);
          
          // Create offscreen canvas for heat (reduced resolution)
          const heatCanvas = document.createElement('canvas');
          heatCanvas.width = heatW;
          heatCanvas.height = heatH;
          const heatCtx = heatCanvas.getContext('2d');
          
          if (heatCtx) {
            // Fill heat canvas with heat data (downsampled)
            const heatImageData = heatCtx.createImageData(heatW, heatH);
            const data = heatImageData.data;
            
            // Downsample heat data
            for (let y = 0; y < heatH; y++) {
              for (let x = 0; x < heatW; x++) {
                // Sample from full resolution heat map
                const srcX = Math.floor((x / heatW) * mapRectW);
                const srcY = Math.floor((y / heatH) * mapRectH);
                const srcIdx = srcY * mapRectW + srcX;
                const heat = heatData[srcIdx] || 0;
                
                const color = getHeatColor(heat, maxHeat);
                const idx = (y * heatW + x) * 4;
                data[idx] = color.r;
                data[idx + 1] = color.g;
                data[idx + 2] = color.b;
                data[idx + 3] = color.a;
              }
            }
            
            heatCtx.putImageData(heatImageData, 0, 0);
            
            // Draw heat canvas scaled up (soft blur via imageSmoothingEnabled)
            ctxNonNull.save();
            ctxNonNull.imageSmoothingEnabled = true;
            ctxNonNull.globalCompositeOperation = 'screen';
            ctxNonNull.globalAlpha = 1;
            ctxNonNull.drawImage(heatCanvas, mapRect.x, mapRect.y, mapRect.w, mapRect.h);
            ctxNonNull.globalCompositeOperation = 'source-over';
            ctxNonNull.globalAlpha = 1;
            ctxNonNull.restore();
            
            // Add subtle inner glow to high-intensity regions (amber → soft red)
            // This creates a soft radial glow effect for hotspots
            ctxNonNull.save();
            ctxNonNull.globalCompositeOperation = 'screen';
            
            // Find high-intensity regions (top 20% of heat values)
            const highIntensityThreshold = maxHeat * 0.8;
            const glowRadius = 30; // Pixels for glow effect
            
            // Sample heat data to find hotspots (every 10 pixels for performance)
            for (let y = 0; y < mapRectH; y += 10) {
              for (let x = 0; x < mapRectW; x += 10) {
                const idx = y * mapRectW + x;
                const heat = heatData[idx] || 0;
                
                if (heat >= highIntensityThreshold) {
                  const mapX = mapRect.x + (x / mapRectW) * mapRect.w;
                  const mapY = mapRect.y + (y / mapRectH) * mapRect.h;
                  const intensity = (heat - highIntensityThreshold) / (maxHeat - highIntensityThreshold);
                  
                  // Create radial gradient for inner glow (amber to soft red)
                  const gradient = ctxNonNull.createRadialGradient(
                    mapX, mapY, 0,
                    mapX, mapY, glowRadius
                  );
                  
                  // Amber glow for medium-high intensity, soft red for very high
                  if (intensity > 0.5) {
                    // Soft red glow for highest intensity
                    gradient.addColorStop(0, `rgba(255, 68, 68, ${0.15 * intensity})`);
                    gradient.addColorStop(0.5, `rgba(255, 176, 32, ${0.08 * intensity})`);
                    gradient.addColorStop(1, 'rgba(255, 176, 32, 0)');
                  } else {
                    // Amber glow for medium-high intensity
                    gradient.addColorStop(0, `rgba(255, 176, 32, ${0.12 * intensity})`);
                    gradient.addColorStop(0.5, `rgba(255, 176, 32, ${0.06 * intensity})`);
                    gradient.addColorStop(1, 'rgba(255, 176, 32, 0)');
                  }
                  
                  ctxNonNull.fillStyle = gradient;
                  ctxNonNull.beginPath();
                  ctxNonNull.arc(mapX, mapY, glowRadius, 0, Math.PI * 2);
                  ctxNonNull.fill();
                }
              }
            }
            
            ctxNonNull.globalCompositeOperation = 'source-over';
            ctxNonNull.restore();
          }
        }
      } else {
        if (DEBUG_MODE) {
          console.log('[HeatmapMap] STAGE 3: Heat map data not ready or size mismatch', {
            hasData: !!heatMap.data,
            heatWidth: heatMap.width,
            heatHeight: heatMap.height,
            mapRectW,
            mapRectH,
          });
        }
      }
    }

    // STAGE 2: Base map with coastlines (coastlines are in renderBase)
    if (renderStage >= 2) {
      renderBase();
    }

    // STAGE 4: Subtle noise/grain overlay - INCLUDES Stage 1 + 2 + 3
    // Stage 4 should show full map (ocean + coastlines + heat) + subtle grain
    if (renderStage >= 4) {
      // First render base map + heat (Stage 3)
      renderBase();
      
      // Render heat overlay
      const mapRectW = Math.floor(mapRect.w);
      const mapRectH = Math.floor(mapRect.h);
      const heatData = heatMap.data && heatMap.width === mapRectW && heatMap.height === mapRectH
        ? heatMap.data
        : null;
      
      if (heatData) {
        let maxHeat = 0;
        for (let i = 0; i < heatData.length; i++) {
          maxHeat = Math.max(maxHeat, heatData[i]);
        }
        
        if (maxHeat > 0) {
          const heatCanvas = document.createElement('canvas');
          heatCanvas.width = mapRectW;
          heatCanvas.height = mapRectH;
          const heatCtx = heatCanvas.getContext('2d');
          
          if (heatCtx) {
            const heatImageData = heatCtx.createImageData(mapRectW, mapRectH);
            const data = heatImageData.data;
            for (let i = 0; i < heatData.length; i++) {
              const heat = heatData[i];
              const color = getHeatColor(heat, maxHeat);
              const idx = i * 4;
              data[idx] = color.r;
              data[idx + 1] = color.g;
              data[idx + 2] = color.b;
              data[idx + 3] = color.a;
            }
            heatCtx.putImageData(heatImageData, 0, 0);
            
            ctxNonNull.save();
            ctxNonNull.globalCompositeOperation = 'screen';
            ctxNonNull.globalAlpha = 1;
            ctxNonNull.drawImage(heatCanvas, mapRect.x, mapRect.y, mapRect.w, mapRect.h);
            ctxNonNull.globalCompositeOperation = 'source-over';
            ctxNonNull.globalAlpha = 1;
            ctxNonNull.restore();
          }
        }
      }
      
      // Add noise overlay using offscreen canvas
      const noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = mapRectW;
      noiseCanvas.height = mapRectH;
      const noiseCtx = noiseCanvas.getContext('2d');
      
      if (noiseCtx) {
        const noiseData = noiseCtx.createImageData(mapRectW, mapRectH);
        const noise = noiseData.data;
        
        // SPARSE NOISE: Only ~3% of pixels get noise
        const noiseProbability = 0.03;
        for (let i = 0; i < noise.length; i += 4) {
          if (Math.random() < noiseProbability) {
            const isBright = Math.random() > 0.5;
            noise[i] = isBright ? 255 : 0;
            noise[i + 1] = isBright ? 255 : 0;
            noise[i + 2] = isBright ? 255 : 0;
            noise[i + 3] = Math.floor(Math.random() * 4) + 2;
          } else {
            noise[i] = 0;
            noise[i + 1] = 0;
            noise[i + 2] = 0;
            noise[i + 3] = 0;
          }
        }
        
        noiseCtx.putImageData(noiseData, 0, 0);
        
        // Draw noise canvas onto main canvas using drawImage (CSS pixels, respects transform)
        ctxNonNull.save();
        ctxNonNull.globalCompositeOperation = 'source-over';
        ctxNonNull.globalAlpha = 0.04; // Very subtle
        ctxNonNull.drawImage(noiseCanvas, mapRect.x, mapRect.y, mapRect.w, mapRect.h);
        ctxNonNull.globalCompositeOperation = 'source-over';
        ctxNonNull.globalAlpha = 1;
        ctxNonNull.restore();
        
        console.log('[HeatmapMap] STAGE 4: Noise drawn at', { x: mapRect.x, y: mapRect.y, w: mapRect.w, h: mapRect.h });
      }
    }
    
    // STAGE 5: Same as Stage 4
    if (renderStage >= 5) {
      // Same as Stage 4 (already handled above)
    }

      if (useTransform) {
        ctxNonNull.restore(); // Restore pan/zoom transform
      }
      if (DEBUG_MODE) {
        console.log('[HeatmapMap] Render complete - Stage', renderStage);
      }
    }); // End requestAnimationFrame callback
  }, [canvasSize, heatMap, coastlineData, landData, transform, renderStage]);

  useEffect(() => {
    renderMap();
  }, [renderMap]);

  // Mouse handlers with improved intel tooltip
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setTransform((prev) => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      if (!canvasRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Convert mouse position to CSS coordinates
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Compute mapRect for coordinate conversion
      const cssWidth = canvasSize.width / dpr;
      const cssHeight = canvasSize.height / dpr;
      const targetAspect = 2;
      const canvasAspect = cssWidth / cssHeight;
      let mapRect: { x: number; y: number; w: number; h: number };
      if (canvasAspect > targetAspect) {
        mapRect = { h: cssHeight, w: cssHeight * targetAspect, x: (cssWidth - cssHeight * targetAspect) / 2, y: 0 };
      } else {
        mapRect = { w: cssWidth, h: cssWidth / targetAspect, x: 0, y: (cssHeight - cssWidth / targetAspect) / 2 };
      }
      
      // Check if mouse is within mapRect
      if (mouseX < mapRect.x || mouseX > mapRect.x + mapRect.w || 
          mouseY < mapRect.y || mouseY > mapRect.y + mapRect.h) {
        setHoverInfo(null);
        return;
      }

      // Convert to lat/lon within mapRect
      const mapX = mouseX - mapRect.x;
      const mapY = mouseY - mapRect.y;
      const lon = (mapX / mapRect.w) * 360 - 180;
      const lat = 90 - (mapY / mapRect.h) * 180;

      // Get heat intensity at this location (mapRect coordinates)
      const mapRectW = Math.floor(mapRect.w);
      const mapRectH = Math.floor(mapRect.h);
      const heatX = Math.floor((mapX / mapRect.w) * mapRectW);
      const heatY = Math.floor((mapY / mapRect.h) * mapRectH);
      const intensity = heatMap.data && heatX >= 0 && heatX < mapRectW && heatY >= 0 && heatY < mapRectH
        ? heatMap.data[heatY * mapRectW + heatX] || 0
        : 0;

      // Find nearby companies with contribution scores (include private companies, exclude crypto/tradfi)
      const convertedPrivateCompanies = privateCompanies.map(privateCompanyToCompany);
      const allCompanies = [...companies, ...convertedPrivateCompanies];
      const excludeTags = ['crypto', 'blockchain', 'defi', 'tradfi', 'finance', 'fintech'];
      const roboticsCompanies = allCompanies.filter((c) => {
        const hasExcludedTag = c.tags?.some((tag) => 
          excludeTags.some((excludeTag) => tag.toLowerCase().includes(excludeTag.toLowerCase()))
        );
        return !hasExcludedTag;
      });
      
      const companiesWithContrib = roboticsCompanies
        .filter((company) => {
          if (company.hq_lat == null || company.hq_lon == null) return false;
          const dist = Math.sqrt(
            Math.pow(company.hq_lat - lat, 2) + Math.pow(company.hq_lon - lon, 2)
          );
          return dist < 3; // Within 3 degrees
        })
        .map((company) => {
          const dist = Math.sqrt(
            Math.pow(company.hq_lat! - lat, 2) + Math.pow(company.hq_lon! - lon, 2)
          );
          const contribution = getBaselineHeatContribution(company) * gaussianFalloff(dist, HEAT_SPREAD_RADIUS_DEG);
          return { company, contribution, distance: dist };
        })
        .sort((a, b) => b.contribution - a.contribution)
        .slice(0, 3)
        .map(item => item.company);

      // Find nearby events with time-decayed contributions
      const eventsWithContrib = events
        .filter((event) => {
          if (event.lat == null || event.lon == null) return false;
          const dist = Math.sqrt(
            Math.pow(event.lat - lat, 2) + Math.pow(event.lon - lon, 2)
          );
          return dist < 3; // Within 3 degrees
        })
        .map((event) => {
          const dist = Math.sqrt(
            Math.pow(event.lat! - lat, 2) + Math.pow(event.lon! - lon, 2)
          );
          const baseIntensity = getEventHeatContribution(event);
          const timeDecay = getTimeDecay(event.timestamp, HEAT_HALF_LIFE_DAYS);
          const contribution = baseIntensity * timeDecay * gaussianFalloff(dist, HEAT_SPREAD_RADIUS_DEG);
          return { event, contribution, timestamp: event.timestamp };
        })
        .sort((a, b) => b.contribution - a.contribution)
        .slice(0, 3)
        .map(item => item.event);

      if (intensity > 0 || companiesWithContrib.length > 0 || eventsWithContrib.length > 0) {
        setHoverInfo({
          x: e.clientX,
          y: e.clientY,
          intensity,
          companies: companiesWithContrib,
          events: eventsWithContrib,
        });
      } else {
        setHoverInfo(null);
      }
    },
    [isDragging, dragStart, transform, heatMap, events, companies, privateCompanies, canvasSize]
  );
  
  // Click-to-focus behavior
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) {
        setIsDragging(false);
        return;
      }

      if (!canvasRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const cssWidth = canvasSize.width / dpr;
      const cssHeight = canvasSize.height / dpr;
      const targetAspect = 2;
      const canvasAspect = cssWidth / cssHeight;
      let mapRect: { x: number; y: number; w: number; h: number };
      if (canvasAspect > targetAspect) {
        mapRect = { h: cssHeight, w: cssHeight * targetAspect, x: (cssWidth - cssHeight * targetAspect) / 2, y: 0 };
      } else {
        mapRect = { w: cssWidth, h: cssWidth / targetAspect, x: 0, y: (cssHeight - cssWidth / targetAspect) / 2 };
      }
      
      if (mouseX < mapRect.x || mouseX > mapRect.x + mapRect.w || 
          mouseY < mapRect.y || mouseY > mapRect.y + mapRect.h) {
        return;
      }

      const mapX = mouseX - mapRect.x;
      const mapY = mouseY - mapRect.y;
      const lon = (mapX / mapRect.w) * 360 - 180;
      const lat = 90 - (mapY / mapRect.h) * 180;
      
      // Set selected region in store (could be extended to focus globe)
      // For now, just log - can be extended to store action
      console.log('[HeatmapMap] Region selected:', { lat, lon });
    },
    [isDragging, canvasSize]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard shortcuts for render stage debugging (1-5 keys) - only in debug mode
  useEffect(() => {
    if (!DEBUG_MODE) return; // Disable stage switching in production
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key >= '1' && e.key <= '5') {
        const stage = parseInt(e.key);
        setRenderStage(stage);
        // Persist to localStorage in debug mode
        try {
          localStorage.setItem('heatmapRenderStage', stage.toString());
        } catch {
          // Ignore localStorage errors
        }
        console.log('[HeatmapMap] Render stage set to:', stage);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Native wheel handler for non-passive preventDefault
  useEffect(() => {
    const element = interactionLayerRef.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((prev) => ({
        ...prev,
        scale: Math.max(0.5, Math.min(3, prev.scale * delta)),
      }));
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: 'transparent' }}
      tabIndex={0} // Make div focusable for keyboard events
    >
      {/* Debug stage indicator - only in debug mode */}
      {DEBUG_MODE && (
        <div className="absolute top-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded z-20 pointer-events-none">
          Stage: {renderStage} (Press 1-5 to change)
        </div>
      )}
      
      {/* Loading indicator - only show if coastlines haven't loaded yet */}
      {!coastlineData && !DEBUG_MODE && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-gray-400 text-[10px] px-2 py-1 rounded z-20 pointer-events-none">
          Loading data...
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          backgroundColor: '#0D1015', // Fallback background
        }}
      />
      <div
        ref={interactionLayerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        style={{
          backgroundColor: 'transparent', // MUST be transparent
          zIndex: 1,
          overscrollBehavior: 'contain',
          touchAction: 'none',
        }}
      >
        {/* Hover tooltip */}
        {hoverInfo && (
          <div
            className="absolute bg-surface/95 backdrop-blur-sm border border-gray-700 rounded p-2 text-xs text-white pointer-events-none z-10 max-w-xs"
            style={{
              left: hoverInfo.x + 10,
              top: hoverInfo.y - 10,
            }}
          >
            <div className="font-semibold mb-1">
              Intensity: {hoverInfo.intensity.toFixed(1)}
            </div>
            {hoverInfo.companies.length > 0 && (
              <div className="mt-2">
                <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">
                  Companies ({hoverInfo.companies.length})
                </div>
                {hoverInfo.companies.map((company) => (
                  <div key={company.id} className="text-gray-300 truncate">
                    {company.name}
                  </div>
                ))}
              </div>
            )}
            {hoverInfo.events.length > 0 && (
              <div className="mt-2">
                <div className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">
                  Recent Events ({hoverInfo.events.length})
                </div>
                {hoverInfo.events.map((event) => (
                  <div key={event.id} className="text-gray-300 truncate">
                    {event.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
