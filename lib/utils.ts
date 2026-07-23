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

const teamAvatarMap: Record<string, string> = {
  'giada': '/images/team/giada.jpg',
  'luca': '/images/team/luca.jpg',
  'valentina': '/images/team/valentina.jpg',
  'roberto': '/images/team/roberto.jpg',
  'giuseppe': '/images/team/beppe.jpg',
  'beppe': '/images/team/beppe.jpg',
  'lorenzo': '/images/team/lorenzo.jpg',
  'eleonora': '/images/team/eleonora.jpg',
  'enxhi': '/images/team/enxhi.jpg',
  'giulia': '/images/team/giulia.jpg',
  'rebecca': '/images/team/rebecca.jpg',
  'valeria messinese': '/images/team/valeria.jpg',
  'denise': '/images/team/denise.jpg',
};

export function getUserAvatar(user?: { avatar?: string; name?: string } | null): string | undefined {
  if (user?.avatar) return user.avatar;
  if (!user?.name) return undefined;
  const lowerName = user.name.toLowerCase();

  // Valeria Daniotti does not have a photo yet (distinct from Valeria Messinese)
  if (lowerName.includes('valeria daniotti') || lowerName.includes('daniotti')) return undefined;

  // Exact / full name matches first
  if (lowerName.includes('valeria messinese') || lowerName.includes('messinese')) return '/images/team/valeria.jpg';

  for (const [key, path] of Object.entries(teamAvatarMap)) {
    if (lowerName.includes(key)) return path;
  }
  return undefined;
}
