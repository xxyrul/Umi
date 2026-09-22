import 'package:flutter_test/flutter_test.dart';
import 'package:caseflow/core/utils/malaysian_location_detector.dart';

void main() {
  group('MalaysianLocationDetector Tests', () {
    test('Detects Selangor from postcode 40000', () {
      final state = MalaysianLocationDetector.getStateFromPostcode('Seksyen 7, 40000 Shah Alam');
      expect(state, equals('Selangor'));
    });

    test('Detects Kuala Lumpur from postcode 50480', () {
      final state = MalaysianLocationDetector.getStateFromPostcode('Mont Kiara, 50480 KL');
      expect(state, equals('Kuala Lumpur'));
    });

    test('Detects Johor from postcode 81100', () {
      final state = MalaysianLocationDetector.getStateFromPostcode('Johor Bahru 81100 Johor');
      expect(state, equals('Johor'));
    });

    test('Extracts coordinates from Google Maps @lat,lng URL', () {
      const url = 'https://www.google.com/maps/place/KLCC/@3.1578,101.7119,17z';
      final coords = MalaysianLocationDetector.extractCoordinates(url);
      expect(coords, isNotNull);
      expect(coords!['lat'], closeTo(3.1578, 0.0001));
      expect(coords['lng'], closeTo(101.7119, 0.0001));
    });

    test('Extracts coordinates from Waze URL', () {
      const url = 'https://waze.com/ul?ll=3.1390,101.6869&navigate=yes';
      final coords = MalaysianLocationDetector.extractCoordinates(url);
      expect(coords, isNotNull);
      expect(coords!['lat'], closeTo(3.1390, 0.0001));
      expect(coords['lng'], closeTo(101.6869, 0.0001));
    });

    test('Extracts coordinates from raw comma-separated text', () {
      const raw = '3.0738, 101.5183';
      final coords = MalaysianLocationDetector.extractCoordinates(raw);
      expect(coords, isNotNull);
      expect(coords!['lat'], closeTo(3.0738, 0.0001));
      expect(coords['lng'], closeTo(101.5183, 0.0001));
    });

    test('Returns null for invalid coordinate strings', () {
      expect(MalaysianLocationDetector.extractCoordinates('Hello world without coordinates'), isNull);
    });

    test('Resolves Bagan Serai listing to Bagan Serai (not Kamunting)', () {
      final coords = MalaysianLocationDetector.getSmartListingCoordinates(
        address: 'Prima,Bagan Serai, Perak',
        title: 'Teres 2 Tingkat Prima,Bagan Serai',
        state: 'Perak',
        id: 'test-123',
      );
      expect(coords.resolvedTown, equals('bagan serai'));
      expect(coords.latitude, closeTo(5.0108, 0.05));
    });
  });
}
