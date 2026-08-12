// DRT Master Listing CRM Design System Tokens (Light & Dark Modes)

export const LIGHT_THEME = {
  canvasBackground: "#F9F9F9",
  cardBackground: "#FFFFFF",
  surfaceContainer: "#EEEEEE",
  surfaceContainerLow: "#F3F3F3",
  maroonPrimary: "#7A1128",
  maroonDark: "#570016",
  maroonLight: "#FDF2F4",
  maroonBorder: "#F4D2D8",
  textPrimary: "#1A1C1C",
  textSecondary: "#574143",
  textMuted: "#6B5556",
  borderColor: "#E2E2E2",
  outlineVariant: "#DDBFC0",
  chipActiveBg: "#D5E0F8",
  chipActiveText: "#111C2D",

  // Status Colors
  statusAktifBg: "#004640",
  statusAktifText: "#49BAAD",
  statusBookingBg: "#D5E0F8",
  statusBookingText: "#111C2D",
  statusSoldBg: "#EEEEEE",
  statusSoldText: "#574143",
  statusDraftBg: "#FEF3C7",
  statusDraftText: "#92400E",
  accentSuccess: "#10B981",
  accentSuccessLight: "#D1FAE5",
  accentWhatsApp: "#25D366",
  disabledBg: "#F3F4F6",
  disabledText: "#7A8290",
};

export const THEME = LIGHT_THEME;

export const DARK_THEME = {
  canvasBackground: "#121212",
  cardBackground: "#1A1C1E",
  surfaceContainer: "#222427",
  surfaceContainerLow: "#181A1C",
  maroonPrimary: "#FFB2B8",
  maroonDark: "#7A1128",
  maroonLight: "#2E1218",
  maroonBorder: "#4A1E25",
  textPrimary: "#FFFFFF",
  textSecondary: "#DEDEDE",
  textMuted: "#B0B8C4",
  borderColor: "#505558",
  outlineVariant: "#606468",
  chipActiveBg: "#3D4F66",
  chipActiveText: "#FFFFFF",

  // Status Colors
  statusAktifBg: "#064E3B",
  statusAktifText: "#A7F3D0",
  statusBookingBg: "#1E3A8A",
  statusBookingText: "#BFDBFE",
  statusSoldBg: "#374151",
  statusSoldText: "#E8EAED",
  statusDraftBg: "#78350F",
  statusDraftText: "#FDE68A",
  accentSuccess: "#10B981",
  accentSuccessLight: "#064E3B",
  accentWhatsApp: "#25D366",
  disabledBg: "#25282B",
  disabledText: "#8A909A",
};

// Legacy Exports for Backward Compatibility
export const COLORS = {
  surface: "#1A1C1E",
  surfaceDim: "#111315",
  surfaceBright: "#31394d",
  surfaceContainerLowest: "#1A1C1E",
  surfaceContainerLow: "#181A1C",
  surfaceContainer: "#222427",
  surfaceContainerHigh: "#2d3449",
  surfaceContainerHighest: "#3F4346",
  onSurface: "#F1F1F1",
  onSurfaceVariant: "#DEDEDE",
  inverseSurface: "#F1F1F1",
  inverseOnSurface: "#1A1C1E",
  outline: "#B0B8C4",
  outlineVariant: "#3F4346",
  surfaceTint: "#FFB2B8",

  primary: "#7A1128",
  onPrimary: "#FFFFFF",
  primaryContainer: "#7A1128",
  onPrimaryContainer: "#FFFFFF",
  inversePrimary: "#FFB2B8",

  secondary: "#545F73",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#D5E0F8",
  onSecondaryContainer: "#111C2D",

  tertiary: "#004640",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#004640",
  onTertiaryContainer: "#49BAAD",

  error: "#BA1A1A",
  errorContainer: "#FFDAD6",
  success: "#10B981",
  warning: "#F59E0B",
  info: "#3B82F6",

  background: "#F9F9F9",
  onBackground: "#1A1C1C",

  statusViewing: "#8A9BA8",
  statusBookingPaid: "#F59E0B",
  statusSPASigned: "#3B82F6",
  statusLoanApproved: "#A78BFA",
  statusCompleted: "#10B981",
  statusCancelled: "#FFB4AB",
  statusPending: "#F59E0B",
  statusReview: "#8A9BA8",
};

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

export const BORDER_RADIUS = {
  sm: 4,
  default: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const STATUS_CONFIG = {
  Viewing: {
    backgroundColor: "rgba(138, 155, 168, 0.1)",
    textColor: COLORS.statusViewing,
    icon: "eye",
  },
  "Booking Paid": {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    textColor: COLORS.statusBookingPaid,
    icon: "wallet-outline",
  },
  "SPA Signed": {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    textColor: COLORS.statusSPASigned,
    icon: "file-sign",
  },
  "Loan Approved": {
    backgroundColor: "rgba(167, 139, 250, 0.1)",
    textColor: COLORS.statusLoanApproved,
    icon: "check-circle-outline",
  },
  Completed: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    textColor: COLORS.statusCompleted,
    icon: "checkbox-marked-circle",
  },
  Cancelled: {
    backgroundColor: "rgba(255, 180, 171, 0.1)",
    textColor: COLORS.statusCancelled,
    icon: "close-circle-outline",
  },
  Pending: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    textColor: COLORS.statusPending,
    icon: "clock-outline",
  },
  Review: {
    backgroundColor: "rgba(138, 155, 168, 0.1)",
    textColor: COLORS.statusReview,
    icon: "eye",
  },
};

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
