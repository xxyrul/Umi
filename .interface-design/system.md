# Artha Design System

## 1. Product Direction & Personality
- **App Name:** Artha (Real Estate Negotiator & Case Management CRM)
- **Personality:** Precision, Luxury & Trust, High-Craft Mobile Experience
- **Depth Strategy:** Subtle glass elevations, dark mode tone layering, and clean outline accents.

---

## 2. Color Palette & Tokens

### Light Theme
- `canvasBackground`: `#F9F9F9`
- `cardBackground`: `#FFFFFF`
- `surfaceContainer`: `#EEEEEE`
- `surfaceContainerLow`: `#F3F3F3`
- `maroonPrimary`: `#7A1128` (Brand Accent)
- `maroonLight`: `#FDF2F4`
- `maroonBorder`: `#F4D2D8`
- `textPrimary`: `#1A1C1C`
- `textSecondary`: `#574143`
- `textMuted`: `#6B5556`
- `borderColor`: `#E2E2E2`

### Dark Theme
- `canvasBackground`: `#121212`
- `cardBackground`: `#1A1C1E`
- `surfaceContainer`: `#222427`
- `surfaceContainerLow`: `#181A1C`
- `maroonPrimary`: `#FFB2B8` (Brand Accent)
- `maroonDark`: `#7A1128`
- `maroonLight`: `#2E1218`
- `maroonBorder`: `#4A1E25`
- `textPrimary`: `#FFFFFF`
- `textSecondary`: `#DEDEDE`
- `textMuted`: `#B0B8C4`
- `borderColor`: `#505558`

### Status Accents
- `Active / Aktif`: `#10B981` (Green)
- `Booking`: `#3B82F6` (Blue)
- `Sold`: `#6B7280` (Neutral Gray)
- `Draft / Pending`: `#F59E0B` (Amber)

---

## 3. Spacing Grid (Strict 8pt System)
- `xs`: `4px`
- `sm`: `8px`
- `md`: `16px`
- `lg`: `24px`
- `xl`: `32px`
- `xxl`: `48px`

---

## 4. Border Radius Tokens
- `sm`: `4px` (tags, badge pills)
- `default`: `8px` (small inputs)
- `md`: `12px` (buttons, inputs)
- `lg`: `16px` (cards, containers)
- `xl`: `24px` (modals, hero sections)
- `full`: `9999px` (floating navigation bar, circular avatars)

---

## 5. Interaction & Motion Rules
- **Tactile Haptics:** Trigger `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on button clicks, tab switches, and important toggles.
- **Card Press States:** Always use `activeOpacity={0.75}` on clickable cards.
- **Floating Dock Clearance:** Ensure all scrollable views have `paddingBottom: insets.bottom + 120` or higher to clear the floating bottom navigation bar.
