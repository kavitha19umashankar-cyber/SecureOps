const EARTH_RADIUS_METERS = 6371000

/** Returns distance in meters between two GPS coordinates using the Haversine formula. */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

/** Returns true if the point is within radiusMeters of the site center. */
export function isWithinGeofence(
  employeeLat: number,
  employeeLng: number,
  siteLat: number,
  siteLng: number,
  radiusMeters: number,
): boolean {
  return haversineDistance(employeeLat, employeeLng, siteLat, siteLng) <= radiusMeters
}

export interface VelocityCheckResult {
  isSuspicious: boolean
  speedKmh: number
  reason?: string
}

/**
 * Checks if the speed between two location readings is physically impossible.
 * Flags readings that imply movement faster than 200 km/h (no legitimate field worker scenario).
 */
export function checkVelocity(
  lat1: number,
  lng1: number,
  time1: Date,
  lat2: number,
  lng2: number,
  time2: Date,
): VelocityCheckResult {
  const distanceMeters = haversineDistance(lat1, lng1, lat2, lng2)
  const elapsedSeconds = Math.abs(time2.getTime() - time1.getTime()) / 1000

  if (elapsedSeconds < 1) {
    return { isSuspicious: false, speedKmh: 0 }
  }

  const speedKmh = (distanceMeters / elapsedSeconds) * 3.6

  if (speedKmh > 200) {
    return {
      isSuspicious: true,
      speedKmh,
      reason: `Impossible speed: ${speedKmh.toFixed(0)} km/h detected`,
    }
  }

  return { isSuspicious: false, speedKmh }
}
