
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const names = name.split(' ');
  if (names.length > 1) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return name[0].toUpperCase();
}

/**
 * Sort an array of objects alphabetically by a string property
 * @param array - Array of objects to sort
 * @param key - Key to sort by (defaults to 'name')
 * @returns Sorted array (new array, doesn't mutate original)
 */
export function sortAlphabetically<T extends Record<string, any>>(
  array: T[],
  key: keyof T = 'name' as keyof T
): T[] {
  return [...array].sort((a, b) => {
    const aValue = String(a[key] || '').toLowerCase();
    const bValue = String(b[key] || '').toLowerCase();
    return aValue.localeCompare(bValue, 'it');
  });
}
