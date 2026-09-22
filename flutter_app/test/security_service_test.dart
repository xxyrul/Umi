import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:caseflow/features/security/security_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SecurityService securityService;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    securityService = SecurityService();
  });

  group('SecurityService Tests', () {
    test('Stores and verifies salted SHA-256 PIN correctly', () async {
      await securityService.setPinLock('1234');

      final isEnabled = await securityService.isPinLockEnabled();
      expect(isEnabled, isTrue);

      final isCorrect = await securityService.verifyPin('1234');
      expect(isCorrect, isTrue);

      final isWrong = await securityService.verifyPin('9999');
      expect(isWrong, isFalse);
    });

    test('Enforces 30-second lockout after 5 failed attempts', () async {
      await securityService.setPinLock('5678');

      // 4 wrong attempts - no lockout yet
      for (int i = 0; i < 4; i++) {
        final ok = await securityService.verifyPin('0000');
        expect(ok, isFalse);
        final lockout = await securityService.getRemainingLockoutSeconds();
        expect(lockout, equals(0));
      }

      // 5th wrong attempt triggers lockout
      final fifthAttempt = await securityService.verifyPin('0000');
      expect(fifthAttempt, isFalse);

      final lockoutSeconds = await securityService.getRemainingLockoutSeconds();
      expect(lockoutSeconds, greaterThan(0));
      expect(lockoutSeconds, lessThanOrEqualTo(30));

      // During lockout, even correct PIN is rejected
      final blockedCorrect = await securityService.verifyPin('5678');
      expect(blockedCorrect, isFalse);
    });

    test('Transparently migrates legacy unhashed PIN', () async {
      // Simulate legacy install where plain PIN was stored
      SharedPreferences.setMockInitialValues({
        '@artha_app_lock_enabled': true,
        '@artha_app_lock_pin': '4321',
      });

      final service = SecurityService();
      expect(await service.isPinLockEnabled(), isTrue);

      // Verify with legacy PIN triggers auto-migration
      final isCorrect = await service.verifyPin('4321');
      expect(isCorrect, isTrue);

      // Plaintext PIN key should now be purged
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.containsKey('@artha_app_lock_pin'), isFalse);
      expect(prefs.containsKey('@artha_app_lock_pin_hash'), isTrue);
      expect(prefs.containsKey('@artha_app_lock_salt'), isTrue);
    });
  });
}
