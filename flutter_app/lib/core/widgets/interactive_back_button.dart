import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';

/// Tactile interactive back button with responsive touch scaling and haptic feedback.
class InteractiveBackButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final Color? color;
  final IconData icon;

  const InteractiveBackButton({
    super.key,
    this.onPressed,
    this.color,
    this.icon = Icons.arrow_back_ios_new_rounded,
  });

  @override
  State<InteractiveBackButton> createState() => _InteractiveBackButtonState();
}

class _InteractiveBackButtonState extends State<InteractiveBackButton> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 110),
      reverseDuration: const Duration(milliseconds: 160),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.84).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOut, reverseCurve: Curves.easeOutBack),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _triggerPop() {
    if (widget.onPressed != null) {
      widget.onPressed!();
    } else {
      Navigator.maybePop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTapDown: (_) {
        _ctrl.forward();
        HapticFeedback.selectionClick();
      },
      onTapUp: (_) {
        _ctrl.reverse();
        _triggerPop();
      },
      onTapCancel: () => _ctrl.reverse(),
      behavior: HitTestBehavior.opaque,
      child: AnimatedBuilder(
        animation: _scale,
        builder: (context, child) => Transform.scale(
          scale: _scale.value,
          child: child,
        ),
        child: Container(
          width: 38,
          height: 38,
          margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.border, width: 1),
          ),
          child: Center(
            child: Icon(
              widget.icon,
              size: 17,
              color: widget.color ?? colors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
