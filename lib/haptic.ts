export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error';

export function triggerHaptic(type: HapticType = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  switch (type) {
    case 'light':
      navigator.vibrate(50);
      break;
    case 'medium':
      navigator.vibrate(100);
      break;
    case 'heavy':
      navigator.vibrate(200);
      break;
    case 'success':
      navigator.vibrate([50, 100, 50]);
      break;
    case 'error':
      navigator.vibrate([100, 50, 100, 50, 100]);
      break;
  }
}
