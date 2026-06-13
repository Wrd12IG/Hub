export interface Task {
  id: string;
  title: string;
  type: 'administrative' | 'creative' | 'analytical' | string;
}

/**
 * Suggests tasks based on the current time of day.
 * - Morning (< 12:00): Creative tasks
 * - Mid-day (12:00 - 15:00): Analytical tasks
 * - Afternoon (> 15:00): Administrative tasks
 */
export function suggestTasks(availableTasks: Task[], currentDate: Date = new Date()): Task[] {
  const hour = currentDate.getHours();
  
  let preferredType = '';
  
  if (hour < 12) {
    preferredType = 'creative';
  } else if (hour >= 12 && hour < 15) {
    preferredType = 'analytical';
  } else {
    preferredType = 'administrative';
  }

  // Sort tasks: preferred type first
  return [...availableTasks].sort((a, b) => {
    if (a.type === preferredType && b.type !== preferredType) return -1;
    if (a.type !== preferredType && b.type === preferredType) return 1;
    return 0;
  });
}
