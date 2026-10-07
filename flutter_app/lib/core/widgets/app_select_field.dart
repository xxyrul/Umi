import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';

class AppSelectItem<T> {
  final T value;
  final String label;
  final String? subtitle;
  final IconData? icon;
  final Color? iconColor;

  const AppSelectItem({
    required this.value,
    required this.label,
    this.subtitle,
    this.icon,
    this.iconColor,
  });
}

class AppSelectField<T> extends StatelessWidget {
  final String label;
  final T? value;
  final List<AppSelectItem<T>> items;
  final ValueChanged<T> onChanged;
  final String? sheetTitle;
  final String? hint;
  final AppThemeColors? colors;
  final Widget? prefixIcon;
  final bool enabled;
  final bool? showSearch;
  final String? searchHint;
  final String? errorText;

  const AppSelectField({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.sheetTitle,
    this.hint,
    this.colors,
    this.prefixIcon,
    this.enabled = true,
    this.showSearch,
    this.searchHint,
    this.errorText,
  });

  AppSelectItem<T>? get _selectedItem {
    try {
      return items.firstWhere((item) => item.value == value);
    } catch (_) {
      return null;
    }
  }

  void _openBottomSheet(BuildContext context, AppThemeColors themeColors) {
    if (!enabled) return;

    // Dismiss active keyboard first to prevent frame drops
    FocusScope.of(context).unfocus();
    HapticFeedback.lightImpact();

    final bool enableSearch = showSearch ?? (items.length > 8);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withOpacity(0.6),
      builder: (ctx) => _AppSelectBottomSheet<T>(
        title: sheetTitle ?? label,
        items: items,
        selectedValue: value,
        colors: themeColors,
        enableSearch: enableSearch,
        searchHint: searchHint,
        onSelected: (val) {
          onChanged(val);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeColors = colors ?? context.colors;
    final selected = _selectedItem;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: enabled ? () => _openBottomSheet(context, themeColors) : null,
            borderRadius: BorderRadius.circular(12),
            splashColor: themeColors.maroonPrimary.withOpacity(0.08),
            highlightColor: themeColors.maroonPrimary.withOpacity(0.04),
            child: Ink(
              decoration: BoxDecoration(
                color: themeColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: errorText != null
                      ? themeColors.error
                      : themeColors.border,
                  width: 1.0,
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  if (prefixIcon != null) ...[
                    prefixIcon!,
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          label,
                          style: TextStyle(
                            color: themeColors.textMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          selected?.label ?? hint ?? '',
                          style: TextStyle(
                            color: selected != null
                                ? themeColors.textPrimary
                                : themeColors.textDim,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: enabled ? themeColors.textMuted : themeColors.textDim.withOpacity(0.4),
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(
              errorText!,
              style: TextStyle(color: themeColors.error, fontSize: 11),
            ),
          ),
        ],
      ],
    );
  }
}

class _AppSelectBottomSheet<T> extends StatefulWidget {
  final String title;
  final List<AppSelectItem<T>> items;
  final T? selectedValue;
  final AppThemeColors colors;
  final bool enableSearch;
  final String? searchHint;
  final ValueChanged<T> onSelected;

  const _AppSelectBottomSheet({
    required this.title,
    required this.items,
    required this.selectedValue,
    required this.colors,
    required this.enableSearch,
    required this.searchHint,
    required this.onSelected,
  });

  @override
  State<_AppSelectBottomSheet<T>> createState() => _AppSelectBottomSheetState<T>();
}

class _AppSelectBottomSheetState<T> extends State<_AppSelectBottomSheet<T>> {
  final _searchController = TextEditingController();
  late List<AppSelectItem<T>> _filteredItems;

  @override
  void initState() {
    super.initState();
    _filteredItems = widget.items;
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = _searchController.text.trim().toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredItems = widget.items;
      } else {
        _filteredItems = widget.items.where((item) {
          final matchLabel = item.label.toLowerCase().contains(query);
          final matchSub = item.subtitle?.toLowerCase().contains(query) ?? false;
          return matchLabel || matchSub;
        }).toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.75;

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      margin: EdgeInsets.only(bottom: bottomInset),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        border: Border.all(color: colors.border.withOpacity(0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle pill
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.textDim.withOpacity(0.35),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header Row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: () => Navigator.pop(context),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.close_rounded, size: 18, color: colors.textMuted),
                    ),
                  ),
                ],
              ),
            ),

            // Optional Search Bar
            if (widget.enableSearch)
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 10),
                child: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: colors.border),
                  ),
                  child: TextField(
                    controller: _searchController,
                    style: TextStyle(color: colors.textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: widget.searchHint ?? 'Cari pilihan... / Search...',
                      hintStyle: TextStyle(color: colors.textDim, fontSize: 13),
                      prefixIcon: Icon(Icons.search_rounded, size: 18, color: colors.textMuted),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 16),
                              color: colors.textMuted,
                              onPressed: () => _searchController.clear(),
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 11),
                    ),
                  ),
                ),
              ),

            const Divider(height: 1, thickness: 0.8),

            // List of Options
            Flexible(
              child: _filteredItems.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(28.0),
                      child: Center(
                        child: Text(
                          'Tiada pilihan ditemui / No items found',
                          style: TextStyle(color: colors.textDim, fontSize: 13),
                        ),
                      ),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      padding: EdgeInsets.fromLTRB(14, 8, 14, safeBottom > 0 ? safeBottom + 8 : 16),
                      physics: const BouncingScrollPhysics(),
                      itemCount: _filteredItems.length,
                      itemBuilder: (ctx, index) {
                        final item = _filteredItems[index];
                        final isSelected = item.value == widget.selectedValue;

                        return Container(
                          margin: const EdgeInsets.symmetric(vertical: 3),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              borderRadius: BorderRadius.circular(12),
                              onTap: () {
                                HapticFeedback.selectionClick();
                                Navigator.pop(context);
                                widget.onSelected(item.value);
                              },
                              child: Ink(
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? colors.maroonPrimary.withOpacity(0.12)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSelected
                                        ? colors.maroonPrimary.withOpacity(0.4)
                                        : Colors.transparent,
                                  ),
                                ),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                child: Row(
                                  children: [
                                    if (item.icon != null) ...[
                                      Icon(
                                        item.icon,
                                        size: 20,
                                        color: item.iconColor ?? (isSelected ? colors.maroonPrimary : colors.textMuted),
                                      ),
                                      const SizedBox(width: 12),
                                    ],
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.label,
                                            style: TextStyle(
                                              color: isSelected ? colors.maroonPrimary : colors.textPrimary,
                                              fontSize: 14,
                                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                            ),
                                          ),
                                          if (item.subtitle != null) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              item.subtitle!,
                                              style: TextStyle(
                                                color: colors.textMuted,
                                                fontSize: 12,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Icon(
                                      isSelected
                                          ? Icons.check_circle_rounded
                                          : Icons.radio_button_unchecked_rounded,
                                      size: 20,
                                      color: isSelected
                                          ? colors.maroonPrimary
                                          : colors.textDim.withOpacity(0.35),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
