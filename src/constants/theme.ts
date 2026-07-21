// Dark Mode Color Palette
export const COLORS = {
  // Surface Layers
  surface: "#0b1326",
  surfaceDim: "#0b1326",
  surfaceBright: "#31394d",
  surfaceContainerLowest: "#060e20",
  surfaceContainerLow: "#131b2e",
  surfaceContainer: "#171f33",
  surfaceContainerHigh: "#222a3d",
  surfaceContainerHighest: "#2d3449",
  onSurface: "#dae2fd",
  onSurfaceVariant: "#c7c4d7",
  inverseSurface: "#dae2fd",
  inverseOnSurface: "#283044",
  outline: "#908fa0",
  outlineVariant: "#464554",
  surfaceTint: "#c0c1ff",

  // Primary Colors (Indigo)
  primary: "#c0c1ff",
  onPrimary: "#1000a9",
  primaryContainer: "#8083ff",
  onPrimaryContainer: "#0d0096",
  inversePrimary: "#494bd6",

  // Secondary Colors (Cool Gray)
  secondary: "#b9c8de",
  onSecondary: "#233143",
  secondaryContainer: "#39485a",
  onSecondaryContainer: "#a7b6cc",

  // Tertiary Colors (Purple)
  tertiary: "#d0bcff",
  onTertiary: "#3c0091",
  tertiaryContainer: "#a078ff",
  onTertiaryContainer: "#340080",

  // Semantic Colors
  error: "#ffb4ab",
  errorContainer: "#93000a",
  success: "#10b981",
  warning: "#f59e0b",
  info: "#3b82f6",

  // Background
  background: "#0b1326",
  onBackground: "#dae2fd",

  // Status Colors
  statusViewing: "#8a9ba8",
  statusBookingPaid: "#f59e0b",
  statusSPASigned: "#3b82f6",
  statusLoanApproved: "#a78bfa",
  statusCompleted: "#10b981",
  statusCancelled: "#ffb4ab",
  statusPending: "#f59e0b",
  statusReview: "#8a9ba8",
};

// Typography
export const TYPOGRAPHY = {
  headlineXl: {
    fontSize: 48,
    fontWeight: "700" as const,
    lineHeight: 56,
    letterSpacing: -0.02,
    fontFamily: "Hanken Grotesk",
  },
  headlineXlMobile: {
    fontSize: 32,
    fontWeight: "700" as const,
    lineHeight: 40,
    letterSpacing: -0.02,
    fontFamily: "Hanken Grotesk",
  },
  headlineLg: {
    fontSize: 32,
    fontWeight: "600" as const,
    lineHeight: 40,
    letterSpacing: -0.01,
    fontFamily: "Hanken Grotesk",
  },
  headlineMd: {
    fontSize: 24,
    fontWeight: "600" as const,
    lineHeight: 32,
    fontFamily: "Hanken Grotesk",
  },
  bodyLg: {
    fontSize: 18,
    fontWeight: "400" as const,
    lineHeight: 28,
    fontFamily: "Inter",
  },
  bodyMd: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
    fontFamily: "Inter",
  },
  bodySm: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
    fontFamily: "Inter",
  },
  labelMd: {
    fontSize: 14,
    fontWeight: "500" as const,
    lineHeight: 16,
    letterSpacing: 0.02,
    fontFamily: "Geist",
  },
  labelSm: {
    fontSize: 12,
    fontWeight: "500" as const,
    lineHeight: 14,
    letterSpacing: 0.04,
    fontFamily: "Geist",
  },
};

// Spacing Scale (4px base unit)
export const SPACING = {
  base: 4,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
  gutter: 24,
  marginMobile: 16,
  marginDesktop: 48,
};

// Border Radius
export const BORDER_RADIUS = {
  sm: 4,
  default: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Shadow Configuration
export const SHADOWS = {
  small: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Status Badge Configuration
export const STATUS_CONFIG = {
  Viewing: {
    backgroundColor: "rgba(138, 155, 168, 0.1)",
    textColor: COLORS.statusViewing,
    icon: "eye",
  },
  "Booking Paid": {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    textColor: COLORS.statusBookingPaid,
    icon: "wallet-2",
  },
  "SPA Signed": {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    textColor: COLORS.statusSPASigned,
    icon: "file-text",
  },
  "Loan Approved": {
    backgroundColor: "rgba(167, 139, 250, 0.1)",
    textColor: COLORS.statusLoanApproved,
    icon: "check-circle",
  },
  Completed: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    textColor: COLORS.statusCompleted,
    icon: "check-circle-2",
  },
  Cancelled: {
    backgroundColor: "rgba(255, 180, 171, 0.1)",
    textColor: COLORS.statusCancelled,
    icon: "x-circle",
  },
  Pending: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    textColor: COLORS.statusPending,
    icon: "clock",
  },
  Review: {
    backgroundColor: "rgba(138, 155, 168, 0.1)",
    textColor: COLORS.statusReview,
    icon: "eye",
  },
};
