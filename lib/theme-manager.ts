export type AppTheme = 'system' | 'light' | 'dark' | 'cyber' | 'retro';

export class ThemeManager {
  private currentTheme: AppTheme;

  constructor(defaultTheme: AppTheme = 'system') {
    this.currentTheme = defaultTheme;
    this.applyTheme(this.currentTheme);
  }

  public getCurrentTheme(): AppTheme {
    return this.currentTheme;
  }

  public setTheme(theme: AppTheme): void {
    this.currentTheme = theme;
    this.applyTheme(theme);
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Reset base classes
    root.classList.remove('light', 'dark');

    if (theme === 'light') {
      root.classList.add('light');
    } else if (theme === 'dark') {
      root.classList.add('dark');
    }

    // Always update data-theme attribute for other custom themes
    root.setAttribute('data-theme', theme);
  }
}
