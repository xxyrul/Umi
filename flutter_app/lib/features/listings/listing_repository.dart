import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_service.dart';
import 'listing_model.dart';

final listingsStreamProvider = StreamProvider<List<ListingModel>>((ref) {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return Stream.value([]);

  final firestore = ref.watch(firestoreProvider);
  return firestore
      .collection('publicListings')
      .snapshots()
      .map((snap) {
        final list = snap.docs.map((doc) => ListingModel.fromFirestore(doc)).toList();
        list.sort((a, b) {
          final aDate = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          final bDate = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          return bDate.compareTo(aDate);
        });
        return list;
      });
});

final activeListingsCountProvider = FutureProvider<int>((ref) async {
  final firestore = ref.watch(firestoreProvider);
  final result = await firestore
      .collection('publicListings')
      .where('status', whereIn: ['Aktif', 'Active'])
      .count()
      .get();
  return result.count ?? 0;
});

final myListingsStreamProvider = StreamProvider<List<ListingModel>>((ref) {
  final user = ref.watch(authStateProvider).value ?? FirebaseAuth.instance.currentUser;
  if (user == null) return Stream.value([]);

  final allListings = ref.watch(listingsStreamProvider).value ?? [];
  return Stream.value(allListings.where((l) => l.isOwnedByUser(user.uid)).toList());
});

class ListingRepository {
  final FirebaseFirestore _firestore;

  ListingRepository(this._firestore);

  Future<ListingModel?> getListingById(String id) async {
    final doc = await _firestore.collection('publicListings').doc(id).get();
    if (doc.exists) return ListingModel.fromFirestore(doc);
    final fallback = await _firestore.collection('listings').doc(id).get();
    if (fallback.exists) return ListingModel.fromFirestore(fallback);
    return null;
  }

  Future<String> createListing(ListingModel listing) async {
    final id = listing.id.isNotEmpty ? listing.id : _firestore.collection('publicListings').doc().id;
    await _firestore.collection('publicListings').doc(id).set(listing.toPublicMap(), SetOptions(merge: true));
    await _firestore.collection('listings').doc(id).set(listing.toMap(), SetOptions(merge: true));
    return id;
  }

  Future<void> updateListing(String id, Map<String, dynamic> data) async {
    data['updatedAt'] = DateTime.now().toIso8601String();
    final publicData = Map<String, dynamic>.from(data)..remove('documents');
    await _firestore.collection('publicListings').doc(id).set(publicData, SetOptions(merge: true));
    await _firestore.collection('listings').doc(id).set(data, SetOptions(merge: true));
  }

  String createNewListingId() {
    return _firestore.collection('listings').doc().id;
  }

  Future<List<String>> uploadPhotos(String listingId, List<File> files) async {
    final urls = <String>[];
    for (int i = 0; i < files.length; i++) {
      final file = files[i];
      try {
        final ext = file.path.split('.').last.toLowerCase();
        final fileName = 'gambar_${i}_${DateTime.now().millisecondsSinceEpoch}.$ext';
        final refStorage = FirebaseStorage.instance.ref().child('listings').child(listingId).child(fileName);
        final uploadTask = await refStorage.putFile(file);
        final url = await uploadTask.ref.getDownloadURL();
        urls.add(url);
      } catch (e) {
        debugPrint('Upload photo error: $e');
      }
    }
    return urls;
  }

  Future<void> deleteListing(String id) async {
    await _firestore.collection('publicListings').doc(id).delete().catchError((_) {});
    await _firestore.collection('listings').doc(id).delete().catchError((_) {});
  }
}

final listingRepositoryProvider = Provider<ListingRepository>((ref) {
  return ListingRepository(ref.watch(firestoreProvider));
});

