import * as THREE from 'three';

const EARTH_RADIUS = 1;

/**
 * Convert latitude/longitude to 3D sphere coordinates
 * @param lat Latitude in degrees (-90 to +90)
 * @param lon Longitude in degrees (-180 to +180)
 * @param radius Sphere radius (default: 1)
 * @returns THREE.Vector3 position on sphere
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number = EARTH_RADIUS
): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180; // polar angle
  const theta = ((lon + 180) * Math.PI) / 180; // azimuth

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Convert 3D sphere coordinates back to latitude/longitude
 * @param position THREE.Vector3 position on sphere
 * @param radius Sphere radius (default: 1)
 * @returns { lat: number, lon: number } in degrees
 */
export function vector3ToLatLon(
  position: THREE.Vector3,
  radius: number = EARTH_RADIUS
): { lat: number; lon: number } {
  const lat = 90 - (Math.acos(position.y / radius) * 180) / Math.PI;
  const lon = (Math.atan2(position.z, -position.x) * 180) / Math.PI - 180;
  return { lat, lon };
}

/**
 * Calculate great circle arc between two points on sphere
 * @param startLat Start latitude
 * @param startLon Start longitude
 * @param endLat End latitude
 * @param endLon End longitude
 * @param segments Number of curve segments
 * @returns Array of Vector3 points along the arc
 */
export function createArc(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  segments: number = 50
): THREE.Vector3[] {
  const start = latLonToVector3(startLat, startLon);
  const end = latLonToVector3(endLat, endLon);

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3().lerpVectors(start, end, t);
    point.normalize().multiplyScalar(EARTH_RADIUS);
    points.push(point);
  }

  return points;
}

/**
 * Calculate camera position to look at a specific lat/lon
 * @param lat Target latitude
 * @param lon Target longitude
 * @param distance Distance from globe surface
 * @returns { position: THREE.Vector3, target: THREE.Vector3 }
 */
export function getCameraPositionForLocation(
  lat: number,
  lon: number,
  distance: number = 2.5
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const target = latLonToVector3(lat, lon);
  const direction = target.clone().normalize();
  const position = direction.multiplyScalar(distance);

  return { position, target };
}


