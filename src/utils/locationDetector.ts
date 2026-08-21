import type { PropertyListing } from "@/types/listing";

/**
 * Standard Malaysian States & Federal Territories
 */
export const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Putrajaya",
  "Labuan",
] as const;

export type MalaysianState = (typeof MALAYSIAN_STATES)[number];

/**
 * 1. Official Pos Malaysia Postcode Bands Mapping
 */
export function getStateFromPostcode(postcodeStr: string): MalaysianState | null {
  const match = postcodeStr.match(/\b\d{5}\b/);
  if (!match) return null;
  const code = parseInt(match[0], 10);

  if (code >= 1000 && code <= 2800) return "Perlis";
  if (code >= 5000 && code <= 9810) return "Kedah";
  if (code >= 10000 && code <= 14400) return "Penang";
  if (code >= 15000 && code <= 18500) return "Kelantan";
  if (code >= 20000 && code <= 24300) return "Terengganu";
  if (
    (code >= 25000 && code <= 28800) ||
    (code >= 39000 && code <= 39200) ||
    code === 49000 ||
    code === 69000
  )
    return "Pahang";
  if (code >= 30000 && code <= 36810) return "Perak";
  if ((code >= 40000 && code <= 48300) || (code >= 63000 && code <= 64000)) return "Selangor";
  if (code >= 50000 && code <= 60000) return "Kuala Lumpur";
  if (code >= 62000 && code <= 62988) return "Putrajaya";
  if (code >= 70000 && code <= 73509) return "Negeri Sembilan";
  if (code >= 75000 && code <= 78309) return "Melaka";
  if (code >= 79000 && code <= 86900) return "Johor";
  if (code >= 87000 && code <= 87033) return "Labuan";
  if (code >= 88000 && code <= 91309) return "Sabah";
  if (code >= 93000 && code <= 98859) return "Sarawak";

  return null;
}

/**
 * 2. Comprehensive Malaysian Districts, Towns & Townships Dictionary
 */
const LOCATION_TO_STATE_DICT: Record<string, MalaysianState> = {
  // === PERAK ===
  "taiping": "Perak",
  "kamunting": "Perak",
  "simpang": "Perak",
  "aulong": "Perak",
  "pokok assam": "Perak",
  "matang": "Perak",
  "changkat jering": "Perak",
  "changkat ibol": "Perak",
  "selama": "Perak",
  "batu kurau": "Perak",
  "trong": "Perak",
  "padang gajah": "Perak",
  "ayer puteh": "Perak",
  "tanah ayer puteh": "Perak",
  "ipoh": "Perak",
  "bercham": "Perak",
  "tambun": "Perak",
  "klebang": "Perak",
  "chemor": "Perak",
  "tanjung rambutan": "Perak",
  "lahat": "Perak",
  "menglembu": "Perak",
  "silibin": "Perak",
  "jelapang": "Perak",
  "falim": "Perak",
  "gunung rapat": "Perak",
  "simpang pulai": "Perak",
  "pengkalan": "Perak",
  "pasir puteh ipoh": "Perak",
  "manjung": "Perak",
  "seri manjung": "Perak",
  "sitiawan": "Perak",
  "lumut": "Perak",
  "pangkor": "Perak",
  "ayer tawar": "Perak",
  "pantai remis": "Perak",
  "teluk intan": "Perak",
  "hutan melintang": "Perak",
  "bagan datuk": "Perak",
  "bagan datoh": "Perak",
  "kuala kangsar": "Perak",
  "sungai siput": "Perak",
  "sungei siput": "Perak",
  "padang rengas": "Perak",
  "tapah": "Perak",
  "bidor": "Perak",
  "sungkai": "Perak",
  "tanjung malim": "Perak",
  "tanjong malim": "Perak",
  "slim river": "Perak",
  "kampar": "Perak",
  "gopeng": "Perak",
  "malim nawar": "Perak",
  "parit buntar": "Perak",
  "bagan serai": "Perak",
  "kuala kurau": "Perak",
  "gerik": "Perak",
  "lenggong": "Perak",
  "pengkalan hulu": "Perak",
  "batu gajah": "Perak",
  "tronoh": "Perak",
  "seri iskandar": "Perak",
  "parit": "Perak",

  // === SELANGOR ===
  "shah alam": "Selangor",
  "petaling jaya": "Selangor",
  "subang jaya": "Selangor",
  "subang": "Selangor",
  "usj": "Selangor",
  "bandar sunway": "Selangor",
  "puchong": "Selangor",
  "kinrara": "Selangor",
  "putra heights": "Selangor",
  "klang": "Selangor",
  "port klang": "Selangor",
  "pelabuhan klang": "Selangor",
  "bukit tinggi klang": "Selangor",
  "bandar botanic": "Selangor",
  "bandar bukit tinggi": "Selangor",
  "kota kemuning": "Selangor",
  "bukit jelutong": "Selangor",
  "setia alam": "Selangor",
  "denai alam": "Selangor",
  "elmina": "Selangor",
  "glenmarie": "Selangor",
  "ara damansara": "Selangor",
  "damansara utama": "Selangor",
  "damansara perdana": "Selangor",
  "mutiara damansara": "Selangor",
  "kota damansara": "Selangor",
  "bandar utama": "Selangor",
  "sungai buloh": "Selangor",
  "sg buloh": "Selangor",
  "puncak alam": "Selangor",
  "saujana utama": "Selangor",
  "cyberjaya": "Selangor",
  "sepang": "Selangor",
  "salak tinggi": "Selangor",
  "dengkil": "Selangor",
  "bangi": "Selangor",
  "bandar baru bangi": "Selangor",
  "kajang": "Selangor",
  "semenyih": "Selangor",
  "beranang": "Selangor",
  "hulu langat": "Selangor",
  "cheras selatan": "Selangor",
  "balakong": "Selangor",
  "seri kembangan": "Selangor",
  "serdang": "Selangor",
  "equine park": "Selangor",
  "ampang": "Selangor",
  "pandan indah": "Selangor",
  "pandan jaya": "Selangor",
  "pandan mewah": "Selangor",
  "gombak": "Selangor",
  "selayang": "Selangor",
  "batu caves": "Selangor",
  "rawang": "Selangor",
  "bukit beruntung": "Selangor",
  "batang kali": "Selangor",
  "serendah": "Selangor",
  "kuala kubu bharu": "Selangor",
  "banting": "Selangor",
  "telok panglima garang": "Selangor",
  "jenjarom": "Selangor",
  "morib": "Selangor",
  "kuala selangor": "Selangor",
  "ijok": "Selangor",
  "bestari jaya": "Selangor",
  "tanjong karang": "Selangor",
  "sekinchan": "Selangor",
  "sabak bernam": "Selangor",
  "sungai besar": "Selangor",
  "hululangat": "Selangor",

  // === KUALA LUMPUR ===
  "kuala lumpur": "Kuala Lumpur",
  "klcc": "Kuala Lumpur",
  "bukit bintang": "Kuala Lumpur",
  "brickfields": "Kuala Lumpur",
  "bangsar": "Kuala Lumpur",
  "bangsar south": "Kuala Lumpur",
  "mont kiara": "Kuala Lumpur",
  "sri hartamas": "Kuala Lumpur",
  "dutamas": "Kuala Lumpur",
  "segambut": "Kuala Lumpur",
  "kepong": "Kuala Lumpur",
  "jinjang": "Kuala Lumpur",
  "sentul": "Kuala Lumpur",
  "setapak": "Kuala Lumpur",
  "wangsa maju": "Kuala Lumpur",
  "setiawangsa": "Kuala Lumpur",
  "keramat": "Kuala Lumpur",
  "titiwangsa": "Kuala Lumpur",
  "cheras": "Kuala Lumpur",
  "maluri": "Kuala Lumpur",
  "shamelin": "Kuala Lumpur",
  "taman connaught": "Kuala Lumpur",
  "bandar tun razak": "Kuala Lumpur",
  "sungai besi": "Kuala Lumpur",
  "bukit jalil": "Kuala Lumpur",
  "sri petaling": "Kuala Lumpur",
  "oug": "Kuala Lumpur",
  "kuchai lama": "Kuala Lumpur",
  "taman desa": "Kuala Lumpur",
  "seputeh": "Kuala Lumpur",
  "pantai dalam": "Kuala Lumpur",
  "desa parkcity": "Kuala Lumpur",
  "solaris": "Kuala Lumpur",
  "bandar sri damansara": "Kuala Lumpur",

  // === JOHOR ===
  "johor bahru": "Johor",
  "jb": "Johor",
  "iskandar puteri": "Johor",
  "nusajaya": "Johor",
  "medini": "Johor",
  "puteri harbour": "Johor",
  "horizon hills": "Johor",
  "eco botanic": "Johor",
  "bukit indah": "Johor",
  "skudai": "Johor",
  "senai": "Johor",
  "kulai": "Johor",
  "bandar putra kulai": "Johor",
  "indahpura": "Johor",
  "pasir gudang": "Johor",
  "masai": "Johor",
  "seri alam": "Johor",
  "plentong": "Johor",
  "permas jaya": "Johor",
  "mount austin": "Johor",
  "austin heights": "Johor",
  "setia indah": "Johor",
  "setia tropika": "Johor",
  "taman daya": "Johor",
  "tampoi": "Johor",
  "kempas": "Johor",
  "larkin": "Johor",
  "ulu tiram": "Johor",
  "kota tinggi": "Johor",
  "desaru": "Johor",
  "pengerang": "Johor",
  "pontian": "Johor",
  "pekan nanas": "Johor",
  "kukup": "Johor",
  "batu pahat": "Johor",
  "yong peng": "Johor",
  "ayer hitam": "Johor",
  "parit raja": "Johor",
  "muar": "Johor",
  "bakri": "Johor",
  "bukit gambir": "Johor",
  "tangkak": "Johor",
  "kluang": "Johor",
  "simpang renggam": "Johor",
  "kahang": "Johor",
  "segamat": "Johor",
  "labis": "Johor",
  "mersing": "Johor",
  "endau": "Johor",
  "pagoh": "Johor",
  "bandar universiti pagoh": "Johor",

  // === PENANG / PULAU PINANG ===
  "penang": "Penang",
  "pulau pinang": "Penang",
  "george town": "Penang",
  "georgetown": "Penang",
  "bayan lepas": "Penang",
  "bayan baru": "Penang",
  "gelugor": "Penang",
  "jelutong": "Penang",
  "air itam": "Penang",
  "tanjung tokong": "Penang",
  "tanjung bungah": "Penang",
  "batu ferringhi": "Penang",
  "balik pulau": "Penang",
  "teluk bahang": "Penang",
  "butterworth": "Penang",
  "raja uda": "Penang",
  "bagan ajam": "Penang",
  "seberang jaya": "Penang",
  "perai": "Penang",
  "bukit mertajam": "Penang",
  "alma": "Penang",
  "juru": "Penang",
  "simpang ampat": "Penang",
  "batu kawan": "Penang",
  "nibong tebal": "Penang",
  "jawi": "Penang",
  "sungai bakap": "Penang",
  "kepala batas": "Penang",
  "tasek gelugor": "Penang",

  // === KEDAH ===
  "kedah": "Kedah",
  "alor setar": "Kedah",
  "sungai petani": "Kedah",
  "amanjaya": "Kedah",
  "laguna merbok": "Kedah",
  "kulim": "Kedah",
  "kulim hi-tech": "Kedah",
  "lunas": "Kedah",
  "jitra": "Kedah",
  "changlun": "Kedah",
  "bukit kayu hitam": "Kedah",
  "langkawi": "Kedah",
  "kuah": "Kedah",
  "pantai cenang": "Kedah",
  "baling": "Kedah",
  "kuala kedah": "Kedah",
  "gurun": "Kedah",
  "bedong": "Kedah",
  "yan": "Kedah",
  "guar chempedak": "Kedah",
  "pendang": "Kedah",
  "pokok sena": "Kedah",
  "sik": "Kedah",

  // === PAHANG ===
  "pahang": "Pahang",
  "kuantan": "Pahang",
  "indera mahkota": "Pahang",
  "teluk cempedak": "Pahang",
  "gambang": "Pahang",
  "gebeng": "Pahang",
  "temerloh": "Pahang",
  "mentakab": "Pahang",
  "bentong": "Pahang",
  "karak": "Pahang",
  "genting highlands": "Pahang",
  "gohtong jaya": "Pahang",
  "bukit tinggi pahang": "Pahang",
  "raub": "Pahang",
  "jerantut": "Pahang",
  "cameron highlands": "Pahang",
  "tanah rata": "Pahang",
  "brinchang": "Pahang",
  "ringlet": "Pahang",
  "pekan": "Pahang",
  "kuala rompin": "Pahang",
  "muadzam shah": "Pahang",
  "bandar tun razak pahang": "Pahang",
  "maran": "Pahang",
  "kuala lipis": "Pahang",

  // === NEGERI SEMBILAN ===
  "negeri sembilan": "Negeri Sembilan",
  "seremban": "Negeri Sembilan",
  "seremban 2": "Negeri Sembilan",
  "bandar sri sendayan": "Negeri Sembilan",
  "sendayan": "Negeri Sembilan",
  "senawang": "Negeri Sembilan",
  "nilai": "Negeri Sembilan",
  "bandar baru nilai": "Negeri Sembilan",
  "putra nilai": "Negeri Sembilan",
  "bandar enstek": "Negeri Sembilan",
  "enstek": "Negeri Sembilan",
  "labu": "Negeri Sembilan",
  "mantin": "Negeri Sembilan",
  "port dickson": "Negeri Sembilan",
  "lukut": "Negeri Sembilan",
  "teluk kemang": "Negeri Sembilan",
  "bahau": "Negeri Sembilan",
  "jempol": "Negeri Sembilan",
  "tampin": "Negeri Sembilan",
  "kuala pilah": "Negeri Sembilan",
  "rembau": "Negeri Sembilan",
  "pedas": "Negeri Sembilan",

  // === MELAKA ===
  "melaka": "Melaka",
  "malacca": "Melaka",
  "banda hilir": "Melaka",
  "ayer keroh": "Melaka",
  "batu berendam": "Melaka",
  "bukit baru": "Melaka",
  "bukit katil": "Melaka",
  "cheng": "Melaka",
  "krubong": "Melaka",
  "malim jaya": "Melaka",
  "klebang melaka": "Melaka",
  "tanjung kling": "Melaka",
  "alor gajah": "Melaka",
  "masjid tanah": "Melaka",
  "durian tunggal": "Melaka",
  "pulau sebang": "Melaka",
  "jasin": "Melaka",
  "merlimau": "Melaka",
  "bemban": "Melaka",

  // === KELANTAN ===
  "kelantan": "Kelantan",
  "kota bharu": "Kelantan",
  "kubang kerian": "Kelantan",
  "pengkalan chepa": "Kelantan",
  "wakaf bharu": "Kelantan",
  "pasir mas": "Kelantan",
  "rantau panjang": "Kelantan",
  "tumpat": "Kelantan",
  "bachok": "Kelantan",
  "pasir puteh": "Kelantan",
  "tanah merah": "Kelantan",
  "machang": "Kelantan",
  "kuala krai": "Kelantan",
  "gua musang": "Kelantan",
  "jeli": "Kelantan",

  // === TERENGGANU ===
  "terengganu": "Terengganu",
  "kuala terengganu": "Terengganu",
  "gong badak": "Terengganu",
  "kuala nerus": "Terengganu",
  "kemaman": "Terengganu",
  "chukai": "Terengganu",
  "cukai": "Terengganu",
  "kerteh": "Terengganu",
  "paka": "Terengganu",
  "dungun": "Terengganu",
  "besut": "Terengganu",
  "jerteh": "Terengganu",
  "kuala besut": "Terengganu",
  "marang": "Terengganu",
  "kuala berang": "Terengganu",

  // === SABAH ===
  "sabah": "Sabah",
  "kota kinabalu": "Sabah",
  "inanam": "Sabah",
  "likas": "Sabah",
  "luyang": "Sabah",
  "menggatal": "Sabah",
  "sepanggar": "Sabah",
  "penampang": "Sabah",
  "donggongon": "Sabah",
  "putatan": "Sabah",
  "tuaran": "Sabah",
  "sandakan": "Sabah",
  "tawau": "Sabah",
  "lahad datu": "Sabah",
  "keningau": "Sabah",
  "semporna": "Sabah",
  "papar": "Sabah",
  "kundasang": "Sabah",
  "ranau": "Sabah",
  "beaufort": "Sabah",
  "sipitang": "Sabah",
  "kota belud": "Sabah",

  // === SARAWAK ===
  "sarawak": "Sarawak",
  "kuching": "Sarawak",
  "padawan": "Sarawak",
  "matang sarawak": "Sarawak",
  "petra jaya": "Sarawak",
  "kota samarahan": "Sarawak",
  "samarahan": "Sarawak",
  "batu kawa": "Sarawak",
  "tabuan": "Sarawak",
  "miri": "Sarawak",
  "lutong": "Sarawak",
  "senadin": "Sarawak",
  "sibu": "Sarawak",
  "bintulu": "Sarawak",
  "kidurong": "Sarawak",
  "sri aman": "Sarawak",
  "sarikei": "Sarawak",
  "mukah": "Sarawak",
  "kapit": "Sarawak",
  "limbang": "Sarawak",
  "lawas": "Sarawak",

  // === PERLIS ===
  "perlis": "Perlis",
  "kangar": "Perlis",
  "arau": "Perlis",
  "kuala perlis": "Perlis",
  "padang besar": "Perlis",
  "simpang empat perlis": "Perlis",
  "beseri": "Perlis",

  // === PUTRAJAYA & LABUAN ===
  "putrajaya": "Putrajaya",
  "presint 1": "Putrajaya",
  "presint 2": "Putrajaya",
  "presint 3": "Putrajaya",
  "presint 4": "Putrajaya",
  "presint 5": "Putrajaya",
  "presint 6": "Putrajaya",
  "presint 7": "Putrajaya",
  "presint 8": "Putrajaya",
  "presint 9": "Putrajaya",
  "presint 10": "Putrajaya",
  "presint 11": "Putrajaya",
  "presint 12": "Putrajaya",
  "presint 13": "Putrajaya",
  "presint 14": "Putrajaya",
  "presint 15": "Putrajaya",
  "presint 16": "Putrajaya",
  "presint 17": "Putrajaya",
  "presint 18": "Putrajaya",
  "presint 19": "Putrajaya",
  "presint 20": "Putrajaya",
  "labuan": "Labuan",
  "victoria labuan": "Labuan",
};

/**
 * 3. Fast Synchronous State Detector
 */
export function detectMalaysianState(
  text?: string
): { state: MalaysianState; matchedKeyword: string; confidence: "high" | "medium" } | null {
  if (!text) return null;
  const clean = text.toLowerCase();

  // Tier 1: Check 5-Digit Postcode
  const postcodeState = getStateFromPostcode(clean);
  if (postcodeState) {
    return { state: postcodeState, matchedKeyword: "Postcode", confidence: "high" };
  }

  // Tier 2: Search specific towns and districts in dictionary (longest match first)
  const sortedKeywords = Object.keys(LOCATION_TO_STATE_DICT).sort((a, b) => b.length - a.length);

  for (const kw of sortedKeywords) {
    // Regex boundary check to avoid substring confusion (e.g. 'ipoh' inside 'disiplin')
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(clean)) {
      return {
        state: LOCATION_TO_STATE_DICT[kw],
        matchedKeyword: kw,
        confidence: "high",
      };
    }
  }

  // Tier 3: Direct state match
  for (const s of MALAYSIAN_STATES) {
    const sLower = s.toLowerCase();
    const regex = new RegExp(`\\b${sLower}\\b`, "i");
    if (regex.test(clean)) {
      return { state: s, matchedKeyword: s, confidence: "high" };
    }
  }

  return null;
}

/**
 * 4. Resolves true listing state & formatted location string for UI display
 */
export function resolveListingLocation(
  listing: Partial<PropertyListing> | null | undefined
): { displayState: string; displayLocation: string; detectedFromText: boolean } {
  if (!listing) {
    return { displayState: "Selangor", displayLocation: "Selangor", detectedFromText: false };
  }

  const currentNegeri = (listing.negeri || "").trim();
  const rawAlamat = (listing.alamat || "").trim();
  const rawTajuk = (listing.tajuk || "").trim();
  const rawDesc = ((listing as any).description || "").trim();

  // Combine address, title, and description for scanning
  const combinedText = `${rawAlamat} ${rawTajuk} ${rawDesc}`.trim();
  const detected = detectMalaysianState(combinedText);

  let finalState = currentNegeri || "Selangor";
  let detectedFromText = false;

  if (detected) {
    // If current state was empty, or was the old default "Selangor" but the text explicitly mentions another state
    if (!currentNegeri || (currentNegeri.toLowerCase() === "selangor" && detected.state !== "Selangor")) {
      finalState = detected.state;
      detectedFromText = true;
    }
  }

  // Construct nice location string
  let displayLocation = "";
  if (rawAlamat) {
    if (rawAlamat.toLowerCase().includes(finalState.toLowerCase())) {
      displayLocation = rawAlamat;
    } else {
      displayLocation = `${rawAlamat}, ${finalState}`;
    }
  } else {
    displayLocation = finalState;
  }

  return {
    displayState: finalState,
    displayLocation,
    detectedFromText,
  };
}

/**
 * 5. Town & District GPS Coordinates Database
 */
export const TOWN_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  // === PERAK ===
  "taiping": { latitude: 4.8517, longitude: 100.7333 },
  "kamunting": { latitude: 4.8872, longitude: 100.7294 },
  "ayer puteh": { latitude: 4.8950, longitude: 100.7180 },
  "tanah ayer puteh": { latitude: 4.8950, longitude: 100.7180 },
  "simpang": { latitude: 4.8197, longitude: 100.7064 },
  "pokok assam": { latitude: 4.8322, longitude: 100.7383 },
  "aulong": { latitude: 4.8569, longitude: 100.7119 },
  "matang": { latitude: 4.8167, longitude: 100.6722 },
  "batu kurau": { latitude: 4.9747, longitude: 100.7964 },
  "selama": { latitude: 5.2214, longitude: 100.6931 },
  "kuala kangsar": { latitude: 4.7738, longitude: 100.9419 },
  "sungai siput": { latitude: 4.8167, longitude: 101.0667 },
  "sungei siput": { latitude: 4.8167, longitude: 101.0667 },
  "ipoh": { latitude: 4.5975, longitude: 101.0901 },
  "bercham": { latitude: 4.6367, longitude: 101.1256 },
  "tambun": { latitude: 4.6083, longitude: 101.1394 },
  "klebang": { latitude: 4.6667, longitude: 101.1167 },
  "chemor": { latitude: 4.7186, longitude: 101.1189 },
  "tanjung rambutan": { latitude: 4.6706, longitude: 101.1558 },
  "menglembu": { latitude: 4.5622, longitude: 101.0478 },
  "silibin": { latitude: 4.6000, longitude: 101.0667 },
  "jelapang": { latitude: 4.6333, longitude: 101.0667 },
  "lahat": { latitude: 4.5386, longitude: 101.0369 },
  "batu gajah": { latitude: 4.4692, longitude: 101.0411 },
  "gopeng": { latitude: 4.4736, longitude: 101.1656 },
  "kampar": { latitude: 4.3000, longitude: 101.1500 },
  "seri iskandar": { latitude: 4.3592, longitude: 100.9781 },
  "tronoh": { latitude: 4.4194, longitude: 100.9881 },
  "manjung": { latitude: 4.2167, longitude: 100.6667 },
  "seri manjung": { latitude: 4.1950, longitude: 100.6625 },
  "sitiawan": { latitude: 4.2167, longitude: 100.7000 },
  "lumut": { latitude: 4.2333, longitude: 100.6333 },
  "pangkor": { latitude: 4.2217, longitude: 100.5606 },
  "pantai remis": { latitude: 4.4500, longitude: 100.6333 },
  "teluk intan": { latitude: 4.0259, longitude: 101.0189 },
  "bagan datuk": { latitude: 3.9875, longitude: 100.7858 },
  "tapah": { latitude: 4.1833, longitude: 101.2667 },
  "bidor": { latitude: 4.1167, longitude: 101.2833 },
  "sungkai": { latitude: 3.9967, longitude: 101.3094 },
  "tanjung malim": { latitude: 3.6833, longitude: 101.5167 },
  "slim river": { latitude: 3.8333, longitude: 101.4000 },
  "parit buntar": { latitude: 5.1267, longitude: 100.4878 },
  "bagan serai": { latitude: 5.0108, longitude: 100.5336 },
  "gerik": { latitude: 5.4292, longitude: 101.1306 },
  "lenggong": { latitude: 5.1061, longitude: 100.9678 },

  // === SELANGOR ===
  "shah alam": { latitude: 3.0738, longitude: 101.5183 },
  "petaling jaya": { latitude: 3.1073, longitude: 101.6067 },
  "subang jaya": { latitude: 3.0567, longitude: 101.5851 },
  "subang": { latitude: 3.1250, longitude: 101.5458 },
  "usj": { latitude: 3.0450, longitude: 101.5900 },
  "puchong": { latitude: 3.0167, longitude: 101.6167 },
  "kinrara": { latitude: 3.0400, longitude: 101.6450 },
  "klang": { latitude: 3.0449, longitude: 101.4456 },
  "port klang": { latitude: 3.0000, longitude: 101.4000 },
  "setia alam": { latitude: 3.1061, longitude: 101.4644 },
  "denai alam": { latitude: 3.1558, longitude: 101.5189 },
  "elmina": { latitude: 3.1833, longitude: 101.5167 },
  "bukit jelutong": { latitude: 3.0997, longitude: 101.5306 },
  "kota kemuning": { latitude: 3.0042, longitude: 101.5392 },
  "ara damansara": { latitude: 3.1189, longitude: 101.5769 },
  "kota damansara": { latitude: 3.1500, longitude: 101.5833 },
  "damansara": { latitude: 3.1333, longitude: 101.6000 },
  "bandar utama": { latitude: 3.1481, longitude: 101.6169 },
  "sungai buloh": { latitude: 3.2089, longitude: 101.5744 },
  "puncak alam": { latitude: 3.2300, longitude: 101.4289 },
  "saujana utama": { latitude: 3.2100, longitude: 101.4800 },
  "cyberjaya": { latitude: 2.9213, longitude: 101.6559 },
  "sepang": { latitude: 2.6933, longitude: 101.7489 },
  "salak tinggi": { latitude: 2.8089, longitude: 101.7397 },
  "bangi": { latitude: 2.9289, longitude: 101.7801 },
  "kajang": { latitude: 2.9935, longitude: 101.7874 },
  "semenyih": { latitude: 2.9492, longitude: 101.8447 },
  "seri kembangan": { latitude: 3.0208, longitude: 101.7058 },
  "serdang": { latitude: 3.0200, longitude: 101.7000 },
  "ampang": { latitude: 3.1499, longitude: 101.7613 },
  "gombak": { latitude: 3.2667, longitude: 101.7000 },
  "selayang": { latitude: 3.2408, longitude: 101.6669 },
  "batu caves": { latitude: 3.2372, longitude: 101.6842 },
  "rawang": { latitude: 3.3213, longitude: 101.5767 },
  "bukit beruntung": { latitude: 3.4217, longitude: 101.5583 },
  "banting": { latitude: 2.8136, longitude: 101.4986 },
  "kuala selangor": { latitude: 3.3458, longitude: 101.2500 },
  "sekinchan": { latitude: 3.5089, longitude: 101.1022 },

  // === KUALA LUMPUR ===
  "kuala lumpur": { latitude: 3.1390, longitude: 101.6869 },
  "klcc": { latitude: 3.1578, longitude: 101.7123 },
  "bukit bintang": { latitude: 3.1466, longitude: 101.7115 },
  "bangsar": { latitude: 3.1292, longitude: 101.6706 },
  "mont kiara": { latitude: 3.1678, longitude: 101.6528 },
  "sri hartamas": { latitude: 3.1633, longitude: 101.6522 },
  "cheras": { latitude: 3.0645, longitude: 101.7454 },
  "setapak": { latitude: 3.1906, longitude: 101.7083 },
  "wangsa maju": { latitude: 3.1989, longitude: 101.7372 },
  "kepong": { latitude: 3.2167, longitude: 101.6333 },
  "sentul": { latitude: 3.1833, longitude: 101.6833 },
  "bukit jalil": { latitude: 3.0583, longitude: 101.6833 },
  "sri petaling": { latitude: 3.0708, longitude: 101.6931 },
  "sungai besi": { latitude: 3.0767, longitude: 101.7078 },
  "desa parkcity": { latitude: 3.1869, longitude: 101.6347 },

  // === JOHOR ===
  "johor bahru": { latitude: 1.4927, longitude: 103.7414 },
  "jb": { latitude: 1.4927, longitude: 103.7414 },
  "iskandar puteri": { latitude: 1.4244, longitude: 103.6264 },
  "nusajaya": { latitude: 1.4244, longitude: 103.6264 },
  "medini": { latitude: 1.4289, longitude: 103.6289 },
  "skudai": { latitude: 1.5368, longitude: 103.6583 },
  "senai": { latitude: 1.6000, longitude: 103.6500 },
  "kulai": { latitude: 1.6633, longitude: 103.6033 },
  "pasir gudang": { latitude: 1.4725, longitude: 103.9014 },
  "masai": { latitude: 1.4883, longitude: 103.8842 },
  "mount austin": { latitude: 1.5544, longitude: 103.7850 },
  "austin heights": { latitude: 1.5544, longitude: 103.7850 },
  "tampoi": { latitude: 1.5000, longitude: 103.7000 },
  "kempas": { latitude: 1.5300, longitude: 103.7100 },
  "ulu tiram": { latitude: 1.6000, longitude: 103.8167 },
  "kota tinggi": { latitude: 1.7381, longitude: 103.8997 },
  "pontian": { latitude: 1.4989, longitude: 103.3897 },
  "pekan nanas": { latitude: 1.5100, longitude: 103.5133 },
  "batu pahat": { latitude: 1.8548, longitude: 102.9325 },
  "yong peng": { latitude: 2.0136, longitude: 103.0658 },
  "ayer hitam": { latitude: 1.9167, longitude: 103.1833 },
  "muar": { latitude: 2.0442, longitude: 102.5689 },
  "pagoh": { latitude: 2.1485, longitude: 102.7231 },
  "tangkak": { latitude: 2.2672, longitude: 102.5456 },
  "kluang": { latitude: 2.0305, longitude: 103.3187 },
  "simpang renggam": { latitude: 1.8261, longitude: 103.3094 },
  "segamat": { latitude: 2.5147, longitude: 102.8158 },
  "mersing": { latitude: 2.4311, longitude: 103.8406 },

  // === PENANG ===
  "george town": { latitude: 5.4164, longitude: 100.3327 },
  "georgetown": { latitude: 5.4164, longitude: 100.3327 },
  "bayan lepas": { latitude: 5.2958, longitude: 100.2658 },
  "bayan baru": { latitude: 5.3283, longitude: 100.2850 },
  "butterworth": { latitude: 5.3991, longitude: 100.3638 },
  "bukit mertajam": { latitude: 5.3630, longitude: 100.4667 },
  "seberang jaya": { latitude: 5.3942, longitude: 100.4008 },
  "batu kawan": { latitude: 5.2675, longitude: 100.4347 },
  "nibong tebal": { latitude: 5.1667, longitude: 100.4833 },
  "kepala batas": { latitude: 5.5175, longitude: 100.4289 },

  // === KEDAH ===
  "alor setar": { latitude: 6.1256, longitude: 100.3673 },
  "sungai petani": { latitude: 5.6470, longitude: 100.4877 },
  "kulim": { latitude: 5.3667, longitude: 100.5500 },
  "jitra": { latitude: 6.2667, longitude: 100.4167 },
  "langkawi": { latitude: 6.3500, longitude: 99.8000 },
  "baling": { latitude: 5.6667, longitude: 100.9167 },

  // === PAHANG ===
  "kuantan": { latitude: 3.8126, longitude: 103.3256 },
  "temerloh": { latitude: 3.4500, longitude: 102.4167 },
  "mentakab": { latitude: 3.4833, longitude: 102.3500 },
  "bentong": { latitude: 3.5222, longitude: 101.9089 },
  "cameron highlands": { latitude: 4.4714, longitude: 101.3764 },
  "genting highlands": { latitude: 3.4239, longitude: 101.7933 },

  // === NEGERI SEMBILAN ===
  "seremban": { latitude: 2.7258, longitude: 101.9424 },
  "seremban 2": { latitude: 2.6958, longitude: 101.9089 },
  "sendayan": { latitude: 2.6667, longitude: 101.8833 },
  "senawang": { latitude: 2.6833, longitude: 101.9833 },
  "nilai": { latitude: 2.8167, longitude: 101.8000 },
  "port dickson": { latitude: 2.5228, longitude: 101.7958 },
  "bahau": { latitude: 2.8078, longitude: 102.4081 },

  // === MELAKA ===
  "melaka": { latitude: 2.1896, longitude: 102.2501 },
  "ayer keroh": { latitude: 2.2708, longitude: 102.2858 },
  "alor gajah": { latitude: 2.3833, longitude: 102.2167 },
  "jasin": { latitude: 2.3089, longitude: 102.4319 },

  // === KELANTAN ===
  "kota bharu": { latitude: 6.1254, longitude: 102.2381 },
  "kubang kerian": { latitude: 6.0867, longitude: 102.2764 },
  "pasir mas": { latitude: 6.0417, longitude: 102.1417 },
  "tanah merah": { latitude: 5.8089, longitude: 102.1475 },
  "gua musang": { latitude: 4.8833, longitude: 101.9667 },

  // === TERENGGANU ===
  "kuala terengganu": { latitude: 5.3117, longitude: 103.1324 },
  "kemaman": { latitude: 4.2333, longitude: 103.4167 },
  "cukai": { latitude: 4.2500, longitude: 103.4167 },
  "dungun": { latitude: 4.7758, longitude: 103.4244 },
  "kerteh": { latitude: 4.5142, longitude: 103.4475 },

  // === SABAH ===
  "kota kinabalu": { latitude: 5.9804, longitude: 116.0735 },
  "sandakan": { latitude: 5.8394, longitude: 118.1172 },
  "tawau": { latitude: 4.2447, longitude: 117.8911 },
  "penampang": { latitude: 5.9167, longitude: 116.1167 },
  "lahad datu": { latitude: 5.0267, longitude: 118.3272 },

  // === SARAWAK ===
  "kuching": { latitude: 1.5533, longitude: 110.3592 },
  "miri": { latitude: 4.3995, longitude: 113.9914 },
  "sibu": { latitude: 2.3000, longitude: 111.8167 },
  "bintulu": { latitude: 3.1667, longitude: 113.0333 },
  "kota samarahan": { latitude: 1.4608, longitude: 110.4975 },

  // === PERLIS, PUTRAJAYA, LABUAN ===
  "kangar": { latitude: 6.4414, longitude: 100.1986 },
  "arau": { latitude: 6.4297, longitude: 100.2742 },
  "putrajaya": { latitude: 2.9264, longitude: 101.6964 },
  "labuan": { latitude: 5.2831, longitude: 115.2308 },
};

export const STATE_BASE_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  "kuala lumpur": { latitude: 3.139, longitude: 101.6869 },
  "selangor": { latitude: 3.0738, longitude: 101.5183 },
  "putrajaya": { latitude: 2.9264, longitude: 101.6964 },
  "perak": { latitude: 4.5921, longitude: 101.0901 },
  "penang": { latitude: 5.4164, longitude: 100.3327 },
  "pulau pinang": { latitude: 5.4164, longitude: 100.3327 },
  "johor": { latitude: 1.4927, longitude: 103.7414 },
  "kedah": { latitude: 6.1184, longitude: 100.3685 },
  "kelantan": { latitude: 6.1254, longitude: 102.2381 },
  "melaka": { latitude: 2.1896, longitude: 102.2501 },
  "malacca": { latitude: 2.1896, longitude: 102.2501 },
  "negeri sembilan": { latitude: 2.7258, longitude: 101.9424 },
  "pahang": { latitude: 3.8126, longitude: 103.3256 },
  "perlis": { latitude: 6.4449, longitude: 100.1986 },
  "sabah": { latitude: 5.9804, longitude: 116.0735 },
  "sarawak": { latitude: 1.5533, longitude: 110.3592 },
  "terengganu": { latitude: 5.3117, longitude: 103.1324 },
  "labuan": { latitude: 5.2831, longitude: 115.2308 },
};

/**
 * Resolves precise coordinates for a listing on Google Maps
 */
export function getSmartListingCoordinates(
  item: Partial<PropertyListing>,
  index: number = 0
): { latitude: number; longitude: number; resolvedTown?: string } {
  // 1. If valid custom GPS was saved, use it
  if (
    item.location &&
    typeof item.location.latitude === "number" &&
    typeof item.location.longitude === "number" &&
    item.location.latitude !== 0 &&
    item.location.longitude !== 0
  ) {
    return { latitude: item.location.latitude, longitude: item.location.longitude };
  }

  // 2. Scan combined text for exact town match in TOWN_COORDINATES
  const combined = `${item.alamat || ""} ${item.tajuk || ""} ${(item as any)?.description || ""}`.toLowerCase();
  const sortedTowns = Object.keys(TOWN_COORDINATES).sort((a, b) => b.length - a.length);

  for (const town of sortedTowns) {
    const regex = new RegExp(`\\b${town.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(combined)) {
      const townCoords = TOWN_COORDINATES[town];
      const offsetLat = ((index % 7) - 3) * 0.004 + (((item.id?.charCodeAt(0) || 0)) % 5) * 0.0008;
      const offsetLng = (((index * 3) % 7) - 3) * 0.004 + (((item.id?.charCodeAt((item.id?.length || 1) - 1) || 0)) % 5) * 0.0008;
      return {
        latitude: townCoords.latitude + offsetLat,
        longitude: townCoords.longitude + offsetLng,
        resolvedTown: town,
      };
    }
  }

  // 3. Fallback to state capital coordinates
  const resolvedState = resolveListingLocation(item).displayState.toLowerCase().trim();
  const base = STATE_BASE_COORDINATES[resolvedState] || { latitude: 3.139, longitude: 101.6869 };
  const offsetLat = ((index % 7) - 3) * 0.015 + (((item.id?.charCodeAt(0) || 0)) % 5) * 0.002;
  const offsetLng = (((index * 3) % 7) - 3) * 0.015 + (((item.id?.charCodeAt((item.id?.length || 1) - 1) || 0)) % 5) * 0.002;

  return {
    latitude: base.latitude + offsetLat,
    longitude: base.longitude + offsetLng,
  };
}
