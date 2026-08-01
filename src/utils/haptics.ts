// Vibration API utility for subtle tactile feedback across key user interactions

export const haptics = {
  /**
   * Light tactile tap for standard button clicks, tab switches, toggles
   */
  tap: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {}
    }
  },

  /**
   * Selection or item tap
   */
  selection: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {}
    }
  },

  /**
   * Medium vibration for key actions like sending messages, posting stories/news/reels
   */
  medium: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(30);
      } catch {}
    }
  },

  /**
   * Success vibration pattern (double pulse) for completed uploads or saved items
   */
  success: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 40, 25]);
      } catch {}
    }
  },

  /**
   * Notification vibration pattern for incoming toasts or alerts
   */
  notification: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([30, 50, 30, 50, 20]);
      } catch {}
    }
  },

  /**
   * Error pattern
   */
  error: () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([50, 30, 50]);
      } catch {}
    }
  },
};

export function triggerHaptic(type: 'tap' | 'selection' | 'medium' | 'success' | 'notification' | 'error' | 'impactMedium' | 'light' = 'tap') {
  if (type === 'selection' || type === 'light') haptics.selection();
  else if (type === 'medium' || type === 'impactMedium') haptics.medium();
  else if (type === 'success') haptics.success();
  else if (type === 'notification') haptics.notification();
  else if (type === 'error') haptics.error();
  else haptics.tap();
}
