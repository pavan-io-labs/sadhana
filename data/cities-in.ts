/**
 * Offline city table for the location picker.
 *
 * The whole app is driven by latitude, longitude and timezone, so the picker only
 * needs to turn a familiar name into those three numbers. Shipping the table means
 * onboarding works with no network and no geolocation permission  --  the browser's
 * geolocation and manual lat/long entry are both offered as alternatives, not
 * prerequisites.
 *
 * India runs one offset (IST, +05:30) across roughly 29 degrees of longitude, which
 * is exactly why this matters: sunrise in Port Blair and in Rajkot are more than an
 * hour and a half apart on the same clock, so a fixed 4:45 wake time means very
 * different things at the two ends of the country.
 */

export type City = {
  /** Stable kebab-case id, used as the stored settings value. */
  id: string;
  name: string;
  /** State or union territory. */
  region: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

/** Hyderabad, because that is where the routine this app implements was written for. */
export const DEFAULT_CITY_ID = "hyderabad";

const IST = "Asia/Kolkata";

/** Alphabetical, so the picker needs no sorting pass. */
export const INDIAN_CITIES: readonly City[] = [
  { id: "agra", name: "Agra", region: "Uttar Pradesh", latitude: 27.1767, longitude: 78.0081, timeZone: IST },
  { id: "ahmedabad", name: "Ahmedabad", region: "Gujarat", latitude: 23.0225, longitude: 72.5714, timeZone: IST },
  { id: "amritsar", name: "Amritsar", region: "Punjab", latitude: 31.634, longitude: 74.8723, timeZone: IST },
  { id: "aurangabad", name: "Aurangabad", region: "Maharashtra", latitude: 19.8762, longitude: 75.3433, timeZone: IST },
  { id: "bengaluru", name: "Bengaluru", region: "Karnataka", latitude: 12.9716, longitude: 77.5946, timeZone: IST },
  { id: "bhopal", name: "Bhopal", region: "Madhya Pradesh", latitude: 23.2599, longitude: 77.4126, timeZone: IST },
  { id: "bhubaneswar", name: "Bhubaneswar", region: "Odisha", latitude: 20.2961, longitude: 85.8245, timeZone: IST },
  { id: "chandigarh", name: "Chandigarh", region: "Chandigarh", latitude: 30.7333, longitude: 76.7794, timeZone: IST },
  { id: "chennai", name: "Chennai", region: "Tamil Nadu", latitude: 13.0827, longitude: 80.2707, timeZone: IST },
  { id: "coimbatore", name: "Coimbatore", region: "Tamil Nadu", latitude: 11.0168, longitude: 76.9558, timeZone: IST },
  { id: "dehradun", name: "Dehradun", region: "Uttarakhand", latitude: 30.3165, longitude: 78.0322, timeZone: IST },
  { id: "delhi", name: "Delhi", region: "Delhi", latitude: 28.6139, longitude: 77.209, timeZone: IST },
  { id: "dhanbad", name: "Dhanbad", region: "Jharkhand", latitude: 23.7957, longitude: 86.4304, timeZone: IST },
  { id: "faridabad", name: "Faridabad", region: "Haryana", latitude: 28.4089, longitude: 77.3178, timeZone: IST },
  { id: "ghaziabad", name: "Ghaziabad", region: "Uttar Pradesh", latitude: 28.6692, longitude: 77.4538, timeZone: IST },
  { id: "guntur", name: "Guntur", region: "Andhra Pradesh", latitude: 16.3067, longitude: 80.4365, timeZone: IST },
  { id: "gurugram", name: "Gurugram", region: "Haryana", latitude: 28.4595, longitude: 77.0266, timeZone: IST },
  { id: "guwahati", name: "Guwahati", region: "Assam", latitude: 26.1445, longitude: 91.7362, timeZone: IST },
  { id: "gwalior", name: "Gwalior", region: "Madhya Pradesh", latitude: 26.2183, longitude: 78.1828, timeZone: IST },
  { id: "howrah", name: "Howrah", region: "West Bengal", latitude: 22.5958, longitude: 88.2636, timeZone: IST },
  { id: "hyderabad", name: "Hyderabad", region: "Telangana", latitude: 17.385, longitude: 78.4867, timeZone: IST },
  { id: "imphal", name: "Imphal", region: "Manipur", latitude: 24.817, longitude: 93.9368, timeZone: IST },
  { id: "indore", name: "Indore", region: "Madhya Pradesh", latitude: 22.7196, longitude: 75.8577, timeZone: IST },
  { id: "jabalpur", name: "Jabalpur", region: "Madhya Pradesh", latitude: 23.1815, longitude: 79.9864, timeZone: IST },
  { id: "jaipur", name: "Jaipur", region: "Rajasthan", latitude: 26.9124, longitude: 75.7873, timeZone: IST },
  { id: "jalandhar", name: "Jalandhar", region: "Punjab", latitude: 31.326, longitude: 75.5762, timeZone: IST },
  { id: "jamshedpur", name: "Jamshedpur", region: "Jharkhand", latitude: 22.8046, longitude: 86.2029, timeZone: IST },
  { id: "jodhpur", name: "Jodhpur", region: "Rajasthan", latitude: 26.2389, longitude: 73.0243, timeZone: IST },
  { id: "kanpur", name: "Kanpur", region: "Uttar Pradesh", latitude: 26.4499, longitude: 80.3319, timeZone: IST },
  { id: "kochi", name: "Kochi", region: "Kerala", latitude: 9.9312, longitude: 76.2673, timeZone: IST },
  { id: "kolkata", name: "Kolkata", region: "West Bengal", latitude: 22.5726, longitude: 88.3639, timeZone: IST },
  { id: "kota", name: "Kota", region: "Rajasthan", latitude: 25.2138, longitude: 75.8648, timeZone: IST },
  { id: "leh", name: "Leh", region: "Ladakh", latitude: 34.1526, longitude: 77.5771, timeZone: IST },
  { id: "lucknow", name: "Lucknow", region: "Uttar Pradesh", latitude: 26.8467, longitude: 80.9462, timeZone: IST },
  { id: "ludhiana", name: "Ludhiana", region: "Punjab", latitude: 30.901, longitude: 75.8573, timeZone: IST },
  { id: "madurai", name: "Madurai", region: "Tamil Nadu", latitude: 9.9252, longitude: 78.1198, timeZone: IST },
  { id: "mangaluru", name: "Mangaluru", region: "Karnataka", latitude: 12.9141, longitude: 74.856, timeZone: IST },
  { id: "meerut", name: "Meerut", region: "Uttar Pradesh", latitude: 28.9845, longitude: 77.7064, timeZone: IST },
  { id: "mumbai", name: "Mumbai", region: "Maharashtra", latitude: 19.076, longitude: 72.8777, timeZone: IST },
  { id: "mysuru", name: "Mysuru", region: "Karnataka", latitude: 12.2958, longitude: 76.6394, timeZone: IST },
  { id: "nagpur", name: "Nagpur", region: "Maharashtra", latitude: 21.1458, longitude: 79.0882, timeZone: IST },
  { id: "nashik", name: "Nashik", region: "Maharashtra", latitude: 19.9975, longitude: 73.7898, timeZone: IST },
  { id: "navi-mumbai", name: "Navi Mumbai", region: "Maharashtra", latitude: 19.033, longitude: 73.0297, timeZone: IST },
  { id: "noida", name: "Noida", region: "Uttar Pradesh", latitude: 28.5355, longitude: 77.391, timeZone: IST },
  { id: "panaji", name: "Panaji", region: "Goa", latitude: 15.4909, longitude: 73.8278, timeZone: IST },
  { id: "patna", name: "Patna", region: "Bihar", latitude: 25.5941, longitude: 85.1376, timeZone: IST },
  { id: "port-blair", name: "Port Blair", region: "Andaman & Nicobar", latitude: 11.6234, longitude: 92.7265, timeZone: IST },
  { id: "prayagraj", name: "Prayagraj", region: "Uttar Pradesh", latitude: 25.4358, longitude: 81.8463, timeZone: IST },
  { id: "puducherry", name: "Puducherry", region: "Puducherry", latitude: 11.9416, longitude: 79.8083, timeZone: IST },
  { id: "pune", name: "Pune", region: "Maharashtra", latitude: 18.5204, longitude: 73.8567, timeZone: IST },
  { id: "raipur", name: "Raipur", region: "Chhattisgarh", latitude: 21.2514, longitude: 81.6296, timeZone: IST },
  { id: "rajkot", name: "Rajkot", region: "Gujarat", latitude: 22.3039, longitude: 70.8022, timeZone: IST },
  { id: "ranchi", name: "Ranchi", region: "Jharkhand", latitude: 23.3441, longitude: 85.3096, timeZone: IST },
  { id: "salem", name: "Salem", region: "Tamil Nadu", latitude: 11.6643, longitude: 78.146, timeZone: IST },
  { id: "shimla", name: "Shimla", region: "Himachal Pradesh", latitude: 31.1048, longitude: 77.1734, timeZone: IST },
  { id: "siliguri", name: "Siliguri", region: "West Bengal", latitude: 26.7271, longitude: 88.3953, timeZone: IST },
  { id: "srinagar", name: "Srinagar", region: "Jammu & Kashmir", latitude: 34.0837, longitude: 74.7973, timeZone: IST },
  { id: "surat", name: "Surat", region: "Gujarat", latitude: 21.1702, longitude: 72.8311, timeZone: IST },
  { id: "thane", name: "Thane", region: "Maharashtra", latitude: 19.2183, longitude: 72.9781, timeZone: IST },
  { id: "thiruvananthapuram", name: "Thiruvananthapuram", region: "Kerala", latitude: 8.5241, longitude: 76.9366, timeZone: IST },
  { id: "tiruchirappalli", name: "Tiruchirappalli", region: "Tamil Nadu", latitude: 10.7905, longitude: 78.7047, timeZone: IST },
  { id: "tirupati", name: "Tirupati", region: "Andhra Pradesh", latitude: 13.6288, longitude: 79.4192, timeZone: IST },
  { id: "udaipur", name: "Udaipur", region: "Rajasthan", latitude: 24.5854, longitude: 73.7125, timeZone: IST },
  { id: "vadodara", name: "Vadodara", region: "Gujarat", latitude: 22.3072, longitude: 73.1812, timeZone: IST },
  { id: "varanasi", name: "Varanasi", region: "Uttar Pradesh", latitude: 25.3176, longitude: 82.9739, timeZone: IST },
  { id: "vijayawada", name: "Vijayawada", region: "Andhra Pradesh", latitude: 16.5062, longitude: 80.648, timeZone: IST },
  { id: "visakhapatnam", name: "Visakhapatnam", region: "Andhra Pradesh", latitude: 17.6868, longitude: 83.2185, timeZone: IST },
  { id: "warangal", name: "Warangal", region: "Telangana", latitude: 17.9689, longitude: 79.5941, timeZone: IST },
];

const BY_ID = new Map(INDIAN_CITIES.map((c) => [c.id, c]));

export function findCity(id: string): City | undefined {
  return BY_ID.get(id);
}

/** The default, guaranteed to exist so callers never have to handle `undefined`. */
export function defaultCity(): City {
  const city = BY_ID.get(DEFAULT_CITY_ID);
  if (!city) throw new Error(`DEFAULT_CITY_ID ${DEFAULT_CITY_ID} is not in INDIAN_CITIES`);
  return city;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometres. */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Closest listed city to a coordinate, with its distance.
 *
 * Used to label a browser-geolocation result. The coordinate itself is what gets
 * stored and computed from  --  this only supplies a recognisable name, which is why
 * the distance is returned too: the UI says "near Pune (12 km)" rather than
 * claiming the user is in Pune.
 */
export function nearestCity(
  latitude: number,
  longitude: number,
): { city: City; distanceKm: number } {
  let best = INDIAN_CITIES[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const city of INDIAN_CITIES) {
    const d = distanceKm({ latitude, longitude }, city);
    if (d < bestDistance) {
      best = city;
      bestDistance = d;
    }
  }
  return { city: best, distanceKm: bestDistance };
}

/** Prefix-first name search for the picker. Case- and accent-insensitive enough for a local list. */
export function searchCities(query: string, limit = 8): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return INDIAN_CITIES.slice(0, limit);
  const starts: City[] = [];
  const contains: City[] = [];
  for (const city of INDIAN_CITIES) {
    const name = city.name.toLowerCase();
    if (name.startsWith(q)) starts.push(city);
    else if (name.includes(q) || city.region.toLowerCase().includes(q)) contains.push(city);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Within this distance the nearest listed city is a fair label for a coordinate. */
export const LABEL_RADIUS_KM = 40;

/**
 * A display name for a raw coordinate.
 *
 * The nearest listed city when it is close enough to be honest about, and the coordinate
 * itself when it is not  --  a user in a village 200 km from Nagpur is not in Nagpur, and the
 * app should not tell them they are.
 */
export function labelCoordinate(
  latitude: number,
  longitude: number,
): { city: string; region: string } {
  const near = nearestCity(latitude, longitude);
  const close = near.distanceKm <= LABEL_RADIUS_KM;
  return {
    city: close ? near.city.name : `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
    region: close ? near.city.region : "Custom location",
  };
}
