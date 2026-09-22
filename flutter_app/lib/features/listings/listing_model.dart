import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/utils/malaysian_location_detector.dart';

class ListingModel {
  final String id;
  final String title;
  final int price;
  final String address;
  final String state;
  final String propertyType;
  final int bedrooms;
  final int bathrooms;
  final String size;
  final String tenure; // 'Freehold', 'Leasehold'
  final String lotStatus; // 'Bumi Lot', 'Non-Bumi Lot', 'Malay Reserved'
  final String status; // 'Aktif', 'Active', 'Booking', 'Sold', 'Draft'
  final List<String> photos;
  final String description;
  final String agentId;
  final String userId;
  final String agentName;
  final String agentPhone;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final double? latitude;
  final double? longitude;
  final String locationAccuracy; // 'exact', 'approximate', or 'unknown'
  final Map<String, String> documents;

  /// Alias for size (built-up area)
  String get builtUp => size;

  ListingModel({
    required this.id,
    required this.title,
    required this.price,
    this.address = '',
    this.state = 'Selangor',
    this.propertyType = 'Residential / Teres',
    this.bedrooms = 0,
    this.bathrooms = 0,
    this.size = '',
    this.tenure = 'Freehold',
    this.lotStatus = 'Non-Bumi Lot',
    this.status = 'Aktif',
    this.photos = const [],
    this.description = '',
    required this.agentId,
    this.userId = '',
    this.agentName = 'Agent',
    this.agentPhone = '',
    this.createdAt,
    this.updatedAt,
    this.latitude,
    this.longitude,
    this.locationAccuracy = 'unknown',
    this.documents = const {},
  });

  static DateTime? parseFlexibleDate(dynamic val) {
    if (val == null) return null;
    if (val is Timestamp) return val.toDate();
    if (val is String && val.trim().isNotEmpty) {
      return DateTime.tryParse(val.trim());
    }
    return null;
  }

  factory ListingModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    
    // Support all possible photo fields from Firestore: gambar (RN app), images, imageUrl, photos, foto, etc.
    final List<String> parsedPhotos = [];
    void addPhoto(dynamic val) {
      if (val == null) return;
      if (val is String && val.trim().isNotEmpty) {
        final s = val.trim();
        if (!parsedPhotos.contains(s)) parsedPhotos.add(s);
      } else if (val is List) {
        for (final item in val) {
          addPhoto(item);
        }
      } else if (val is Map) {
        addPhoto(val['url'] ?? val['uri'] ?? val['downloadUrl'] ?? val['downloadURL'] ?? val['path']);
      }
    }

    addPhoto(d['imageUrl']);
    addPhoto(d['image']);
    addPhoto(d['photo']);
    addPhoto(d['thumbnail']);
    addPhoto(d['coverImage']);
    addPhoto(d['gambar']);
    addPhoto(d['images']);
    addPhoto(d['photos']);
    addPhoto(d['foto']);

    final rawPrice = d['harga'] ?? d['price'] ?? 0;
    final int parsedPrice = rawPrice is int
        ? rawPrice
        : int.tryParse(rawPrice.toString().replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;

    final rawBed = d['bilikTidur'] ?? d['bilik'] ?? d['bedrooms'] ?? 0;
    final rawBath = d['bilikAir'] ?? d['bathrooms'] ?? 0;

    double? parseCoord(dynamic val) {
      if (val == null) return null;
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val.trim());
      return null;
    }

    // Parse location coordinates from flat fields, nested maps, or strings
    double? lat = parseCoord(d['latitude'] ?? d['lat']);
    double? lng = parseCoord(d['longitude'] ?? d['lng']);
    if (lat == null && d['location'] is Map) {
      lat = parseCoord(d['location']['latitude'] ?? d['location']['lat']);
      lng = parseCoord(d['location']['longitude'] ?? d['location']['lng']);
    }
    if (lat == null && d['coords'] is Map) {
      lat = parseCoord(d['coords']['latitude'] ?? d['coords']['lat']);
      lng = parseCoord(d['coords']['longitude'] ?? d['coords']['lng']);
    }
    // Also extract coordinates if the user pasted a Maps or Waze link in the address field
    final rawAddr = (d['alamat'] ?? d['address'] ?? '').toString();
    if ((lat == null || lng == null) && rawAddr.isNotEmpty) {
      final extracted = MalaysianLocationDetector.extractCoordinates(rawAddr);
      if (extracted != null) {
        lat = extracted['lat'];
        lng = extracted['lng'];
      }
    }

    final Map<String, String> parsedDocs = {};
    if (d['documents'] is Map) {
      (d['documents'] as Map).forEach((k, v) {
        if (v != null && v.toString().isNotEmpty) {
          parsedDocs[k.toString()] = v.toString();
        }
      });
    }

    final rawOwnerName = (d['namaOwner'] ?? d['ownerName'] ?? d['agentName'] ?? d['authorName'] ?? d['userName'] ?? '').toString().trim();
    final rawOwnerPhone = (d['telOwner'] ?? d['ownerPhone'] ?? d['agentPhone'] ?? d['authorPhone'] ?? d['phone'] ?? d['contact'] ?? '').toString().trim();

    return ListingModel(
      id: doc.id,
      title: d['tajuk'] ?? d['title'] ?? 'Listing Tanpa Tajuk',
      price: parsedPrice,
      address: d['alamat'] ?? d['address'] ?? '',
      state: d['negeri'] ?? d['state'] ?? 'Selangor',
      propertyType: d['jenis'] ?? d['propertyType'] ?? 'Residential / Teres',
      bedrooms: int.tryParse(rawBed.toString()) ?? 0,
      bathrooms: int.tryParse(rawBath.toString()) ?? 0,
      size: (d['keluasan'] ?? d['size'] ?? '').toString(),
      tenure: d['pegangan'] ?? d['tenure'] ?? 'Freehold',
      lotStatus: d['lot'] ?? d['lotStatus'] ?? 'Non-Bumi Lot',
      status: d['status'] ?? 'Aktif',
      photos: parsedPhotos,
      description: d['keterangan'] ?? d['description'] ?? '',
      agentId: d['agentId'] ?? d['createdBy'] ?? d['userId'] ?? '',
      userId: d['userId'] ?? d['agentId'] ?? d['createdBy'] ?? '',
      agentName: rawOwnerName.isNotEmpty ? rawOwnerName : (d['agentName'] ?? 'Owner/Agent'),
      agentPhone: rawOwnerPhone,
      createdAt: parseFlexibleDate(d['createdAt']),
      updatedAt: parseFlexibleDate(d['updatedAt']),
      latitude: lat,
      longitude: lng,
      locationAccuracy: (d['locationAccuracy'] ?? 'unknown').toString(),
      documents: parsedDocs,
    );
  }

  String get ownerName => agentName;
  String get ownerPhone => agentPhone;
  bool get hasExactLocation => locationAccuracy.toLowerCase() == 'exact';
  bool get hasApproximateLocation => locationAccuracy.toLowerCase() == 'approximate';

  bool isOwnedByUser(String uid) {
    if (uid.isEmpty) return false;
    return agentId.trim() == uid.trim() || userId.trim() == uid.trim();
  }

  bool get isAktif {
    final s = status.toLowerCase().trim();
    return s == 'aktif' || s == 'active';
  }

  bool get isBooking {
    final s = status.toLowerCase().trim();
    return s == 'booking';
  }

  bool get isSold {
    final s = status.toLowerCase().trim();
    return s == 'sold' || s == 'terjual';
  }

  bool get isDraft {
    final s = status.toLowerCase().trim();
    return s == 'draft';
  }

  String getDisplayStatus(bool isBM) {
    if (isAktif) return isBM ? 'AKTIF' : 'ACTIVE';
    if (isBooking) return isBM ? 'TEMPAHAN' : 'BOOKING';
    if (isSold) return isBM ? 'TERJUAL' : 'SOLD';
    if (isDraft) return isBM ? 'DRAF' : 'DRAFT';
    return status.toUpperCase();
  }

  Map<String, dynamic> toMap() {
    final nowIso = DateTime.now().toIso8601String();
    return {
      'tajuk': title,
      'harga': price,
      'alamat': address,
      'negeri': state,
      'jenis': propertyType,
      'bilikTidur': bedrooms,
      'bilik': bedrooms,
      'bilikAir': bathrooms,
      'keluasan': size,
      'pegangan': tenure,
      'lot': lotStatus,
      'status': status,
      'photos': photos,
      'foto': photos,
      'keterangan': description,
      'agentId': agentId,
      'userId': userId,
      'createdBy': agentId,
      'agentName': agentName,
      'agentPhone': agentPhone,
      'namaOwner': agentName,
      'telOwner': agentPhone,
      'createdAt': createdAt != null ? createdAt!.toIso8601String() : nowIso,
      'updatedAt': nowIso,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      'locationAccuracy': locationAccuracy,
      'documents': documents,
    };
  }

  Map<String, dynamic> toPublicMap() {
    final payload = toMap();
    payload.remove('documents');
    return payload;
  }

  ListingModel copyWith({
    String? id,
    String? title,
    int? price,
    String? address,
    String? state,
    String? propertyType,
    int? bedrooms,
    int? bathrooms,
    String? size,
    String? tenure,
    String? lotStatus,
    String? status,
    List<String>? photos,
    String? description,
    String? agentId,
    String? userId,
    String? agentName,
    String? agentPhone,
    DateTime? createdAt,
    DateTime? updatedAt,
    double? latitude,
    double? longitude,
    String? locationAccuracy,
    Map<String, String>? documents,
  }) {
    return ListingModel(
      id: id ?? this.id,
      title: title ?? this.title,
      price: price ?? this.price,
      address: address ?? this.address,
      state: state ?? this.state,
      propertyType: propertyType ?? this.propertyType,
      bedrooms: bedrooms ?? this.bedrooms,
      bathrooms: bathrooms ?? this.bathrooms,
      size: size ?? this.size,
      tenure: tenure ?? this.tenure,
      lotStatus: lotStatus ?? this.lotStatus,
      status: status ?? this.status,
      photos: photos ?? this.photos,
      description: description ?? this.description,
      agentId: agentId ?? this.agentId,
      userId: userId ?? this.userId,
      agentName: agentName ?? this.agentName,
      agentPhone: agentPhone ?? this.agentPhone,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      locationAccuracy: locationAccuracy ?? this.locationAccuracy,
      documents: documents ?? this.documents,
    );
  }
}
