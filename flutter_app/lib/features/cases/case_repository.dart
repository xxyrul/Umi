import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_service.dart';
import 'case_model.dart';

final casesStreamProvider = StreamProvider<List<CaseModel>>((ref) {
  final user = ref.watch(authStateProvider).value ?? FirebaseAuth.instance.currentUser;
  if (user == null) return Stream.value([]);

  final firestore = ref.watch(firestoreProvider);
  return firestore
      .collection('cases')
      .where('userId', isEqualTo: user.uid)
      .snapshots()
      .map((snap) {
        final list = snap.docs.map((doc) => CaseModel.fromFirestore(doc)).toList();
        list.sort((a, b) {
          final aDate = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          final bDate = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          return bDate.compareTo(aDate); // Newest first
        });
        return list;
      });
});

class CaseRepository {
  final FirebaseFirestore _firestore;

  CaseRepository(this._firestore);

  Future<String> createCase(CaseModel caseItem) async {
    final docRef = await _firestore.collection('cases').add(caseItem.toMap());
    return docRef.id;
  }

  Future<CaseModel?> getCaseById(String id) async {
    final doc = await _firestore.collection('cases').doc(id).get();
    if (!doc.exists) return null;
    return CaseModel.fromFirestore(doc);
  }

  Future<void> updateCase(CaseModel caseItem) async {
    await _firestore.collection('cases').doc(caseItem.id).update(caseItem.toMap());
  }

  Future<void> updateCaseStatus(String id, String newStatus, {String? changeLog}) async {
    final updates = <String, dynamic>{
      'status': newStatus,
      'updatedAt': DateTime.now().toIso8601String(),
    };
    if (changeLog != null && changeLog.isNotEmpty) {
      updates['statusHistory'] = FieldValue.arrayUnion([changeLog]);
    }
    await _firestore.collection('cases').doc(id).update(updates);
  }

  Future<void> updateReminder(String id, String reminderDate, String reminderNote) async {
    await _firestore.collection('cases').doc(id).update({
      'reminderDate': reminderDate,
      'reminderNote': reminderNote,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  Future<void> deleteCase(String id) async {
    await _firestore.collection('cases').doc(id).delete();
  }
}

final caseRepositoryProvider = Provider<CaseRepository>((ref) {
  return CaseRepository(ref.watch(firestoreProvider));
});

