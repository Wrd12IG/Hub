'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatValue?: (value: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({
  value,
  duration = 1500,
  formatValue,
  className,
  prefix = '',
  suffix = ''
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    if (hasAnimated) {
      // For subsequent updates, animate from current to new
      const startValue = displayValue;
      const difference = value - startValue;
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (easeOutExpo)
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        const currentValue = startValue + difference * easeProgress;
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
      return;
    }
    
    // Initial animation with intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            
            const startTime = performance.now();
            const startValue = 0;
            
            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              
              // Easing function (easeOutExpo for smooth deceleration)
              const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
              
              const currentValue = startValue + value * easeProgress;
              setDisplayValue(currentValue);
              
              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };
            
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, [value, duration, hasAnimated]);
  
  const formattedValue = formatValue 
    ? formatValue(displayValue) 
    : Math.round(displayValue).toString();
  
  return (
    <span 
      ref={ref} 
      className={cn(
        "tabular-nums font-bold transition-all",
        className
      )}
    >
      {prefix}{formattedValue}{suffix}
    </span>
  );
}

// Specialized variants
export function AnimatedPercentage({ value, className, ...props }: Omit<AnimatedCounterProps, 'suffix'>) {
  return (
    <AnimatedCounter 
      value={value} 
      suffix="%" 
      className={className}
      {...props} 
    />
  );
}

export function AnimatedHours({ value, className, ...props }: Omit<AnimatedCounterProps, 'suffix' | 'formatValue'>) {
  return (
    <AnimatedCounter 
      value={value} 
      suffix="h" 
      formatValue={(v) => v.toFixed(1)}
      className={className}
      {...props} 
    />
  );
}
