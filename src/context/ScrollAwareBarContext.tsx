import React, { createContext, useContext } from "react";
import {
  useSharedValue,
  useAnimatedScrollHandler,
  withTiming,
  withSpring,
  SharedValue,
} from "react-native-reanimated";

interface ScrollAwareBarContextType {
  barTranslateY: SharedValue<number>;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
}

const ScrollAwareBarContext = createContext<ScrollAwareBarContextType | null>(null);

const BAR_HEIGHT = 54;
const BAR_HIDE_THRESHOLD = 10; // Min scroll delta before triggering hide/show

export function ScrollAwareBarProvider({ children }: { children: React.ReactNode }) {
  const barTranslateY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const scrollDirection = useSharedValue<"up" | "down">("up");
  const accumulatedDelta = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const delta = currentY - lastScrollY.value;

      // Don't hide at the very top — always show bar
      if (currentY <= 0) {
        barTranslateY.value = withSpring(0, {
          damping: 20,
          stiffness: 150,
          mass: 0.8,
        });
        accumulatedDelta.value = 0;
        lastScrollY.value = currentY;
        return;
      }

      // Accumulate scroll delta in one direction
      if (delta > 0 && scrollDirection.value === "up") {
        // Direction changed to down
        accumulatedDelta.value = 0;
        scrollDirection.value = "down";
      } else if (delta < 0 && scrollDirection.value === "down") {
        // Direction changed to up
        accumulatedDelta.value = 0;
        scrollDirection.value = "up";
      }

      accumulatedDelta.value += Math.abs(delta);

      if (accumulatedDelta.value > BAR_HIDE_THRESHOLD) {
        if (delta > 0) {
          // Scrolling DOWN → hide bar (slide down off screen)
          barTranslateY.value = withTiming(BAR_HEIGHT + 40, {
            duration: 250,
          });
        } else if (delta < 0) {
          // Scrolling UP → show bar (slide back)
          barTranslateY.value = withSpring(0, {
            damping: 20,
            stiffness: 150,
            mass: 0.8,
          });
        }
      }

      lastScrollY.value = currentY;
    },
    onBeginDrag: () => {
      accumulatedDelta.value = 0;
    },
  });

  return (
    <ScrollAwareBarContext.Provider value={{ barTranslateY, scrollHandler }}>
      {children}
    </ScrollAwareBarContext.Provider>
  );
}

export function useScrollAwareBar() {
  const context = useContext(ScrollAwareBarContext);
  if (!context) {
    throw new Error("useScrollAwareBar must be used within ScrollAwareBarProvider");
  }
  return context;
}

export function useBarTranslateY() {
  const context = useContext(ScrollAwareBarContext);
  return context?.barTranslateY ?? null;
}
