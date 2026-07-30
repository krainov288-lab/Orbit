/**
 * Triggers haptic feedback using Web Vibration API if supported by the browser/device.
 */
export type HapticPattern = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'error' | number;

export const triggerHaptic = (pattern: HapticPattern = 'selection') => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      if (typeof pattern === 'number') {
        navigator.vibrate(pattern);
      } else {
        switch (pattern) {
          case 'selection':
            navigator.vibrate(10); // Crisp light pulse for tab selection
            break;
          case 'light':
            navigator.vibrate(15);
            break;
          case 'medium':
            navigator.vibrate(35);
            break;
          case 'heavy':
            navigator.vibrate(60);
            break;
          case 'success':
            navigator.vibrate([20, 40, 20]); // Double-tap pulse for message sent
            break;
          case 'error':
            navigator.vibrate([50, 50, 50, 50]);
            break;
          default:
            navigator.vibrate(10);
        }
      }
    } catch {
      // Safe fallback if vibration is blocked or unsupported
    }
  }
};
