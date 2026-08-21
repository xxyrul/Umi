import { Dimensions, PixelRatio } from "react-native";

// Guideline base dimensions based on standard mobile screen (iPhone 14 / Samsung Galaxy S-series baseline: 375 x 812)
const GUIDELINE_BASE_WIDTH = 375;
const GUIDELINE_BASE_HEIGHT = 812;

const getWindowDimensions = () => Dimensions.get("window");

/**
 * Converts width percentage to DP.
 * Example: wp(31.2) returns 31.2% of screen width.
 */
export const wp = (percentage: number | string): number => {
  const { width } = getWindowDimensions();
  const value = typeof percentage === "number" ? percentage : parseFloat(percentage);
  return PixelRatio.roundToNearestPixel((width * value) / 100);
};

/**
 * Converts height percentage to DP.
 * Example: hp(20) returns 20% of screen height.
 */
export const hp = (percentage: number | string): number => {
  const { height } = getWindowDimensions();
  const value = typeof percentage === "number" ? percentage : parseFloat(percentage);
  return PixelRatio.roundToNearestPixel((height * value) / 100);
};

/**
 * Scales a size based on screen width against baseline (375).
 */
export const scale = (size: number): number => {
  const { width } = getWindowDimensions();
  return PixelRatio.roundToNearestPixel((width / GUIDELINE_BASE_WIDTH) * size);
};

/**
 * Scales vertically based on screen height against baseline (812).
 */
export const verticalScale = (size: number): number => {
  const { height } = getWindowDimensions();
  return PixelRatio.roundToNearestPixel((height / GUIDELINE_BASE_HEIGHT) * size);
};

/**
 * Moderate scaling with resize factor (default: 0.5).
 * Useful for font sizes and paddings so they don't blow up or shrink too aggressively.
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  return PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor);
};
