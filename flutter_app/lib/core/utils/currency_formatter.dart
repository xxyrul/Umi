import 'package:intl/intl.dart';

class CurrencyFormatter {
  static final _myrFormat = NumberFormat.currency(
    locale: 'ms_MY',
    symbol: 'RM ',
    decimalDigits: 0,
  );

  static String format(num amount) {
    return _myrFormat.format(amount);
  }

  static String formatCompact(num amount) {
    if (amount >= 1000000) {
      return 'RM ${(amount / 1000000).toStringAsFixed(2)}M';
    } else if (amount >= 1000) {
      return 'RM ${(amount / 1000).toStringAsFixed(0)}k';
    }
    return format(amount);
  }
}
