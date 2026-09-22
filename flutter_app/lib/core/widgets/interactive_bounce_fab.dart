import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Tactile, bouncy floating action button that compresses slightly on touch
/// down and springs back with haptic feedback, providing delightful physical feedback.
class InteractiveBounceFab extends StatefulWidget {
  final VoidCallback onPressed;
  final Widget icon;
  final Color backgroundColor;
  final Color foregroundColor;
  final double size;

  const InteractiveBounceFab({
    super.key,
    required this.onPressed,
    required this.icon,
    required this.backgroundColor,
    this.foregroundColor = Colors.white,
    this.size = 56.0,
  });

  @override
  State<InteractiveBounceFab> createState() => _InteractiveBounceFabState();
}

class _InteractiveBounceFabState extends State<InteractiveBounceFab> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 130),
      reverseDuration: const Duration(milliseconds: 180),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.88).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic, reverseCurve: Curves.easeOutBack),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails _) {
    _controller.forward();
    HapticFeedback.lightImpact();
  }

  void _handleTapUp(TapUpDetails _) {
    _controller.reverse();
    widget.onPressed();
  }

  void _handleTapCancel() {
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      behavior: HitTestBehavior.opaque,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) => Transform.scale(
          scale: _scaleAnimation.value,
          child: child,
        ),
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            color: widget.backgroundColor,
            borderRadius: BorderRadius.circular(widget.size * 0.32),
            boxShadow: [
              BoxShadow(
                color: widget.backgroundColor.withValues(alpha: 0.40),
                blurRadius: 16,
                spreadRadius: 1,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Center(
            child: IconTheme(
              data: IconThemeData(color: widget.foregroundColor, size: widget.size * 0.48),
              child: widget.icon,
            ),
          ),
        ),
      ),
    );
  }
}
