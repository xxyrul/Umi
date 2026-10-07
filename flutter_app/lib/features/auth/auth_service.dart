import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:dio/dio.dart';
import '../../core/constants/admin_emails.dart';
import '../notifications/push_notification_service.dart';

class UserModel {
  final String uid;
  final String email;
  final String displayName;
  final String phoneNumber;
  final String photoUrl;
  final String role; // 'ADMIN' or 'AGENT'
  final String status; // 'ACTIVE', 'PENDING', 'SUSPENDED'
  final bool approved;
  final String rejectionReason;
  final DateTime? createdAt;

  UserModel({
    required this.uid,
    required this.email,
    required this.displayName,
    this.photoUrl = '',
    this.phoneNumber = '',
    this.role = 'AGENT',
    this.status = 'ACTIVE',
    this.approved = true,
    this.rejectionReason = '',
    this.createdAt,
  });

  factory UserModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    final rawApproved = data['approved'];
    final bool isApproved = rawApproved is bool ? rawApproved : (rawApproved == null ? true : false);
    final rawStatus = data['status']?.toString().toUpperCase();
    final defaultStatus = (!isApproved) ? 'PENDING_APPROVAL' : 'ACTIVE';

    final rawPhoto = data['photoUrl'] ?? data['photoURL'];
    String resolvedPhoto = (rawPhoto != null && rawPhoto.toString().isNotEmpty) ? rawPhoto.toString() : '';
    if (resolvedPhoto.isEmpty && FirebaseAuth.instance.currentUser?.uid == doc.id) {
      resolvedPhoto = FirebaseAuth.instance.currentUser?.photoURL ?? '';
    }

    return UserModel(
      uid: doc.id,
      email: data['email'] ?? '',
      displayName: data['displayName'] ?? data['name'] ?? 'Agent',
      photoUrl: resolvedPhoto,
      phoneNumber: data['phoneNumber'] ?? data['phone'] ?? '',
      role: (data['role'] ?? 'AGENT').toString().toUpperCase(),
      status: rawStatus ?? defaultStatus,
      approved: isApproved,
      rejectionReason: data['rejectionReason']?.toString() ?? '',
      createdAt: (data['createdAt'] is Timestamp)
          ? (data['createdAt'] as Timestamp).toDate()
          : null,
    );
  }

  bool get isAdmin =>
      role.toUpperCase() == 'ADMIN' || isMasterAdminEmail(email);
  bool get isSuspended => status.toUpperCase() == 'SUSPENDED';
  bool get isRejected =>
      status.toUpperCase() == 'REJECTED' ||
      rejectionReason.isNotEmpty;
  bool get isPending =>
      !isAdmin &&
      !isRejected &&
      (status.toUpperCase() == 'PENDING_APPROVAL' ||
          status.toUpperCase() == 'PENDING' ||
          (!isSuspended && approved == false));
}

final firebaseAuthProvider = Provider<FirebaseAuth>((ref) => FirebaseAuth.instance);
final firestoreProvider = Provider<FirebaseFirestore>((ref) => FirebaseFirestore.instance);

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(firebaseAuthProvider).authStateChanges();
});

/// True while the Google sign-in / invite-code activation sheet is open.
/// The router freezes on /login during this time so it can't navigate the
/// page underneath the bottom sheet (which caused stacked screens/crashes).
final googleAuthBusyProvider = StateProvider<bool>((ref) => false);

final currentUserProfileProvider = StreamProvider<UserModel?>((ref) {
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) return Stream.value(null);

  final firestore = ref.watch(firestoreProvider);
  return firestore.collection('users').doc(authUser.uid).snapshots().map((doc) {
    if (!doc.exists) return null;
    final model = UserModel.fromFirestore(doc);
    // Auto-subscribe Admin devices to admin_alerts FCM topic so they receive approval & feedback pushes
    if (model.isAdmin) {
      FirebaseMessaging.instance.subscribeToTopic('admin_alerts').catchError((_) {});
    } else {
      FirebaseMessaging.instance.unsubscribeFromTopic('admin_alerts').catchError((_) {});
    }
    PushNotificationService.instance.syncDeviceToken(uid: authUser.uid).catchError((_) {});
    return model;
  });
});

class AuthService {
  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;

  AuthService(this._auth, this._firestore);

  Future<UserCredential> signIn(String email, String password) async {
    return await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<void> sendPasswordReset(String email) async {
    await _auth.sendPasswordResetEmail(email: email.trim());
  }

  Future<UserCredential> register({
    required String email,
    required String password,
    required String displayName,
    String inviteCode = '',
    String phoneNumber = '',
  }) async {
    final cleanCode = inviteCode.trim().toUpperCase();
    bool isMaster = false;
    bool hasValidCode = false;

    if (cleanCode.isNotEmpty) {
      // 1. Verify invite code in invite_codes or inviteCodes
      var inviteDoc = await _firestore.collection('invite_codes').doc(cleanCode).get();
      if (!inviteDoc.exists) {
        inviteDoc = await _firestore.collection('inviteCodes').doc(cleanCode).get();
      }

      if (!inviteDoc.exists) {
        throw Exception('Kod jemputan tidak sah.');
      }

      final data = inviteDoc.data() ?? {};
      final rawStatus = data['status'] ?? (data['active'] == true ? 'ACTIVE' : 'REVOKED');
      if (rawStatus == 'REVOKED') {
        throw Exception('Kod jemputan ini telah dibatalkan oleh pentadbir.');
      }
      isMaster = data['isMaster'] == true;
      if (rawStatus == 'USED' && !isMaster) {
        throw Exception('Kod jemputan ini telah digunakan.');
      }
      hasValidCode = true;
    }

    // 2. Create Auth User
    final cred = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );

    // 3. Create Firestore User Profile
    final initialStatus = isMaster ? 'ACTIVE' : (hasValidCode ? 'ACTIVE' : 'PENDING_APPROVAL');

    await _firestore.collection('users').doc(cred.user!.uid).set({
      'uid': cred.user!.uid,
      'email': email.trim(),
      'displayName': displayName.trim(),
      'phoneNumber': phoneNumber.trim(),
      'role': 'agent',
      'status': initialStatus,
      'approved': initialStatus == 'ACTIVE',
      'registeredWithCode': cleanCode.isNotEmpty ? cleanCode : 'DIRECT_REQUEST',
      'inviteCodeUsed': cleanCode,
      'createdAt': DateTime.now().toIso8601String(),
      'updatedAt': DateTime.now().toIso8601String(),
    });

    // Mark single-use code as used
    if (hasValidCode && !isMaster) {
      await _firestore.collection('invite_codes').doc(cleanCode).update({
        'status': 'USED',
        'usedBy': email.trim(),
        'usedByName': displayName.trim(),
        'usedAt': DateTime.now().toIso8601String(),
      }).catchError((_) {});
    }

    // If pending approval, alert Admins immediately
    if (initialStatus == 'PENDING_APPROVAL') {
      await _dispatchAdminPendingAlert(displayName: displayName, email: email);
    }

    return cred;
  }

  Future<UserCredential?> signInWithGoogle() async {
    try {
      final GoogleSignIn googleSignIn = GoogleSignIn(
        serverClientId: '975924997372-06nogtf16f250ope4ridpnodi9oh8fvc.apps.googleusercontent.com',
      );
      // disconnect() fully clears the cached account so the account-picker
      // always appears — prevents the "auto-skip" glitch after a cancelled flow.
      try {
        await googleSignIn.disconnect();
      } catch (_) {}
      final GoogleSignInAccount? googleUser = await googleSignIn.signIn();
      if (googleUser == null) return null; // User cancelled

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final OAuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final userCredential = await _auth.signInWithCredential(credential);
      if (userCredential.user != null) {
        final u = userCredential.user!;

        // Force-refresh the ID token so Firestore immediately uses the new
        // user's credentials — prevents PERMISSION_DENIED on account switch.
        await u.getIdToken(true);

        final photo = u.photoURL ?? '';
        if (photo.isNotEmpty) {
          final docRef = _firestore.collection('users').doc(u.uid);
          final doc = await docRef.get();
          if (doc.exists) {
            final existing = doc.data()?['photoUrl'] ?? doc.data()?['photoURL'] ?? '';
            if (existing != photo) {
              await docRef.set({
                'photoUrl': photo,
                'photoURL': photo,
                'updatedAt': DateTime.now().toIso8601String(),
              }, SetOptions(merge: true));
            }
          }
        }
      }
      return userCredential;
    } catch (e) {
      debugPrint('[AuthService] Google Sign In error: $e');
      rethrow;
    }
  }

  /// Verifies or provisions a Google user profile upon sign-in.
  /// Returns `true` if profile exists or was auto-provisioned (e.g. Admin),
  /// or `false` if the user is brand new and requires invite code activation.
  Future<bool> handlePostGoogleSignIn(User user) async {
    final cleanEmail = user.email?.trim().toLowerCase() ?? '';
    final isUserAdmin = isMasterAdminEmail(cleanEmail);

    final docRef = _firestore.collection('users').doc(user.uid);
    var doc = await docRef.get();

    // Check across all user docs for matching email to eliminate duplicate/split profiles
    if (cleanEmail.isNotEmpty) {
      final emailQuery = await _firestore
          .collection('users')
          .where('email', isEqualTo: cleanEmail)
          .get();

      if (emailQuery.docs.isNotEmpty) {
        DocumentSnapshot<Map<String, dynamic>>? bestDoc;

        // Choose the most authoritative profile: ACTIVE > REJECTED > SUSPENDED > PENDING
        for (final d in emailQuery.docs) {
          final s = (d.data()['status'] ?? '').toString().toUpperCase();
          if (s == 'ACTIVE') {
            bestDoc = d;
            break;
          } else if (s == 'REJECTED' || s == 'SUSPENDED') {
            bestDoc = d;
          } else {
            bestDoc ??= d;
          }
        }

        if (bestDoc != null) {
          final mergedData = Map<String, dynamic>.from(bestDoc.data() ?? {});
          mergedData['uid'] = user.uid;
          mergedData['email'] = cleanEmail;
          if (user.displayName != null && user.displayName!.isNotEmpty && (mergedData['displayName'] == null || mergedData['displayName'] == 'Agent')) {
            mergedData['displayName'] = user.displayName;
          }
          if (user.photoURL != null && user.photoURL!.isNotEmpty) {
            mergedData['photoUrl'] = user.photoURL;
            mergedData['photoURL'] = user.photoURL;
          }
          await docRef.set(mergedData, SetOptions(merge: true));
          doc = await docRef.get();

          // Delete obsolete duplicate document with different UID
          for (final d in emailQuery.docs) {
            if (d.id != user.uid) {
              await _firestore.collection('users').doc(d.id).delete().catchError((_) {});
            }
          }
        }
      }
    }

    if (!doc.exists) {
      if (isUserAdmin) {
        await docRef.set({
          'uid': user.uid,
          'email': cleanEmail,
          'displayName': user.displayName ?? 'Admin',
          'role': 'admin',
          'status': 'ACTIVE',
          'approved': true,
          'createdAt': DateTime.now().toIso8601String(),
          'updatedAt': DateTime.now().toIso8601String(),
        }, SetOptions(merge: true));
        return true;
      }
      return false; // Brand new user, needs activation modal
    }

    final data = doc.data() ?? {};
    final status = (data['status'] ?? 'ACTIVE').toString().toUpperCase();
    if (status == 'SUSPENDED') {
      await signOut();
      throw Exception('Your agent account has been suspended by the administrator.');
    }

    return true;
  }

  Future<void> completeGoogleRegistration({
    required String uid,
    required String email,
    required String displayName,
    required String inviteCode,
  }) async {
    final cleanCode = inviteCode.trim().toUpperCase();
    var inviteDoc = await _firestore.collection('invite_codes').doc(cleanCode).get();
    if (!inviteDoc.exists) {
      inviteDoc = await _firestore.collection('inviteCodes').doc(cleanCode).get();
    }

    if (!inviteDoc.exists) {
      throw Exception('Kod jemputan tidak sah.');
    }

    final data = inviteDoc.data() ?? {};
    final rawStatus = data['status'] ?? (data['active'] == true ? 'ACTIVE' : 'REVOKED');
    if (rawStatus == 'REVOKED') {
      throw Exception('Kod jemputan ini telah dibatalkan.');
    }
    final isMaster = data['isMaster'] == true;
    if (rawStatus == 'USED' && !isMaster) {
      throw Exception('Kod jemputan ini telah digunakan.');
    }

    final initialStatus = 'ACTIVE';
    final photo = _auth.currentUser?.photoURL ?? '';

    await _firestore.collection('users').doc(uid).set({
      'uid': uid,
      'email': email.trim(),
      'displayName': displayName.trim(),
      'photoUrl': photo,
      'photoURL': photo,
      'registeredWithCode': cleanCode,
      'role': 'agent',
      'status': initialStatus,
      'approved': true,
      'updatedAt': DateTime.now().toIso8601String(),
      'createdAt': DateTime.now().toIso8601String(),
    }, SetOptions(merge: true));

    final updateData = <String, dynamic>{
      'usedBy': email.trim(),
      'usedByName': displayName.trim(),
      'usedAt': DateTime.now().toIso8601String(),
      'usedCount': FieldValue.increment(1),
    };
    if (!isMaster) {
      updateData['status'] = 'USED';
      updateData['active'] = false;
    }
    await _firestore.collection('invite_codes').doc(cleanCode).update(updateData).catchError((_) {});
    await _firestore.collection('inviteCodes').doc(cleanCode).update(updateData).catchError((_) {});
  }

  Future<void> claimInviteCode(String code) async {
    final cleanCode = code.trim().toUpperCase();
    if (cleanCode.isEmpty) {
      throw Exception('Sila masukkan kod jemputan.');
    }
    DocumentSnapshot<Map<String, dynamic>> codeDoc =
        await _firestore.collection('invite_codes').doc(cleanCode).get();
    if (!codeDoc.exists) {
      codeDoc = await _firestore.collection('inviteCodes').doc(cleanCode).get();
    }
    if (!codeDoc.exists) {
      throw Exception('Kod jemputan tidak sah atau tidak wujud.');
    }
    final data = codeDoc.data() ?? {};
    final rawStatus = data['status'] ?? (data['active'] == true ? 'ACTIVE' : 'REVOKED');
    if (rawStatus == 'REVOKED') {
      throw Exception('Kod jemputan ini telah dibatalkan.');
    }
    final isMaster = data['isMaster'] == true;
    final maxUses = data['maxUses'] ?? 1;
    final usedCount = data['usedCount'] ?? 0;
    if (rawStatus == 'USED' && !isMaster) {
      throw Exception('Kod jemputan ini telah digunakan.');
    }
    if (!isMaster && usedCount >= maxUses) {
      throw Exception('Kod jemputan ini telah mencapai had penggunaan.');
    }

    final user = _auth.currentUser;
    if (user == null) throw Exception('Sila log masuk semula.');

    await _firestore.collection('users').doc(user.uid).set({
      'role': 'agent',
      'status': 'ACTIVE',
      'approved': true,
      'registeredWithCode': cleanCode,
      'updatedAt': DateTime.now().toIso8601String(),
    }, SetOptions(merge: true));

    final updateData = <String, dynamic>{
      'usedBy': user.email ?? '',
      'usedByName': user.displayName ?? '',
      'usedAt': DateTime.now().toIso8601String(),
      'usedCount': FieldValue.increment(1),
    };
    if (!isMaster) {
      updateData['status'] = 'USED';
      updateData['active'] = false;
    }
    await _firestore.collection('invite_codes').doc(cleanCode).update(updateData).catchError((_) {});
    await _firestore.collection('inviteCodes').doc(cleanCode).update(updateData).catchError((_) {});
  }

  Future<void> _dispatchAdminPendingAlert({
    required String displayName,
    required String email,
  }) async {
    try {
      final dio = Dio();
      final idToken = await _auth.currentUser?.getIdToken();
      await dio.post(
        'https://sendbroadcastpush-qmzvmlyqza-uc.a.run.app',
        data: {
          'topic': 'admin_alerts',
          'kind': 'pending-approval',
          'titleEN': 'New Agent Application 📋',
          'titleBM': 'Permohonan Ejen Baru 📋',
          'messageEN': '${displayName.trim()} ($email) requested access and is awaiting approval.',
          'messageBM': '${displayName.trim()} ($email) memohon akses dan sedang menunggu kelulusan.',
          'type': 'APPROVAL',
        },
        options: Options(headers: {
          'Content-Type': 'application/json',
          if (idToken != null) 'Authorization': 'Bearer $idToken',
        }),
      );
    } catch (e) {
      debugPrint('[AuthService] Admin alert push failed: $e');
    }
  }

  Future<void> requestAgentAccessGoogle({
    required String uid,
    required String email,
    required String displayName,
  }) async {
    final photo = _auth.currentUser?.photoURL ?? '';
    await _firestore.collection('users').doc(uid).set({
      'uid': uid,
      'email': email.trim(),
      'displayName': displayName.trim(),
      'photoUrl': photo,
      'photoURL': photo,
      'registeredWithCode': 'DIRECT_REQUEST',
      'role': 'agent',
      'status': 'PENDING_APPROVAL',
      'approved': false,
      'updatedAt': DateTime.now().toIso8601String(),
      'createdAt': DateTime.now().toIso8601String(),
    }, SetOptions(merge: true));

    // Alert admins immediately via push notification
    await _dispatchAdminPendingAlert(
      displayName: displayName.isNotEmpty ? displayName : 'Agent',
      email: email,
    );
  }

  Future<void> reapplyAccess() async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('Sila log masuk semula.');
    await _firestore.collection('users').doc(user.uid).set({
      'status': 'PENDING_APPROVAL',
      'approved': false,
      'rejectionReason': FieldValue.delete(),
      'rejectedAt': FieldValue.delete(),
      'updatedAt': DateTime.now().toIso8601String(),
    }, SetOptions(merge: true));

    // Alert admins immediately via push notification
    await _dispatchAdminPendingAlert(
      displayName: user.displayName ?? 'Agent',
      email: user.email ?? '',
    );
  }

  Future<void> signOut() async {
    try {
      await PushNotificationService.instance.unpairDeviceToken(uid: _auth.currentUser?.uid);
      // disconnect() clears the cached Google account token so the account
      // picker always shows on next sign-in — unlike signOut() which leaves
      // the session cached and causes the "auto-skip" glitch.
      await GoogleSignIn(
        serverClientId: '975924997372-06nogtf16f250ope4ridpnodi9oh8fvc.apps.googleusercontent.com',
      ).disconnect();
    } catch (_) {}
    await _auth.signOut();
  }
}

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(
    ref.watch(firebaseAuthProvider),
    ref.watch(firestoreProvider),
  );
});
