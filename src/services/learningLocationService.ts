import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { firestore } from "@/services/firebase";
import { detectMalaysianState, type MalaysianState, MALAYSIAN_STATES } from "@/utils/locationDetector";

const LEARNED_LOCATIONS_STORAGE_KEY = "@learned_locations";
const FIREBASE_COLLECTION = "locationKnowledgeBase";

// In-memory runtime cache for 0ms lookup
let memoryLearnedCache: Record<string, MalaysianState> = {};

/**
 * Initialize and load learned locations from local storage
 */
export async function initLearnedLocationCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LEARNED_LOCATIONS_STORAGE_KEY);
    if (raw) {
      memoryLearnedCache = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Failed to load learned locations cache:", err);
  }
}

/**
 * Normalizes state name returned by Google Geocoder to official MalaysianState
 */
function normalizeStateName(rawState?: string | null): MalaysianState | null {
  if (!rawState) return null;
  const clean = rawState.toLowerCase().trim();

  if (clean.includes("perak")) return "Perak";
  if (clean.includes("selangor")) return "Selangor";
  if (clean.includes("kuala lumpur") || clean === "kl" || clean === "wilayah persekutuan kuala lumpur") return "Kuala Lumpur";
  if (clean.includes("johor")) return "Johor";
  if (clean.includes("penang") || clean.includes("pulau pinang")) return "Penang";
  if (clean.includes("kedah")) return "Kedah";
  if (clean.includes("pahang")) return "Pahang";
  if (clean.includes("sembilan") || clean === "n9") return "Negeri Sembilan";
  if (clean.includes("melaka") || clean.includes("malacca")) return "Melaka";
  if (clean.includes("kelantan")) return "Kelantan";
  if (clean.includes("terengganu")) return "Terengganu";
  if (clean.includes("sabah")) return "Sabah";
  if (clean.includes("sarawak")) return "Sarawak";
  if (clean.includes("perlis")) return "Perlis";
  if (clean.includes("putrajaya")) return "Putrajaya";
  if (clean.includes("labuan")) return "Labuan";

  for (const s of MALAYSIAN_STATES) {
    if (clean.includes(s.toLowerCase())) return s;
  }

  return null;
}

/**
 * Resolves state using:
 * 1. Instant Local Knowledge Base (0ms)
 * 2. Learned Memory Cache (0ms)
 * 3. Google Geocoder (Default / Online) + Cloud Self-Learning
 */
export async function resolveLocationWithGoogleLearning(
  query: string
): Promise<{ state: MalaysianState; source: "local" | "memory" | "google" } | null> {
  const cleanQuery = (query || "").trim();
  if (!cleanQuery || cleanQuery.length < 3) return null;

  // 1. Tier 1: Check instant local knowledge base
  const localMatch = detectMalaysianState(cleanQuery);
  if (localMatch) {
    return { state: localMatch.state, source: "local" };
  }

  // 2. Tier 2: Check learned memory cache
  const normalizedKey = cleanQuery.toLowerCase();
  if (memoryLearnedCache[normalizedKey]) {
    return { state: memoryLearnedCache[normalizedKey], source: "memory" };
  }

  // 3. Tier 3: Query Google Geocoder (Default Online Provider)
  try {
    const searchQuery = cleanQuery.toLowerCase().includes("malaysia")
      ? cleanQuery
      : `${cleanQuery}, Malaysia`;

    const geocodeResults = await Location.geocodeAsync(searchQuery);
    if (geocodeResults && geocodeResults.length > 0) {
      const { latitude, longitude } = geocodeResults[0];

      // Reverse geocode to get administrative district and state
      const reverseResults = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (reverseResults && reverseResults.length > 0) {
        const item = reverseResults[0];
        const rawState = item.region || item.subregion || item.city;
        const normalized = normalizeStateName(rawState);

        if (normalized) {
          // Self-Learning Step: Memorize locally & save to Firestore
          memoryLearnedCache[normalizedKey] = normalized;
          await AsyncStorage.setItem(
            LEARNED_LOCATIONS_STORAGE_KEY,
            JSON.stringify(memoryLearnedCache)
          ).catch(() => {});

          // Save to Firestore so all agents benefit
          try {
            const safeDocId = normalizedKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
            await firestore()
              .collection(FIREBASE_COLLECTION)
              .doc(safeDocId)
              .set(
                {
                  keyword: normalizedKey,
                  state: normalized,
                  district: item.subregion || item.district || item.city || "",
                  postalCode: item.postalCode || "",
                  latitude,
                  longitude,
                  learnedAt: new Date().toISOString(),
                },
                { merge: true }
              );
          } catch (e) {
            // Non-blocking Firestore save
          }

          return { state: normalized, source: "google" };
        }
      }
    }
  } catch (err) {
    // Fall through to OpenStreetMap backup
  }

  // 4. Tier 4: Backup Fallback - OpenStreetMap Geocoder (if Google is offline or misses)
  try {
    const encoded = encodeURIComponent(`${cleanQuery}, Malaysia`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encoded}`, {
      headers: { "User-Agent": "UmiApp/1.4.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const addr = item.address || {};
        const rawState = addr.state || addr.region || addr.city;
        const normalized = normalizeStateName(rawState);
        if (normalized) {
          memoryLearnedCache[normalizedKey] = normalized;
          await AsyncStorage.setItem(
            LEARNED_LOCATIONS_STORAGE_KEY,
            JSON.stringify(memoryLearnedCache)
          ).catch(() => {});

          return { state: normalized, source: "google" };
        }
      }
    }
  } catch {
    // Silent failure
  }

  return null;
}
