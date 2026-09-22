import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import '../../features/admin/admin_hub_screen.dart';
import '../../features/auth/auth_service.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/onboarding_screen.dart';
import '../../features/auth/pending_approval_screen.dart';
import '../../features/calculator/calculator_screen.dart';
import '../../features/cases/case_detail_screen.dart';
import '../../features/cases/case_form_screen.dart';
import '../../features/cases/case_model.dart';
import '../../features/cases/cases_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/help/help_screen.dart';
import '../../features/listings/listing_detail_screen.dart';
import '../../features/listings/listing_form_screen.dart';
import '../../features/listings/listing_model.dart';
import '../../features/listings/listings_screen.dart';
import '../../features/notifications/notification_settings_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/profile/account_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/security/permissions_guide_screen.dart';
import '../../features/security/security_screen.dart';
import '../../features/updater/updates_screen.dart';
import '../l10n/language_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/offline_banner_widget.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'rootNav');
final onboardingCompletedProvider = StateProvider<bool>((ref) => true);

CustomTransitionPage<void> _buildSmoothSlidePage({
  required GoRouterState state,
  required Widget child,
}) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 260),
    reverseTransitionDuration: const Duration(milliseconds: 220),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final slideIn = Tween<Offset>(
        begin: const Offset(0.08, 0),
        end: Offset.zero,
      ).animate(CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      ));

      final fadeIn = Tween<double>(
        begin: 0.0,
        end: 1.0,
      ).animate(CurvedAnimation(
        parent: animation,
        curve: Curves.easeOut,
      ));

      return SlideTransition(
        position: slideIn,
        child: FadeTransition(
          opacity: fadeIn,
          child: child,
        ),
      );
    },
  );
}

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final userProfileAsync = ref.watch(currentUserProfileProvider);
  final onboardingCompleted = ref.watch(onboardingCompletedProvider);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: onboardingCompleted ? (FirebaseAuth.instance.currentUser != null ? '/' : '/login') : '/onboarding',
    redirect: (context, state) {
      final authUser = authState.value;
      final userProfile = userProfileAsync.value;
      final loc = state.matchedLocation;

      final isLoggingIn = loc == '/login';
      final isPendingRoute = loc == '/pending-approval';
      final isOnboarding = loc == '/onboarding';

      if (!onboardingCompleted) return isOnboarding ? null : '/onboarding';
      if (isOnboarding) return '/login';

      if (authState.isLoading) return null;
      if (authUser == null) return isLoggingIn ? null : '/login';
      if (userProfileAsync.isLoading) return null;
      if (userProfile == null) return isLoggingIn ? null : '/login';
      if (userProfile.isSuspended) {
        ref.read(authServiceProvider).signOut();
        return '/login';
      }
      if (userProfile.isPending) return isPendingRoute ? null : '/pending-approval';
      if (isLoggingIn || isPendingRoute) return '/';

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/pending-approval',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => const PendingApprovalScreen(),
      ),
      GoRoute(
        path: '/calculator',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const CalculatorScreen(),
        ),
      ),
      GoRoute(
        path: '/notifications',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const NotificationsScreen(),
        ),
      ),
      GoRoute(
        path: '/notification-settings',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const NotificationSettingsScreen(),
        ),
      ),
      GoRoute(
        path: '/security',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const SecurityScreen(),
        ),
      ),
      GoRoute(
        path: '/permissions-guide',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const PermissionsGuideScreen(),
        ),
      ),
      GoRoute(
        path: '/account',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const AccountScreen(),
        ),
      ),
      GoRoute(
        path: '/help',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const HelpScreen(),
        ),
      ),
      GoRoute(
        path: '/updates',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const UpdatesScreen(),
        ),
      ),
      GoRoute(
        path: '/admin',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const AdminHubScreen(),
        ),
      ),
      // Case routes
      GoRoute(
        path: '/case/form',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: CaseFormScreen(
            editCaseId: state.uri.queryParameters['id'],
          ),
        ),
      ),
      GoRoute(
        path: '/case/:id',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'];
          final caseExtra = state.extra as CaseModel?;
          return _buildSmoothSlidePage(
            state: state,
            child: CaseDetailScreen(caseId: id, initialCase: caseExtra),
          );
        },
      ),
      // Listing routes
      GoRoute(
        path: '/listing/form',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: ListingFormScreen(
            editListingId: state.uri.queryParameters['id'],
          ),
        ),
      ),
      GoRoute(
        path: '/tambah',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) => _buildSmoothSlidePage(
          state: state,
          child: const ListingFormScreen(),
        ),
      ),
      GoRoute(
        path: '/listing/:id',
        parentNavigatorKey: rootNavigatorKey,
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'];
          final listingExtra = state.extra as ListingModel?;
          return _buildSmoothSlidePage(
            state: state,
            child: ListingDetailScreen(listingId: id, listing: listingExtra),
          );
        },
      ),

      // Main Navigation Shell with Custom Floating Pill Bar
      StatefulShellRoute.indexedStack(
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state, navigationShell) {
          return OfflineBannerWidget(
            child: _ScaffoldWithNavBar(navigationShell: navigationShell),
          );
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/',
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/cases',
                builder: (context, state) {
                  final statusFilter = state.uri.queryParameters['status'];
                  return CasesScreen(initialStatus: statusFilter);
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/listings',
                builder: (context, state) => const ListingsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class _ScaffoldWithNavBar extends ConsumerStatefulWidget {
  final StatefulNavigationShell navigationShell;

  const _ScaffoldWithNavBar({required this.navigationShell});

  @override
  ConsumerState<_ScaffoldWithNavBar> createState() => _ScaffoldWithNavBarState();
}

class _ScaffoldWithNavBarState extends ConsumerState<_ScaffoldWithNavBar> {
  final List<int> _tabHistory = [0];
  DateTime? _lastBackPressTime;

  @override
  void didUpdateWidget(covariant _ScaffoldWithNavBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    final current = widget.navigationShell.currentIndex;
    if (_tabHistory.isEmpty || _tabHistory.last != current) {
      _tabHistory.add(current);
    }
  }

  void _onTabSelected(int index) {
    final isReselect = widget.navigationShell.currentIndex == index;
    if (!isReselect) {
      _tabHistory.add(index);
    }
    if (index == 2) {
      ref.read(listingsToolbarResetProvider.notifier).state++;
    }
    widget.navigationShell.goBranch(index, initialLocation: false);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final bottomNavInset = math.max(
      MediaQuery.paddingOf(context).bottom,
      MediaQuery.viewPaddingOf(context).bottom,
    );
    // Adapt bottom spacing dynamically for Android navigation gestures & 3-button bar
    final floatingBarBottom = bottomNavInset > 0 ? bottomNavInset + 8.0 : 16.0;
    final isBM = ref.watch(languageProvider) == 'BM';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;

        // Step 1: Clean trailing occurrences of current tab
        while (_tabHistory.isNotEmpty && _tabHistory.last == widget.navigationShell.currentIndex) {
          _tabHistory.removeLast();
        }

        // Step 2: Pop to previously visited tab if history exists
        if (_tabHistory.isNotEmpty) {
          final prevIndex = _tabHistory.removeLast();
          widget.navigationShell.goBranch(prevIndex);
          setState(() {});
          return;
        }

        // Step 3: If on non-home tab and no history, go to Home tab (Tab 0)
        if (widget.navigationShell.currentIndex != 0) {
          widget.navigationShell.goBranch(0);
          setState(() {});
          return;
        }

        // Step 4: On Home tab (Dashboard) -> Double-tap to exit guard
        final now = DateTime.now();
        if (_lastBackPressTime == null || now.difference(_lastBackPressTime!) > const Duration(seconds: 2)) {
          _lastBackPressTime = now;
          ScaffoldMessenger.of(context).clearSnackBars();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                isBM
                    ? 'Tekan sekali lagi untuk keluar dari aplikasi'
                    : 'Press back again to exit app',
                style: const TextStyle(fontSize: 12),
              ),
              duration: const Duration(seconds: 2),
              behavior: SnackBarBehavior.floating,
              margin: EdgeInsets.only(bottom: floatingBarBottom + 66, left: 24, right: 24),
              backgroundColor: const Color(0xFF26292D),
            ),
          );
          return;
        }

        // Second press within 2 seconds: clean exit
        SystemNavigator.pop();
      },
      child: Scaffold(
        resizeToAvoidBottomInset: false,
        body: Stack(
          children: [
            // Direct zero-latency IndexedStack shell
            widget.navigationShell,
            Positioned(
              left: 20,
              right: 20,
              bottom: floatingBarBottom,
              child: _CustomFloatingTabBar(
                currentIndex: widget.navigationShell.currentIndex,
                onTap: _onTabSelected,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CustomFloatingTabBar extends ConsumerStatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _CustomFloatingTabBar({
    required this.currentIndex,
    required this.onTap,
  });

  @override
  ConsumerState<_CustomFloatingTabBar> createState() => _CustomFloatingTabBarState();
}

class _CustomFloatingTabBarState extends ConsumerState<_CustomFloatingTabBar> {
  bool _hasRendered = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          _hasRendered = true;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isBM = lang == 'BM';

    final items = [
      _TabItem(icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard_rounded, label: isBM ? 'Utama' : 'Dashboard'),
      _TabItem(icon: Icons.folder_outlined, activeIcon: Icons.folder_rounded, label: isBM ? 'Kes' : 'Cases'),
      _TabItem(icon: Icons.view_list_outlined, activeIcon: Icons.view_list_rounded, label: isBM ? 'Listing' : 'Listings'),
      _TabItem(icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded, label: isBM ? 'Profil' : 'Profile'),
    ];

    final alignX = -1.0 + (widget.currentIndex * (2.0 / (items.length - 1)));
    final colors = context.colors;

    return Container(
      height: 58,
      decoration: BoxDecoration(
        color: colors.card.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(29),
        border: Border.all(color: colors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedAlign(
            alignment: Alignment(alignX, 0.0),
            duration: _hasRendered ? const Duration(milliseconds: 250) : Duration.zero,
            curve: Curves.easeOutCubic,
            child: FractionallySizedBox(
              widthFactor: 1.0 / items.length,
              heightFactor: 0.9,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.maroonPrimary.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(
                    color: AppColors.maroonPrimary.withValues(alpha: 0.40),
                    width: 1,
                  ),
                ),
              ),
            ),
          ),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(items.length, (index) {
              final isSelected = widget.currentIndex == index;
              final item = items[index];

              return Expanded(
                child: Semantics(
                  button: true,
                  selected: isSelected,
                  label: item.label,
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      widget.onTap(index);
                    },
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          AnimatedScale(
                            scale: isSelected ? 1.15 : 1.0,
                            duration: _hasRendered ? const Duration(milliseconds: 200) : Duration.zero,
                            curve: Curves.easeOutBack,
                            child: Icon(
                              isSelected ? item.activeIcon : item.icon,
                              color: isSelected ? colors.maroonSecondary : colors.textMuted,
                              size: 20,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item.label,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                              color: isSelected ? colors.maroonSecondary : colors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _TabItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const _TabItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}
