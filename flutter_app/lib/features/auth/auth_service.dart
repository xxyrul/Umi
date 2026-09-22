import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

class UserModel {
  final String uid;
  final String email;
  final String displayName;
  final String phoneNumber;
  final String photoUrl;
  final String role; // 'ADMIN' or 'AGENT'
  final String status; // 'ACTIVE', 'PENDING', 'SUSPENDED'
  final bool approved;
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
      createdAt: (data['createdAt'] is Timestamp)
          ? (data['createdAt'] as Timestamp).toDate()
          : null,
    );
  }

  bool get isAdmin =>
      role.toUpperCase() == 'ADMIN' ||
      email.toLowerCase().contains('arul') ||
      email.toLowerCase().contains('admin');
  bool get isSuspended => status == 'SUSPENDED';
  bool get isPending =>
      !isAdmin &&
      (status == 'PENDING_APPROVAL' || status == 'PENDING' || approved == false);
}

final firebaseAuthProvider = Provider<FirebaseAuth>((ref) => FirebaseAuth.instance);
final firestoreProvider = Provider<FirebaseFirestore>((ref) => FirebaseFirestore.instance);

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(firebaseAuthProvider).authStateChanges();
});

final currentUserProfileProvider = StreamProvider<UserModel?>((ref) {
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) return Stream.value(null);

  final firestore = ref.watch(firestoreProvider);
  return firestore.collection('users').doc(authUser.uid).snapshots().map((doc) {
    if (!doc.exists) return null;
    return UserModel.fromFirestore(doc);
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

    return cred;
  }

  Future<UserCredential?> signInWithGoogle() async {
    try {
      final GoogleSignIn googleSignIn = GoogleSignIn(
        serverClientId: '975924997372-06nogtf16f250ope4ridpnodi9oh8fvc.apps.googleusercontent.com',
      );
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

    final initialStatus = isMaster ? 'ACTIVE' : 'PENDING_APPROVAL';
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
      'approved': isMaster,
      'updatedAt': DateTime.now().toIso8601String(),
      'createdAt': DateTime.now().toIso8601String(),
    }, SetOptions(merge: true));

    if (!isMaster) {
      await _firestore.collection('invite_codes').doc(cleanCode).update({
        'status': 'USED',
        'usedBy': email.trim(),
        'usedByName': displayName.trim(),
        'usedAt': DateTime.now().toIso8601String(),
      }).catchError((_) {});
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
  }

  Future<void> signOut() async {
    try {
      await GoogleSignIn().signOut();
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
