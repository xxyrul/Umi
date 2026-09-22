import 'package:flutter/material.dart';

/// Modern top-floating pill HUD toast that drops smoothly below the status bar
/// eliminating any overlap with bottom navigation bars, gesture bars, or FABs.
class AppToast {
  static OverlayEntry? _currentEntry;

  static void show(
    BuildContext context, {
    required String message,
    IconData icon = Icons.info_outline_rounded,
    Color backgroundColor = const Color(0xFF1E2022),
    Color textColor = Colors.white,
    Color iconColor = const Color(0xFFBE123C),
    Duration duration = const Duration(milliseconds: 2800),
  }) {
    _currentEntry?.remove();
    _currentEntry = null;

    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (context) => _TopToastWidget(
        message: message,
        icon: icon,
        backgroundColor: backgroundColor,
        textColor: textColor,
        iconColor: iconColor,
        duration: duration,
        onDismiss: () {
          if (_currentEntry == entry) {
            entry.remove();
            _currentEntry = null;
          }
        },
      ),
    );

    _currentEntry = entry;
    overlay.insert(entry);
  }

  static void success(BuildContext context, String message) {
    show(
      context,
      message: message,
      icon: Icons.check_circle_outline_rounded,
      backgroundColor: const Color(0xFF132A1C),
      iconColor: const Color(0xFF34D399),
      textColor: const Color(0xFFECFDF5),
    );
  }

  static void error(BuildContext context, String message) {
    show(
      context,
      message: message,
      icon: Icons.error_outline_rounded,
      backgroundColor: const Color(0xFF3B1219),
      iconColor: const Color(0xFFF87171),
      textColor: const Color(0xFFFEF2F2),
    );
  }

  static void warning(BuildContext context, String message) {
    show(
      context,
      message: message,
      icon: Icons.warning_amber_rounded,
      backgroundColor: const Color(0xFF3B2A10),
      iconColor: const Color(0xFFFBBF24),
      textColor: const Color(0xFFFFFBEB),
    );
  }

  static void info(BuildContext context, String message) {
    show(
      context,
      message: message,
      icon: Icons.info_outline_rounded,
      backgroundColor: const Color(0xFF1C222C),
      iconColor: const Color(0xFF60A5FA),
      textColor: const Color(0xFFF0F9FF),
    );
  }
}

class _TopToastWidget extends StatefulWidget {
  final String message;
  final IconData icon;
  final Color backgroundColor;
  final Color textColor;
  final Color iconColor;
  final Duration duration;
  final VoidCallback onDismiss;

  const _TopToastWidget({
    required this.message,
    required this.icon,
    required this.backgroundColor,
    required this.textColor,
    required this.iconColor,
    required this.duration,
    required this.onDismiss,
  });

  @override
  State<_TopToastWidget> createState() => _TopToastWidgetState();
}

class _TopToastWidgetState extends State<_TopToastWidget> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _slideAnimation;
  late final Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _slideAnimation = Tween<double>(begin: -40.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );

    _opacityAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );

    _controller.forward();

    Future.delayed(widget.duration, () {
      if (mounted) {
        _controller.reverse().then((_) {
          if (mounted) widget.onDismiss();
        });
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Positioned(
      top: topPadding > 0 ? topPadding + 8.0 : 20.0,
      left: 16,
      right: 16,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(0, _slideAnimation.value),
            child: Opacity(
              opacity: _opacityAnimation.value,
              child: child,
            ),
          );
        },
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: widget.backgroundColor,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: widget.iconColor.withValues(alpha: 0.35),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(widget.icon, color: widget.iconColor, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    widget.message,
                    style: TextStyle(
                      color: widget.textColor,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
