import * as Location from 'expo-location';

export interface SearchResult {
  name: string;
  latitude: number;
  longitude: number;
}

// Top curated Delhi locations for instant results and demo reliability
const TOP_DELHI_SPOTS: SearchResult[] = [
  { name: 'India Gate, New Delhi', latitude: 28.6129, longitude: 77.2295 },
  { name: 'Connaught Place, Central Delhi', latitude: 28.6315, longitude: 77.2167 },
  { name: 'IGI Airport (T3), Delhi', latitude: 28.5562, longitude: 77.1000 },
  { name: 'Red Fort, Old Delhi', latitude: 28.6562, longitude: 77.2410 },
  { name: 'Lotus Temple, Kalkaji', latitude: 28.5535, longitude: 77.2588 },
  { name: 'Qutub Minar, Mehrauli', latitude: 28.5244, longitude: 77.1855 },
  { name: 'Hauz Khas Village', latitude: 28.5521, longitude: 77.1948 },
  { name: 'Akshardham Temple', latitude: 28.6127, longitude: 77.2773 },
  { name: 'Chandni Chowk, Market', latitude: 28.6506, longitude: 77.2307 },
  { name: 'Saket Select Citywalk', latitude: 28.5289, longitude: 77.2183 },
  { name: 'Dilli Haat, INA', latitude: 28.5733, longitude: 77.2085 },
  { name: 'Lajpat Nagar Market', latitude: 28.5677, longitude: 77.2432 },
  { name: 'Rajouri Garden', latitude: 28.6415, longitude: 77.1209 },
  { name: 'Dwarka Sector 21', latitude: 28.5523, longitude: 77.0583 },
  { name: 'Rohini Sector 10', latitude: 28.7154, longitude: 77.1137 },
];

// Using Photon API (by Komoot) which is much better for fuzzy search and local addresses
export const searchAddress = async (query: string): Promise<SearchResult[]> => {
  const normalizedQuery = query.toLowerCase().trim();
  if (normalizedQuery.length < 2) return [];

  // 1. Local hardcoded matches for instant results
  const localMatches = TOP_DELHI_SPOTS.filter(spot => 
    spot.name.toLowerCase().includes(normalizedQuery)
  );

  try {
    // 2. Fetch from Photon API - centered on Delhi for better relevance
    // lat=28.61, lon=77.23 is central Delhi
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(normalizedQuery)}&lat=28.61&lon=77.23&limit=15`;
    
    const response = await fetch(url);
    if (!response.ok) return localMatches;

    const data = await response.json();
    if (!data.features) return localMatches;
    
    const apiResults = data.features.map((feature: any) => {
      const p = feature.properties;
      const coords = feature.geometry.coordinates; // Photon returns [lon, lat]
      
      const mainName = p.name || p.street || "";
      const district = p.district || p.city || p.state || "";
      const area = p.housenumber ? p.housenumber + " " : "";
      
      return {
        name: `${area}${mainName}${district ? ', ' + district : ''}`,
        latitude: coords[1],
        longitude: coords[0],
      };
    }).filter((res: any) => res.name.length > 2);

    // Merge results, removing duplicates by name
    const allResults = [...localMatches, ...apiResults];
    const uniqueResults = allResults.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
    
    return uniqueResults;
  } catch (error) {
    console.error("Photon search error:", error);
    return localMatches;
  }
};

export const getAddressFromCoords = async (lat: number, lon: number): Promise<string> => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (results && results.length > 0) {
      const { name, street, district, city } = results[0];
      const main = name || street || "";
      const area = district || city || "";
      return `${main}${main && area ? ', ' : ''}${area}`.trim();
    }
    return "Delhi Area";
  } catch (error) {
    return "Current Location";
  }
};

export const getRoadRoute = async (start: {lat: number, lon: number}, end: {lat: number, lon: number}) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (data && data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map((coord: any) => ({
        latitude: coord[1],
        longitude: coord[0],
      }));
    }
    return [];
  } catch (error) {
    return [];
  }
};

export const fetchRealTimeWeather = async (lat: number, lon: number): Promise<'Clear' | 'Rain' | 'Storm' | 'Fog'> => {
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!response.ok) return 'Clear';
    const data = await response.json();
    const weatherCode = data.current_weather?.weathercode;
    
    if (weatherCode === undefined) return 'Clear';

    // Map WMO codes to our factors
    // Fog (45, 48)
    if (weatherCode === 45 || weatherCode === 48) return 'Fog';
    
    // Storm (95, 96, 99)
    if ([95, 96, 99].includes(weatherCode)) return 'Storm';
    
    // Rain/Snow/Showers (51-86)
    if (weatherCode >= 51 && weatherCode <= 86) return 'Rain';

    return 'Clear';
  } catch (error) {
    console.error("Failed to fetch real-time weather", error);
    return 'Clear';
  }
};

export const calculateLiveDemand = (lat: number, lon: number): 'Low' | 'Normal' | 'High' | 'Surge' => {
  const date = new Date();
  const hour = date.getHours();
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday

  // Create a pseudo-random stable seed based on current hour + lat + lon
  // This ensures the demand is stable for an hour in a specific location, but varies organically across the city
  const seed = Math.floor(lat * 100) + Math.floor(lon * 100) + hour;
  const rand = (Math.sin(seed) + 1) / 2; // 0.0 to 1.0

  let baseDemandScore = rand;

  // Time-based weighting
  if (hour >= 8 && hour <= 10) {
    baseDemandScore += 0.4; // Morning rush
  } else if (hour >= 17 && hour <= 20) {
    baseDemandScore += 0.5; // Evening rush
  } else if (hour >= 23 || hour <= 4) {
    // Late night
    if (day === 0 || day === 6) {
      baseDemandScore += 0.3; // Weekend late night (parties, etc.)
    } else {
      baseDemandScore -= 0.3; // Weekday late night
    }
  }

  // Location-based weighting (Delhi Center ~ 28.61, 77.23)
  const distFromCenter = Math.sqrt(Math.pow(lat - 28.61, 2) + Math.pow(lon - 77.23, 2));
  if (distFromCenter < 0.05) {
    baseDemandScore += 0.2; // Central areas always have higher demand
  } else if (distFromCenter > 0.15) {
    baseDemandScore -= 0.2; // Far outskirts have lower demand
  }

  // Final mapping
  if (baseDemandScore > 1.2) return 'Surge';
  if (baseDemandScore > 0.8) return 'High';
  if (baseDemandScore < 0.3) return 'Low';
  return 'Normal';
};

export const findNearestEmergencyServices = async (lat: number, lon: number) => {
  try {
    const hospitalUrl = `https://photon.komoot.io/api/?q=hospital&lat=${lat}&lon=${lon}&limit=1`;
    const policeUrl = `https://photon.komoot.io/api/?q=police&lat=${lat}&lon=${lon}&limit=1`;
    
    const [hResp, pResp] = await Promise.all([fetch(hospitalUrl), fetch(policeUrl)]);
    const hData = await hResp.json();
    const pData = await pResp.json();
    
    const hospital = hData.features?.[0]?.properties?.name || "Nearest City Hospital";
    const police = pData.features?.[0]?.properties?.name || "District Police HQ";
    
    return { hospital, police };
  } catch (error) {
    return { hospital: "Nearest Medical Center", police: "Police Control Room" };
  }
};
