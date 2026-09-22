import 'package:flutter_test/flutter_test.dart';
import 'package:caseflow/core/utils/currency_formatter.dart';

void main() {
  test('CurrencyFormatter formats MYR amounts correctly', () {
    expect(CurrencyFormatter.format(450000), equals('RM 450,000'));
    expect(CurrencyFormatter.format(0), equals('RM 0'));
  });
}
