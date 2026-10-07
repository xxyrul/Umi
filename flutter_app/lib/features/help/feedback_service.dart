import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_service.dart';

class UserFeedbackModel {
  final String id;
  final String userId;
  final String userName;
  final String userEmail;
  final String userPhone;
  final String type; // BUG, FEATURE_REQUEST, GENERAL
  final String title;
  final String description;
  final String notes;
  final String status; // pending, in-progress, resolved
  final String adminResponse;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const UserFeedbackModel({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userEmail,
    this.userPhone = '',
    required this.type,
    required this.title,
    required this.description,
    this.notes = '',
    required this.status,
    this.adminResponse = '',
    this.createdAt,
    this.updatedAt,
  });

  factory UserFeedbackModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    DateTime? cAt;
    if (d['createdAt'] is Timestamp) {
      cAt = (d['createdAt'] as Timestamp).toDate();
    } else if (d['createdAt'] is String) {
      cAt = DateTime.tryParse(d['createdAt']);
    }

    DateTime? uAt;
    if (d['updatedAt'] is Timestamp) {
      uAt = (d['updatedAt'] as Timestamp).toDate();
    } else if (d['updatedAt'] is String) {
      uAt = DateTime.tryParse(d['updatedAt']);
    }

    return UserFeedbackModel(
      id: doc.id,
      userId: d['userId'] ?? '',
      userName: d['userName'] ?? d['name'] ?? 'Ejen',
      userEmail: d['userEmail'] ?? '',
      userPhone: d['userPhone'] ?? d['phone'] ?? '',
      type: (d['type'] ?? d['category'] ?? 'GENERAL').toString().toUpperCase(),
      title: d['title'] ?? '',
      description: d['description'] ?? '',
      notes: d['notes'] ?? '',
      status: (d['status'] ?? 'pending').toString().toLowerCase(),
      adminResponse: d['adminResponse'] ?? '',
      createdAt: cAt,
      updatedAt: uAt,
    );
  }
}

/// Real-time stream of feedback submitted by the currently logged-in user.
/// Automatically rebinds when auth state changes.
final userFeedbackStreamProvider = StreamProvider.autoDispose<List<UserFeedbackModel>>((ref) {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return Stream.value(const []);

  return FirebaseFirestore.instance
      .collection('feedback')
      .where('userId', isEqualTo: user.uid)
      .snapshots()
      .map((snapshot) {
        final items = snapshot.docs.map((doc) => UserFeedbackModel.fromFirestore(doc)).toList();
        items.sort((a, b) {
          final aTime = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          final bTime = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
          return bTime.compareTo(aTime);
        });
        return items;
      });
});

class FeedbackService {
  final FirebaseFirestore _firestore;

  FeedbackService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  Future<void> submitFeedback({
    required String title,
    required String description,
    required String notes,
    required String type,
    required String userId,
    required String userName,
    required String userEmail,
  }) async {
    final docRef = _firestore.collection('feedback').doc();
    await docRef.set({
      'id': docRef.id,
      'title': title,
      'description': description,
      'notes': notes,
      'type': type,
      'category': type == 'BUG'
          ? 'Masalah'
          : (type == 'FEATURE_REQUEST' ? 'Cadangan' : 'Pertanyaan'),
      'userId': userId,
      'userName': userName,
      'userEmail': userEmail,
      'status': 'pending',
      'adminResponse': '',
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> deleteFeedback(String feedbackId) async {
    await _firestore.collection('feedback').doc(feedbackId).delete();
  }
}

final feedbackServiceProvider = Provider<FeedbackService>((ref) {
  return FeedbackService();
});
