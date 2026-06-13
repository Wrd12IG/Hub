type SpringVariant = 'bouncy' | 'smooth' | 'snappy';

export function getSpringConfig(variant: SpringVariant = 'smooth') {
  switch (variant) {
    case 'bouncy':
      return { type: 'spring', stiffness: 300, damping: 10 };
    case 'snappy':
      return { type: 'spring', stiffness: 400, damping: 25 };
    case 'smooth':
    default:
      return { type: 'spring', stiffness: 200, damping: 20 };
  }
}

export function getStaggerDelay(index: number, baseDelay: number = 0.1): number {
  return Number((index * baseDelay).toFixed(2));
}
