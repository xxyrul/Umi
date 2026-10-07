import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/admin_emails.dart';
import '../auth/auth_service.dart';

class AdminAgentModel {
  final String uid;
  final String email;
  final String displayName;
  final String phoneNumber;
  final String role;
  final String status; // 'ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'REJECTED'
  final String rejectionReason;
  final DateTime? rejectedAt;
  final DateTime? createdAt;

  final String deviceLabel;
  final String updateChannel;

  AdminAgentModel({
    required this.uid,
    required this.email,
    required this.displayName,
    this.phoneNumber = '',
    this.role = 'AGENT',
    this.status = 'ACTIVE',
    this.rejectionReason = '',
    this.rejectedAt,
    this.createdAt,
    this.deviceLabel = '',
    this.updateChannel = 'STABLE',
  });

  bool get isAdmin => role.toUpperCase() == 'ADMIN';
  bool get isSuspended => status.toUpperCase() == 'SUSPENDED';
  bool get isPending => status.toUpperCase() == 'PENDING_APPROVAL' && !isRejected;
  bool get isRejected => status.toUpperCase() == 'REJECTED' || rejectionReason.isNotEmpty;
  bool get isActive => status.toUpperCase() == 'ACTIVE' && !isRejected && !isSuspended;
  bool get isBetaTester => updateChannel.toUpperCase() == 'BETA';

  factory AdminAgentModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final rawApproved = data['approved'];
    final bool isApproved = rawApproved == true;
    final rawStatus = data['status']?.toString().toUpperCase();
    final reason = data['rejectionReason']?.toString() ?? '';

    String status = 'ACTIVE';
    if (rawStatus == 'REJECTED' || reason.isNotEmpty) {
      status = 'REJECTED';
    } else if (rawStatus == 'PENDING_APPROVAL' || rawStatus == 'PENDING') {
      status = isApproved ? 'ACTIVE' : 'PENDING_APPROVAL';
    } else if (rawStatus == 'SUSPENDED') {
      status = 'SUSPENDED';
    } else if (rawStatus == 'ACTIVE' || isApproved) {
      status = 'ACTIVE';
    } else if (rawApproved == false) {
      status = 'PENDING_APPROVAL';
    }

    DateTime? rejDt;
    if (data['rejectedAt'] is Timestamp) {
      rejDt = (data['rejectedAt'] as Timestamp).toDate();
    } else if (data['rejectedAt'] is String) {
      rejDt = DateTime.tryParse(data['rejectedAt']);
    }

    String devLabel = '';
    if (data['lastDevice'] is Map) {
      final dev = data['lastDevice'] as Map;
      devLabel = (dev['deviceLabel'] ?? dev['deviceModel'] ?? '').toString();
    }

    return AdminAgentModel(
      uid: doc.id,
      email: data['email'] ?? '',
      displayName: data['displayName'] ?? data['name'] ?? 'Agent',
      phoneNumber: data['phoneNumber'] ?? data['phone'] ?? '',
      role: (data['role'] ?? 'AGENT').toString().toUpperCase(),
      status: status,
      rejectionReason: data['rejectionReason'] ?? '',
      rejectedAt: rejDt,
      createdAt: (data['createdAt'] is Timestamp)
          ? (data['createdAt'] as Timestamp).toDate()
          : (data['createdAt'] is String ? DateTime.tryParse(data['createdAt']) : null),
      deviceLabel: devLabel,
      updateChannel: (data['updateChannel'] ?? data['channel'] ?? 'STABLE').toString().toUpperCase(),
    );
  }
}

class InviteCodeModel {
  final String code;
  final String status; // 'ACTIVE', 'USED', 'REVOKED'
  final bool isMaster;
  final String createdBy;
  final String notes;
  final DateTime? createdAt;
  final int usedCount;
  final int maxUses;

  InviteCodeModel({
    required this.code,
    this.status = 'ACTIVE',
    this.isMaster = false,
    this.createdBy = '',
    this.notes = '',
    this.createdAt,
    this.usedCount = 0,
    this.maxUses = 1,
  });

  bool get isActive => status == 'ACTIVE';
  bool get isUsed => status == 'USED';
  bool get isRevoked => status == 'REVOKED';

  factory InviteCodeModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    final rawStatus = d['status'] ?? (d['active'] == true ? 'ACTIVE' : 'REVOKED');
    DateTime? dt;
    if (d['createdAt'] is Timestamp) {
      dt = (d['createdAt'] as Timestamp).toDate();
    } else if (d['createdAt'] is String) {
      dt = DateTime.tryParse(d['createdAt']);
    }

    return InviteCodeModel(
      code: doc.id,
      status: rawStatus.toString().toUpperCase(),
      isMaster: d['isMaster'] == true,
      createdBy: d['createdBy'] ?? '',
      notes: d['notes'] ?? '',
      createdAt: dt,
      usedCount: (d['usedCount'] ?? (d['usedBy'] is List ? (d['usedBy'] as List).length : 0)) as int,
      maxUses: (d['maxUses'] ?? 1) as int,
    );
  }
}

class AdminFeedbackModel {
  final String id;
  final String userId;
  final String userEmail;
  final String userName;
  final String userPhone;
  final String type; // Bug, Feature, Performance, General
  final String title;
  final String description;
  final String severity; // Low, Medium, High, Critical
  final String appVersion;
  final String deviceModel;
  final String screenshotUrl;
  final String status; // pending, in-progress, resolved, closed
  final String adminResponse;
  final DateTime? createdAt;

  AdminFeedbackModel({
    required this.id,
    required this.userId,
    required this.userEmail,
    required this.userName,
    this.userPhone = '',
    this.type = 'General',
    required this.title,
    required this.description,
    this.severity = 'Medium',
    this.appVersion = '',
    this.deviceModel = '',
    this.screenshotUrl = '',
    this.status = 'pending',
    this.adminResponse = '',
    this.createdAt,
  });

  factory AdminFeedbackModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    DateTime? dt;
    if (d['createdAt'] is Timestamp) {
      dt = (d['createdAt'] as Timestamp).toDate();
    } else if (d['createdAt'] is String) {
      dt = DateTime.tryParse(d['createdAt']);
    }
    return AdminFeedbackModel(
      id: doc.id,
      userId: d['userId'] ?? '',
      userEmail: d['userEmail'] ?? '',
      userName: d['userName'] ?? d['name'] ?? 'Ejen',
      userPhone: d['userPhone'] ?? d['phone'] ?? '',
      type: d['type'] ?? 'General',
      title: d['title'] ?? '',
      description: d['description'] ?? '',
      severity: d['severity'] ?? 'Medium',
      appVersion: d['appVersion'] ?? '',
      deviceModel: d['deviceModel'] ?? '',
      screenshotUrl: d['screenshotUrl'] ?? '',
      status: (d['status'] ?? 'pending').toString().toLowerCase(),
      adminResponse: d['adminResponse'] ?? '',
      createdAt: dt,
    );
  }
}

// ---------------- STREAMS ----------------
// IMPORTANT: All admin stream providers MUST watch authStateProvider.
// This ensures streams are rebuilt with fresh credentials on every account switch,
// preventing PERMISSION_DENIED from stale auth tokens.

final pendingAgentsStreamProvider = StreamProvider<List<AdminAgentModel>>((ref) {
  // Watching authStateProvider forces rebuild when user signs in/out
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) return const Stream.empty();

  final firestore = ref.watch(firestoreProvider);
  return firestore.collection('users').snapshots().map((snap) {
    return snap.docs
        .map((d) => AdminAgentModel.fromFirestore(d))
        .where((a) =>
            (a.status == 'PENDING_APPROVAL' || a.status == 'PENDING') &&
            !isMasterAdminEmail(a.email) &&
            (a.email.isNotEmpty || a.displayName.isNotEmpty))
        .toList();
  });
});

final rejectedAgentsStreamProvider = StreamProvider<List<AdminAgentModel>>((ref) {
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) return const Stream.empty();

  final firestore = ref.watch(firestoreProvider);
  return firestore.collection('users').snapshots().map((snap) {
    return snap.docs
        .map((d) => AdminAgentModel.fromFirestore(d))
        .where((a) => a.isRejected && !isMasterAdminEmail(a.email))
        .toList();
  });
});

final allAgentsStreamProvider = StreamProvider<List<AdminAgentModel>>((ref) {
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) return const Stream.empty();

  final firestore = ref.watch(firestoreProvider);
  return firestore.collection('users').snapshots().map((snap) {
    final agents = snap.docs
        .map((d) => AdminAgentModel.fromFirestore(d))
        .where((a) =>
            a.status != 'PENDING_APPROVAL' &&
            a.status != 'PENDING' &&
            a.status != 'REJECTED' &&
            (a.email.isNotEmpty || (a.displayName.isNotEmpty && a.displayName != 'Agent')))
        .toList();
    agents.sort((a, b) => a.displayName.compareTo(b.displayName));
    return agents;
  });
});

final inviteCodesStreamProvider = StreamProvider<List<InviteCodeModel>>((ref) {
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) return const Stream.empty();

  final firestore = ref.watch(firestoreProvider);
  return firestore.collection('invite_codes').snapshots().map((snap) {
    final list = snap.docs.map((d) => InviteCodeModel.fromFirestore(d)).toList();
    list.sort((a, b) => (b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0))
        .compareTo(a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0)));
    return list;
  });
});

final adminFeedbackStreamProvider = StreamProvider<List<AdminFeedbackModel>>((ref) {
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) return const Stream.empty();

  final firestore = ref.watch(firestoreProvider);
  return firestore.collection('feedback').snapshots().map((snap) {
    final list = snap.docs.map((d) => AdminFeedbackModel.fromFirestore(d)).toList();
    list.sort((a, b) => (b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0))
        .compareTo(a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0)));
    return list;
  });
});

class AdminService {
  final FirebaseFirestore _firestore;

  AdminService(this._firestore);

  // Agent Approvals & Management
  Future<void> approveAgent(String uid) async {
    final doc = await _firestore.collection('users').doc(uid).get();
    final email = doc.data()?['email']?.toString().trim().toLowerCase() ?? '';
    final displayName = doc.data()?['displayName']?.toString() ?? 'Ejen';
    final updateData = {
      'status': 'ACTIVE',
      'role': 'agent',
      'approved': true,
      'approvedAt': FieldValue.serverTimestamp(),
    };
    await _firestore.collection('users').doc(uid).update(updateData);
    if (email.isNotEmpty) {
      final duplicates = await _firestore.collection('users').where('email', isEqualTo: email).get();
      for (final d in duplicates.docs) {
        if (d.id != uid) {
          await d.reference.update(updateData).catchError((_) {});
        }
      }
    }

    // Dispatch instant approval push notification to the approved agent's device
    try {
      final dio = Dio();
      final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
      await dio.post(
        'https://sendbroadcastpush-qmzvmlyqza-uc.a.run.app',
        data: {
          'targetUid': uid,
          'kind': 'account-approved',
          'titleEN': 'Account Approved! 🎉',
          'titleBM': 'Akaun Anda Telah Diluluskan! 🎉',
          'messageEN': 'Congratulations $displayName! Your Umi account is now active. Open the app to start managing your cases.',
          'messageBM': 'Tahniah $displayName! Akaun Umi anda kini aktif. Buka aplikasi untuk mula menguruskan kes anda.',
          'type': 'APPROVAL',
        },
        options: Options(headers: {
          'Content-Type': 'application/json',
          if (idToken != null) 'Authorization': 'Bearer $idToken',
        }),
      );
    } catch (_) {}
  }

  Future<void> rejectAgent(String uid, {String reason = ''}) async {
    final doc = await _firestore.collection('users').doc(uid).get();
    final email = doc.data()?['email']?.toString().trim().toLowerCase() ?? '';
    final updateData = {
      'status': 'REJECTED',
      'approved': false,
      'rejectionReason': reason.isEmpty ? 'Permohonan ditolak oleh pentadbir.' : reason,
      'rejectedAt': FieldValue.serverTimestamp(),
    };
    await _firestore.collection('users').doc(uid).update(updateData);
    if (email.isNotEmpty) {
      final duplicates = await _firestore.collection('users').where('email', isEqualTo: email).get();
      for (final d in duplicates.docs) {
        if (d.id != uid) {
          await d.reference.update(updateData).catchError((_) {});
        }
      }
    }
  }

  Future<void> resetAgentPending(String uid) async {
    final doc = await _firestore.collection('users').doc(uid).get();
    final email = doc.data()?['email']?.toString().trim().toLowerCase() ?? '';
    final updateData = {
      'status': 'PENDING_APPROVAL',
      'approved': false,
      'rejectionReason': FieldValue.delete(),
      'rejectedAt': FieldValue.delete(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
    await _firestore.collection('users').doc(uid).update(updateData);
    if (email.isNotEmpty) {
      final duplicates = await _firestore.collection('users').where('email', isEqualTo: email).get();
      for (final d in duplicates.docs) {
        if (d.id != uid) {
          await d.reference.update(updateData).catchError((_) {});
        }
      }
    }
  }

  Future<void> suspendAgent(String uid, {String reason = ''}) async {
    final doc = await _firestore.collection('users').doc(uid).get();
    final email = doc.data()?['email']?.toString().trim().toLowerCase() ?? '';
    final updateData = {
      'status': 'SUSPENDED',
      'suspendedReason': reason,
      'suspendedAt': FieldValue.serverTimestamp(),
    };
    await _firestore.collection('users').doc(uid).update(updateData);
    if (email.isNotEmpty) {
      final duplicates = await _firestore.collection('users').where('email', isEqualTo: email).get();
      for (final d in duplicates.docs) {
        if (d.id != uid) {
          await d.reference.update(updateData).catchError((_) {});
        }
      }
    }
  }

  Future<void> activateAgent(String uid) async {
    final doc = await _firestore.collection('users').doc(uid).get();
    final email = doc.data()?['email']?.toString().trim().toLowerCase() ?? '';
    final updateData = {
      'status': 'ACTIVE',
      'approved': true,
      'activatedAt': FieldValue.serverTimestamp(),
    };
    await _firestore.collection('users').doc(uid).update(updateData);
    if (email.isNotEmpty) {
      final duplicates = await _firestore.collection('users').where('email', isEqualTo: email).get();
      for (final d in duplicates.docs) {
        if (d.id != uid) {
          await d.reference.update(updateData).catchError((_) {});
        }
      }
    }
  }

  Future<void> updateAgentRole(String uid, String role) async {
    await _firestore.collection('users').doc(uid).update({
      'role': role.toLowerCase(),
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  Future<void> deleteAgent(String uid) async {
    final doc = await _firestore.collection('users').doc(uid).get();
    final email = doc.data()?['email']?.toString().trim().toLowerCase() ?? '';
    await _firestore.collection('users').doc(uid).delete();
    if (email.isNotEmpty) {
      final duplicates = await _firestore.collection('users').where('email', isEqualTo: email).get();
      for (final d in duplicates.docs) {
        if (d.id != uid) {
          await d.reference.delete().catchError((_) {});
        }
      }
    }
  }

  // Invite Codes Management
  Future<void> createInviteCode(String code, {String notes = '', bool isMaster = false, String createdBy = 'Admin', int maxUses = 1}) async {
    final cleaned = code.trim().toUpperCase();
    final nowIso = DateTime.now().toIso8601String();
    final data = {
      'code': cleaned,
      'status': 'ACTIVE',
      'isMaster': isMaster,
      'notes': notes,
      'createdBy': createdBy,
      'createdAt': nowIso,
      'maxUses': isMaster ? 999999 : maxUses,
      'usedCount': 0,
    };
    await _firestore.collection('invite_codes').doc(cleaned).set(data);
    await _firestore.collection('inviteCodes').doc(cleaned).set(data).catchError((_) {});
  }

  Future<List<String>> generateBatchInviteCodes({
    int count = 5,
    String prefix = 'ART',
    bool isMaster = false,
    String notes = '',
    String createdBy = 'Admin',
  }) async {
    final cleanCount = count.clamp(1, 25);
    final cleanPrefix = prefix.trim().isEmpty ? 'ART' : prefix.trim().toUpperCase();
    final List<String> generatedCodes = [];
    final nowIso = DateTime.now().toIso8601String();

    for (int i = 0; i < cleanCount; i++) {
      final timestamp = DateTime.now().millisecondsSinceEpoch.toRadixString(36).toUpperCase();
      final random = (Random().nextInt(0xFFFF)).toRadixString(16).padLeft(4, '0').toUpperCase();
      final code = '$cleanPrefix-$timestamp-$random';

      final data = {
        'code': code,
        'status': 'ACTIVE',
        'isMaster': isMaster,
        'notes': notes.isNotEmpty ? notes : 'Batch (${i + 1}/$cleanCount)',
        'createdBy': createdBy,
        'createdAt': nowIso,
        'maxUses': isMaster ? 999999 : 1,
        'usedCount': 0,
      };

      await _firestore.collection('invite_codes').doc(code).set(data);
      await _firestore.collection('inviteCodes').doc(code).set(data).catchError((_) {});
      generatedCodes.add(code);
    }
    return generatedCodes;
  }

  Future<void> revokeInviteCode(String code) async {
    await _firestore.collection('invite_codes').doc(code).update({'status': 'REVOKED', 'active': false});
    await _firestore.collection('inviteCodes').doc(code).update({'status': 'REVOKED', 'active': false}).catchError((_) {});
  }

  Future<void> restoreInviteCode(String code) async {
    await _firestore.collection('invite_codes').doc(code).update({'status': 'ACTIVE', 'active': true});
    await _firestore.collection('inviteCodes').doc(code).update({'status': 'ACTIVE', 'active': true}).catchError((_) {});
  }

  Future<void> deleteInviteCode(String code) async {
    await _firestore.collection('invite_codes').doc(code).delete();
    await _firestore.collection('inviteCodes').doc(code).delete().catchError((_) {});
  }

  Future<void> batchRevokeInviteCodes(List<String> codes) async {
    for (final code in codes) {
      await revokeInviteCode(code).catchError((_) {});
    }
  }

  Future<void> batchDeleteInviteCodes(List<String> codes) async {
    for (final code in codes) {
      await deleteInviteCode(code).catchError((_) {});
    }
  }

  // Broadcast Announcements
  Future<void> createBroadcastAnnouncement({
    required String titleBM,
    required String titleEN,
    required String messageBM,
    required String messageEN,
    String type = 'GENERAL',
    bool pinned = false,
    String sentBy = 'Pentadbir Agensi',
    String targetChannel = 'ALL', // 'ALL' or 'BETA'
  }) async {
    final nowIso = DateTime.now().toIso8601String();
    final annId = 'ann_${DateTime.now().millisecondsSinceEpoch}';

    final effectiveTitleBM = targetChannel == 'BETA' ? '[BETA 🧪] $titleBM' : titleBM;
    final effectiveTitleEN = targetChannel == 'BETA' ? '[BETA 🧪] $titleEN' : titleEN;

    final data = {
      'id': annId,
      'title': effectiveTitleBM.isNotEmpty ? effectiveTitleBM : effectiveTitleEN,
      'titleEN': effectiveTitleEN,
      'titleBM': effectiveTitleBM,
      'content': messageBM.isNotEmpty ? messageBM : messageEN,
      'contentEN': messageEN,
      'contentBM': messageBM,
      'message': messageBM.isNotEmpty ? messageBM : messageEN,
      'messageEN': messageEN,
      'messageBM': messageBM,
      'type': type,
      'targetChannel': targetChannel,
      'targetAudience': targetChannel,
      'pinned': pinned,
      'author': sentBy,
      'sentBy': sentBy,
      'createdAt': nowIso,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    await _firestore.collection('announcements').doc(annId).set(data);

    // Trigger instant push notification via Cloud Run backend
    try {
      final dio = Dio();
      final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
      await dio.post(
        'https://sendbroadcastpush-qmzvmlyqza-uc.a.run.app',
        data: {
          'titleEN': effectiveTitleEN,
          'titleBM': effectiveTitleBM,
          'messageEN': messageEN,
          'messageBM': messageBM,
          'type': type,
          'targetChannel': targetChannel,
        },
        options: Options(headers: {
          'Content-Type': 'application/json',
          if (idToken != null) 'Authorization': 'Bearer $idToken',
        }),
      );
    } catch (_) {}
  }

  Future<void> deleteAnnouncement(String id) async {
    await _firestore.collection('announcements').doc(id).delete();
  }

  // Listing Moderation
  Future<void> updateListingStatus(String listingId, String status) async {
    final nowIso = DateTime.now().toIso8601String();
    await _firestore.collection('publicListings').doc(listingId).set(
      {'status': status, 'updatedAt': nowIso},
      SetOptions(merge: true),
    );
    await _firestore.collection('listings').doc(listingId).set(
      {'status': status, 'updatedAt': nowIso},
      SetOptions(merge: true),
    ).catchError((_) {});
  }

  // Feedback Desk
  Future<void> updateFeedbackStatus(String feedbackId, String status, {String? adminResponse}) async {
    final nowIso = DateTime.now().toIso8601String();
    final Map<String, dynamic> data = {
      'status': status.toLowerCase(),
      'updatedAt': nowIso,
    };
    if (adminResponse != null) {
      data['adminResponse'] = adminResponse.trim();
    }
    await _firestore.collection('feedback').doc(feedbackId).set(data, SetOptions(merge: true));

    // If an admin response was provided, notify the agent immediately
    if (adminResponse != null && adminResponse.trim().isNotEmpty) {
      try {
        final feedbackDoc = await _firestore.collection('feedback').doc(feedbackId).get();
        final userId = feedbackDoc.data()?['userId']?.toString();
        final feedbackTitle = feedbackDoc.data()?['title']?.toString() ?? 'Maklum Balas';
        if (userId != null && userId.isNotEmpty) {
          final dio = Dio();
          final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
          await dio.post(
            'https://sendbroadcastpush-qmzvmlyqza-uc.a.run.app',
            data: {
              'targetUid': userId,
              'kind': 'feedback-reply',
              'titleEN': 'Admin Replied to Your Feedback 📝',
              'titleBM': 'Maklum Balas Anda Dibalas 📝',
              'messageEN': 'Admin response on "$feedbackTitle": "${adminResponse.trim()}"',
              'messageBM': 'Pentadbir membalas "$feedbackTitle": "${adminResponse.trim()}"',
              'type': 'FEEDBACK',
            },
            options: Options(headers: {
              'Content-Type': 'application/json',
              if (idToken != null) 'Authorization': 'Bearer $idToken',
            }),
          );
        }
      } catch (_) {}
    }
  }

  Future<void> deleteFeedback(String feedbackId) async {
    await _firestore.collection('feedback').doc(feedbackId).delete();
  }
}

final adminServiceProvider = Provider<AdminService>((ref) {
  return AdminService(ref.watch(firestoreProvider));
});
