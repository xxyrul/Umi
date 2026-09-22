import 'dart:math' as math;

class LocationDetectionResult {
  final double? latitude;
  final double? longitude;
  final String? state;
  final String? postcode;

  const LocationDetectionResult({
    this.latitude,
    this.longitude,
    this.state,
    this.postcode,
  });

  bool get hasCoordinates => latitude != null && longitude != null;
}

class SmartCoords {
  final double latitude;
  final double longitude;
  final String? resolvedTown;
  final bool isExactGps;

  const SmartCoords({
    required this.latitude,
    required this.longitude,
    this.resolvedTown,
    this.isExactGps = false,
  });
}

class MalaysianLocationDetector {
  static const List<String> statesList = [
    'Selangor',
    'Kuala Lumpur',
    'Putrajaya',
    'Johor',
    'Penang',
    'Perak',
    'Kedah',
    'Negeri Sembilan',
    'Melaka',
    'Pahang',
    'Kelantan',
    'Terengganu',
    'Perlis',
    'Sabah',
    'Sarawak',
    'Labuan',
  ];

  /// Comprehensive Malaysian Town, District & Mukim Coordinates
  /// Ordered so specific tamans/sub-districts match before generic towns
  static const Map<String, ({double lat, double lng})> townCoordinates = {
    // === KERIAN & LARUT, MATANG, SELAMA (PERAK) ===
    'bagan tiang': (lat: 5.1167, lng: 100.4167),
    'tanjung piandang': (lat: 5.0747, lng: 100.3878),
    'kuala kurau': (lat: 5.0167, lng: 100.4333),
    'bagan serai': (lat: 5.0108, lng: 100.5336),
    'prima bagan serai': (lat: 5.0108, lng: 100.5336),
    'parit buntar': (lat: 5.1267, lng: 100.4878),
    'taman permai parit buntar': (lat: 5.1267, lng: 100.4878),
    'selama': (lat: 5.2214, lng: 100.6931),
    'taman menteri': (lat: 5.2214, lng: 100.6931),
    'ijok': (lat: 5.1450, lng: 100.7500),
    'batu kurau': (lat: 4.9747, lng: 100.7964),
    'ceruk pelanduk': (lat: 4.9747, lng: 100.7964),
    'bukit bertam': (lat: 5.2156, lng: 100.6955),
    'padang kering': (lat: 5.2156, lng: 100.6955),
    'kamunting': (lat: 4.8872, lng: 100.7294),
    'taman rakyat': (lat: 4.8872, lng: 100.7294),
    'bukit jana': (lat: 4.8980, lng: 100.7380),
    'taman jana': (lat: 4.8980, lng: 100.7380),
    'taman desa jaya': (lat: 4.8780, lng: 100.7320),
    'taman saujana': (lat: 4.8720, lng: 100.7250),
    'taman desa murni': (lat: 4.8820, lng: 100.7310),
    'taman kamunting aman': (lat: 4.8910, lng: 100.7260),
    'taman larah ria': (lat: 4.8850, lng: 100.7340),
    'taman air putih permai': (lat: 4.8950, lng: 100.7180),
    'ayer puteh': (lat: 4.8950, lng: 100.7180),
    'air putih': (lat: 4.8950, lng: 100.7180),
    'taiping': (lat: 4.8517, lng: 100.7333),
    'kg pak darus': (lat: 4.8517, lng: 100.7333),
    'simpang': (lat: 4.8197, lng: 100.7064),
    'pokok assam': (lat: 4.8322, lng: 100.7383),
    'aulong': (lat: 4.8569, lng: 100.7119),
    'matang': (lat: 4.8167, lng: 100.6722),

    // === KINTA & OTHER PERAK REGIONS ===
    'kuala kangsar': (lat: 4.7738, lng: 100.9419),
    'lenggong': (lat: 5.1061, lng: 100.9678),
    'gerik': (lat: 5.4292, lng: 101.1306),
    'sungai siput': (lat: 4.8167, lng: 101.0667),
    'sungei siput': (lat: 4.8167, lng: 101.0667),
    'chemor': (lat: 4.7186, lng: 101.1189),
    'taman chemor sejahtera': (lat: 4.7186, lng: 101.1189),
    'meru ipoh': (lat: 4.6700, lng: 101.0700),
    'taman chepor idaman': (lat: 4.6700, lng: 101.0700),
    'chepor': (lat: 4.6700, lng: 101.0700),
    'ipoh': (lat: 4.5975, lng: 101.0901),
    'bercham': (lat: 4.6367, lng: 101.1256),
    'tambun': (lat: 4.6083, lng: 101.1394),
    'klebang': (lat: 4.6667, lng: 101.1167),
    'tanjung rambutan': (lat: 4.6706, lng: 101.1558),
    'menglembu': (lat: 4.5622, lng: 101.0478),
    'batu gajah': (lat: 4.4692, lng: 101.0411),
    'gopeng': (lat: 4.4736, lng: 101.1656),
    'kampar': (lat: 4.3000, lng: 101.1500),
    'seri iskandar': (lat: 4.3592, lng: 100.9781),
    'tronoh': (lat: 4.4194, lng: 100.9881),
    'taman tronoh akasia': (lat: 4.3592, lng: 100.9781),
    'bota': (lat: 4.3500, lng: 100.8667),
    'gelung pepuyu': (lat: 4.3500, lng: 100.8667),
    'manjung': (lat: 4.2167, lng: 100.6667),
    'seri manjung': (lat: 4.1950, lng: 100.6625),
    'sitiawan': (lat: 4.2167, lng: 100.7000),
    'lumut': (lat: 4.2333, lng: 100.6333),
    'pantai remis': (lat: 4.4500, lng: 100.6333),
    'teluk intan': (lat: 4.0259, lng: 101.0189),
    'bagan datuk': (lat: 3.9875, lng: 100.7858),
    'tapah': (lat: 4.1833, lng: 101.2667),
    'bidor': (lat: 4.1167, lng: 101.2833),
    'sungkai': (lat: 3.9967, lng: 101.3094),
    'tanjung malim': (lat: 3.6833, lng: 101.5167),
    'slim river': (lat: 3.8333, lng: 101.4000),

    // === KEDAH ===
    'padang serai': (lat: 5.5125, lng: 100.5539),
    'taman lagenda': (lat: 5.5125, lng: 100.5539),
    'kulim': (lat: 5.3667, lng: 100.5500),
    'kulim square': (lat: 5.4280, lng: 100.5380),
    'lunas': (lat: 5.4280, lng: 100.5380),
    'kulim perdana': (lat: 5.3667, lng: 100.5500),
    'kulim hi-tech': (lat: 5.4200, lng: 100.5800),
    'sungai petani': (lat: 5.6470, lng: 100.4877),
    'sg petani': (lat: 5.6470, lng: 100.4877),
    'sungai lalang': (lat: 5.6980, lng: 100.5180),
    'sg lalang': (lat: 5.6980, lng: 100.5180),
    'bandar puteri jaya': (lat: 5.6120, lng: 100.5280),
    'seri astana': (lat: 5.6180, lng: 100.5150),
    'sri astana': (lat: 5.6180, lng: 100.5150),
    'cinta sayang': (lat: 5.6600, lng: 100.5100),
    'taman tuanku haminah': (lat: 5.6550, lng: 100.5050),
    'taman tiong': (lat: 5.6365, lng: 100.4796),
    'taman sri wang': (lat: 5.6482, lng: 100.4842),
    'ambangan height': (lat: 5.7000, lng: 100.5400),
    'taman sinar intan': (lat: 5.6250, lng: 100.4800),
    'alor setar': (lat: 6.1256, lng: 100.3673),
    'taman samudera': (lat: 6.1256, lng: 100.3673),
    'jitra': (lat: 6.2667, lng: 100.4167),
    'baling': (lat: 5.6667, lng: 100.9167),
    'langkawi': (lat: 6.3500, lng: 99.8000),

    // === PENANG / SEBERANG PERAI ===
    'simpang ampat': (lat: 5.2817, lng: 100.4789),
    'aster villa': (lat: 5.2817, lng: 100.4789),
    'jawi': (lat: 5.2045, lng: 100.4950),
    'taman jawi jaya': (lat: 5.2045, lng: 100.4950),
    'nibong tebal': (lat: 5.1667, lng: 100.4833),
    'batu kawan': (lat: 5.2675, lng: 100.4347),
    'bukit mertajam': (lat: 5.3630, lng: 100.4667),
    'taman sukun': (lat: 5.3450, lng: 100.4600),
    'delima emas': (lat: 5.3450, lng: 100.4400),
    'butterworth': (lat: 5.3991, lng: 100.3638),
    'seberang jaya': (lat: 5.3942, lng: 100.4008),
    'george town': (lat: 5.4164, lng: 100.3327),
    'georgetown': (lat: 5.4164, lng: 100.3327),
    'bayan lepas': (lat: 5.2958, lng: 100.2658),

    // === MELAKA ===
    'alor gajah': (lat: 2.3833, lng: 102.2167),
    'solok duku': (lat: 2.3667, lng: 102.1833),
    'ayer keroh': (lat: 2.2708, lng: 102.2858),
    'melaka': (lat: 2.1896, lng: 102.2501),
    'jasin': (lat: 2.3089, lng: 102.4319),

    // === SELANGOR & KUALA LUMPUR ===
    'shah alam': (lat: 3.0738, lng: 101.5183),
    'petaling jaya': (lat: 3.1073, lng: 101.6067),
    'subang jaya': (lat: 3.0567, lng: 101.5851),
    'puchong': (lat: 3.0167, lng: 101.6167),
    'klang': (lat: 3.0449, lng: 101.4456),
    'setia alam': (lat: 3.1061, lng: 101.4644),
    'cyberjaya': (lat: 2.9213, lng: 101.6559),
    'bangi': (lat: 2.9289, lng: 101.7801),
    'kajang': (lat: 2.9935, lng: 101.7874),
    'kuala lumpur': (lat: 3.1390, lng: 101.6869),
    'putrajaya': (lat: 2.9264, lng: 101.6964),

    // === JOHOR ===
    'johor bahru': (lat: 1.4927, lng: 103.7414),
    'jb': (lat: 1.4927, lng: 103.7414),
    'skudai': (lat: 1.5368, lng: 103.6583),
    'kulai': (lat: 1.6633, lng: 103.6033),
    'batu pahat': (lat: 1.8548, lng: 102.9325),
    'muar': (lat: 2.0442, lng: 102.5689),
    'kluang': (lat: 2.0305, lng: 103.3187),
  };

  static const Map<String, ({double lat, double lng})> stateBaseCoordinates = {
    'kuala lumpur': (lat: 3.1390, lng: 101.6869),
    'selangor': (lat: 3.0738, lng: 101.5183),
    'putrajaya': (lat: 2.9264, lng: 101.6964),
    'perak': (lat: 4.8517, lng: 100.7333),
    'penang': (lat: 5.4164, lng: 100.3327),
    'pulau pinang': (lat: 5.4164, lng: 100.3327),
    'johor': (lat: 1.4927, lng: 103.7414),
    'kedah': (lat: 5.6470, lng: 100.4877), // default to Sungai Petani / southern hub
    'kelantan': (lat: 6.1254, lng: 102.2381),
    'melaka': (lat: 2.1896, lng: 102.2501),
    'negeri sembilan': (lat: 2.7258, lng: 101.9424),
    'pahang': (lat: 3.8126, lng: 103.3256),
    'perlis': (lat: 6.4449, lng: 100.1986),
    'sabah': (lat: 5.9804, lng: 116.0735),
    'sarawak': (lat: 1.5533, lng: 110.3592),
    'terengganu': (lat: 5.3117, lng: 103.1324),
    'labuan': (lat: 5.2831, lng: 115.2308),
  };

  /// Calculates approximate distance in km between two lat/lng coordinates (Haversine formula)
  static double _calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const p = 0.017453292519943295; // Math.PI / 180
    final a = 0.5 - math.cos((lat2 - lat1) * p) / 2 +
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2;
    return 12742 * math.asin(math.sqrt(a)); // 2 * R; R = 6371 km
  }

  /// Resolves true listing coordinates by learning from title, address, and state.
  /// Detects and overrides accidental agent office GPS.
  static SmartCoords getSmartListingCoordinates({
    double? exactLat,
    double? exactLng,
    required String address,
    required String title,
    required String state,
    required String id,
    int index = 0,
  }) {
    // Normalise text for scanning
    final combined = '$address $title'.toLowerCase();

    // 1. Scan for exact town, taman, or district match (longest keyword first)
    final sortedTowns = townCoordinates.keys.toList()
      ..sort((a, b) => b.length.compareTo(a.length));

    ({double lat, double lng})? detectedTownCoords;
    String? matchedTown;

    for (final town in sortedTowns) {
      final regex = RegExp('\\b${RegExp.escape(town)}\\b', caseSensitive: false);
      if (regex.hasMatch(combined)) {
        detectedTownCoords = townCoordinates[town]!;
        matchedTown = town;
        break;
      }
    }

    // 2. Check if raw GPS coordinates exist
    if (exactLat != null && exactLng != null && exactLat != 0 && exactLng != 0) {
      // If a town was detected from the title/address, check if the raw GPS is plausibly nearby (<12km)
      if (detectedTownCoords != null) {
        final dist = _calculateDistanceKm(exactLat, exactLng, detectedTownCoords.lat, detectedTownCoords.lng);
        if (dist > 12.0) {
          // CONFLICT DETECTED!
          // The title explicitly says e.g. "Bagan Serai" or "Kulim", but the phone GPS was saved in Kamunting (>12km away).
          // The title/address OVERRULES the accidental office GPS!
          final offsetLat = ((index % 7) - 3) * 0.003 + ((id.isNotEmpty ? id.codeUnitAt(0) : 0) % 5) * 0.0006;
          final offsetLng = (((index * 3) % 7) - 3) * 0.003 + ((id.isNotEmpty ? id.codeUnitAt(id.length - 1) : 0) % 5) * 0.0006;

          return SmartCoords(
            latitude: detectedTownCoords.lat + offsetLat,
            longitude: detectedTownCoords.lng + offsetLng,
            resolvedTown: matchedTown,
            isExactGps: false,
          );
        }
      }

      // No conflict or GPS is within the town -> trust exact GPS
      return SmartCoords(
        latitude: exactLat,
        longitude: exactLng,
        resolvedTown: matchedTown ?? 'GPS',
        isExactGps: true,
      );
    }

    // 3. No raw GPS, but town/taman was detected
    if (detectedTownCoords != null) {
      final offsetLat = ((index % 7) - 3) * 0.003 + ((id.isNotEmpty ? id.codeUnitAt(0) : 0) % 5) * 0.0006;
      final offsetLng = (((index * 3) % 7) - 3) * 0.003 + ((id.isNotEmpty ? id.codeUnitAt(id.length - 1) : 0) % 5) * 0.0006;

      return SmartCoords(
        latitude: detectedTownCoords.lat + offsetLat,
        longitude: detectedTownCoords.lng + offsetLng,
        resolvedTown: matchedTown,
        isExactGps: false,
      );
    }

    // 4. Fallback to state base coordinates
    final cleanState = state.toLowerCase().trim();
    final base = stateBaseCoordinates[cleanState] ?? const (lat: 4.8517, lng: 100.7333);
    final offsetLat = ((index % 7) - 3) * 0.012 + ((id.isNotEmpty ? id.codeUnitAt(0) : 0) % 5) * 0.002;
    final offsetLng = (((index * 3) % 7) - 3) * 0.012 + ((id.isNotEmpty ? id.codeUnitAt(id.length - 1) : 0) % 5) * 0.002;

    return SmartCoords(
      latitude: base.lat + offsetLat,
      longitude: base.lng + offsetLng,
      resolvedTown: state,
      isExactGps: false,
    );
  }

  /// Extract coordinates from Google Maps / Waze links or raw text
  static Map<String, double>? extractCoordinates(String text) {
    if (text.trim().isEmpty) return null;

    final atMatch = RegExp(r'@(-?\d+\.\d+),(-?\d+\.\d+)').firstMatch(text);
    if (atMatch != null) {
      final lat = double.tryParse(atMatch.group(1)!);
      final lng = double.tryParse(atMatch.group(2)!);
      if (lat != null && lng != null) return {'lat': lat, 'lng': lng};
    }

    final qMatch = RegExp(r'[?&](?:q|query|daddr|ll|destination)=(-?\d+\.\d+)[,\s%2C]+(-?\d+\.\d+)').firstMatch(text);
    if (qMatch != null) {
      final lat = double.tryParse(qMatch.group(1)!);
      final lng = double.tryParse(qMatch.group(2)!);
      if (lat != null && lng != null) return {'lat': lat, 'lng': lng};
    }

    final wazeMatch = RegExp(r'latlng=(-?\d+\.\d+)[,\s%2C]+(-?\d+\.\d+)').firstMatch(text);
    if (wazeMatch != null) {
      final lat = double.tryParse(wazeMatch.group(1)!);
      final lng = double.tryParse(wazeMatch.group(2)!);
      if (lat != null && lng != null) return {'lat': lat, 'lng': lng};
    }

    final rawMatch = RegExp(r'^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$').firstMatch(text.trim());
    if (rawMatch != null) {
      final lat = double.tryParse(rawMatch.group(1)!);
      final lng = double.tryParse(rawMatch.group(2)!);
      if (lat != null && lng != null) return {'lat': lat, 'lng': lng};
    }

    return null;
  }

  /// Official Pos Malaysia 5-Digit Postcode Bands
  static String? getStateFromPostcode(String text) {
    final match = RegExp(r'\b\d{5}\b').firstMatch(text);
    if (match == null) return null;

    final code = int.tryParse(match.group(0)!);
    if (code == null) return null;

    if (code >= 1000 && code <= 2800) return 'Perlis';
    if (code >= 5000 && code <= 9810) return 'Kedah';
    if (code >= 10000 && code <= 14400) return 'Penang';
    if (code >= 15000 && code <= 18500) return 'Kelantan';
    if (code >= 20000 && code <= 24300) return 'Terengganu';
    if ((code >= 25000 && code <= 28800) || (code >= 39000 && code <= 39200) || code == 49000 || code == 69000) {
      return 'Pahang';
    }
    if (code >= 30000 && code <= 36810) return 'Perak';
    if ((code >= 40000 && code <= 48300) || (code >= 63000 && code <= 64000)) return 'Selangor';
    if (code >= 50000 && code <= 60000) return 'Kuala Lumpur';
    if (code >= 62000 && code <= 62988) return 'Putrajaya';
    if (code >= 70000 && code <= 73509) return 'Negeri Sembilan';
    if (code >= 75000 && code <= 78309) return 'Melaka';
    if (code >= 79000 && code <= 86900) return 'Johor';
    if (code >= 87000 && code <= 87033) return 'Labuan';
    if (code >= 88000 && code <= 91309) return 'Sabah';
    if (code >= 93000 && code <= 98859) return 'Sarawak';

    return null;
  }

  /// Match common Malaysian city keywords to State
  static String? getStateFromCityKeyword(String address) {
    final lower = address.toLowerCase();

    if (lower.contains('kuala lumpur') || lower.contains('klcc') || lower.contains('bangsar') ||
        lower.contains('mont kiara') || lower.contains('hartamas') || lower.contains('bukit bintang') ||
        lower.contains('wangsa maju') || lower.contains('setapak') || lower.contains('kepong') ||
        lower.contains('cheras, kl')) {
      return 'Kuala Lumpur';
    }
    if (lower.contains('putrajaya')) return 'Putrajaya';
    if (lower.contains('cyberjaya') || lower.contains('petaling jaya') || lower.contains('shah alam') ||
        lower.contains('subang jaya') || lower.contains('puchong') || lower.contains('klang') ||
        lower.contains('damansara') || lower.contains('bangi') || lower.contains('kajang') ||
        lower.contains('rawang') || lower.contains('sepang') || lower.contains('selayang')) {
      return 'Selangor';
    }
    if (lower.contains('johor bahru') || lower.contains('jb') || lower.contains('iskandar puteri') ||
        lower.contains('skudai') || lower.contains('pasir gudang') || lower.contains('kulai') ||
        lower.contains('batu pahat') || lower.contains('muar') || lower.contains('kluang')) {
      return 'Johor';
    }
    if (lower.contains('georgetown') || lower.contains('bayan lepas') || lower.contains('butterworth') ||
        lower.contains('bukit mertajam') || lower.contains('penang') || lower.contains('pulau pinang')) {
      return 'Penang';
    }
    if (lower.contains('ipoh') || lower.contains('taiping') || lower.contains('teluk intan') ||
        lower.contains('manjung') || lower.contains('kamunting') || lower.contains('bagan serai') ||
        lower.contains('parit buntar') || lower.contains('selama')) {
      return 'Perak';
    }
    if (lower.contains('seremban') || lower.contains('nilai') || lower.contains('port dickson') || lower.contains('senawang')) {
      return 'Negeri Sembilan';
    }
    if (lower.contains('melaka') || lower.contains('malacca') || lower.contains('ayer keroh')) {
      return 'Melaka';
    }
    if (lower.contains('kuantan') || lower.contains('temerloh') || lower.contains('bentong') || lower.contains('cameron highlands')) {
      return 'Pahang';
    }
    if (lower.contains('alor setar') || lower.contains('sungai petani') || lower.contains('sg petani') || lower.contains('kulim') || lower.contains('padang serai') || lower.contains('langkawi')) {
      return 'Kedah';
    }
    if (lower.contains('kota bharu') || lower.contains('tumpat') || lower.contains('pasir mas')) {
      return 'Kelantan';
    }
    if (lower.contains('kuala terengganu') || lower.contains('chukai') || lower.contains('kemaman')) {
      return 'Terengganu';
    }
    if (lower.contains('kangar') || lower.contains('arau')) {
      return 'Perlis';
    }
    if (lower.contains('kota kinabalu') || lower.contains('sandakan') || lower.contains('tawau')) {
      return 'Sabah';
    }
    if (lower.contains('kuching') || lower.contains('miri') || lower.contains('sibu') || lower.contains('bintulu')) {
      return 'Sarawak';
    }

    return null;
  }

  /// Full resolution pipeline
  static LocationDetectionResult analyze(String input) {
    final coords = extractCoordinates(input);
    final postcodeState = getStateFromPostcode(input);
    final cityState = getStateFromCityKeyword(input);
    final resolvedState = postcodeState ?? cityState;

    final postcodeMatch = RegExp(r'\b\d{5}\b').firstMatch(input);

    return LocationDetectionResult(
      latitude: coords?['lat'],
      longitude: coords?['lng'],
      state: resolvedState,
      postcode: postcodeMatch?.group(0),
    );
  }
}
