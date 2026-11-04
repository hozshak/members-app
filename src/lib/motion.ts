// A soft pulse for what should catch the eye (the star of the rating, the circle of the assistant). Nothing moves when the phone is set to
// reduce motion.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

const nativeDriver = Platform.OS !== 'web';

/** Runs from 0 to 1 again and again, with a rest in between. */
export function usePulse(ms = 1400, restMs = 0): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let alive = true;
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!alive || reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: ms, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: nativeDriver }),
        Animated.delay(restMs),
      ]));
      loop.start();
    });
    return () => {
      alive = false;
      loop?.stop();
    };
  }, [value, ms, restMs]);
  return value;
}
