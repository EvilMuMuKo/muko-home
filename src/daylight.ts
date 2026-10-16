/** Solar direction convention: +x south, -x north, -z east, +z west.
 * This is a consistent daylight study, not an ephemeris for a surveyed address. */
export const daylightStudy = Object.freeze({
  coordinateNorth: [-1, 0] as const,
  coordinateEast: [0, -1] as const,
  azimuthDeg: 155,
  altitudeDeg: 42,
  status: "concept_directional_sun_not_site_simulation",
  missingInputs: [
    "surveyed_true_north",
    "site_latitude_longitude",
    "date_time",
    "floor_and_neighbouring_obstructions",
    "glazing_transmittance",
  ],
  roofCastsShadowInOverview: true,
  apertureDaylightOnly: true,
});
export function sunDirection(
  azimuthDeg = daylightStudy.azimuthDeg,
  altitudeDeg = daylightStudy.altitudeDeg,
): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180,
    alt = (altitudeDeg * Math.PI) / 180;
  return [
    -Math.cos(az) * Math.cos(alt),
    Math.sin(alt),
    -Math.sin(az) * Math.cos(alt),
  ];
}
