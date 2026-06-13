import React from 'react';

export const MetricoolCard = ({ 
  title, 
  value, 
  variant = 'blue', 
  icon: Icon, 
  size = 'md',
  trend,
  className = '' 
}: { 
  title: string;
  value: number | string;
  variant?: 'blue' | 'orange' | 'green' | 'pink' | 'purple' | 'gray';
  icon?: any;
  size?: 'sm' | 'md';
  trend?: { value: number; isPositive: boolean };
  className?: string;
}) => {
  const colorMap = {
    blue: { bg: '#eef2ff', text: '#4f46e5', icon: '#818cf8', border: '#e0e7ff' },
    orange: { bg: '#fff7ed', text: '#ea580c', icon: '#fb923c', border: '#ffedd5' },
    green: { bg: '#f0fdf4', text: '#16a34a', icon: '#4ade80', border: '#dcfce7' },
    pink: { bg: '#fdf2f8', text: '#db2777', icon: '#f472b6', border: '#fce7f3' },
    purple: { bg: '#faf5ff', text: '#9333ea', icon: '#c084fc', border: '#f3e8ff' },
    gray: { bg: '#f9fafb', text: '#374151', icon: '#9ca3af', border: '#f3f4f6' }
  };
  
  const colors = colorMap[variant] || colorMap.blue;

  const formatNumber = (num: number | string) => {
    if (typeof num === 'string') return num;
    if (num === 0 || !num) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
    return num.toLocaleString('it-IT', { maximumFractionDigits: 2 });
  };

  return (
    <div className={`flex flex-col justify-center border rounded-xl p-4 ${className}`} style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: colors.text }}>
          {title}
        </div>
        {Icon && <Icon size={16} style={{ color: colors.icon }} />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`${size === 'sm' ? 'text-xl' : 'text-3xl'} font-bold`} style={{ color: colors.text }}>
          {formatNumber(value)}
        </span>
        {trend && (
          <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );
};
