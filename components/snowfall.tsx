'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import './snowfall.css';

const Snowfall = () => {
  const [isSnowing, setIsSnowing] = useState(false);

  useEffect(() => {
    const checkDateAndTriggerSnow = () => {
      const now = new Date();
      const month = now.getMonth(); // 0-11 (December is 11)
      const day = now.getDate();

      // Check if it's between December 8th and December 25th
      const isChristmasSeason = month === 11 && day >= 8 && day <= 25;

      if (isChristmasSeason) {
        // Trigger snow immediately on load during the season
        setIsSnowing(true);
        setTimeout(() => setIsSnowing(false), 10000); // 10 seconds

        // Set up the interval to trigger snow every hour
        const intervalId = setInterval(() => {
          setIsSnowing(true);
          setTimeout(() => setIsSnowing(false), 10000); // Snow for 10 seconds
        }, 60 * 60 * 1000); // 1 hour

        return () => clearInterval(intervalId);
      }
    };

    const cleanupSnowLoop = checkDateAndTriggerSnow();

    // Set up a daily check in case the user keeps the app open across midnight
    const dailyCheckInterval = setInterval(checkDateAndTriggerSnow, 24 * 60 * 60 * 1000);

    return () => {
      if (cleanupSnowLoop) {
        cleanupSnowLoop();
      }
      clearInterval(dailyCheckInterval);
    };
  }, []);

  if (!isSnowing) {
    return null;
  }

  return (
    <div className="snowfall-container">
      {/* Create 50 snowflakes */}
      {Array.from({ length: 50 }).map((_, i) => (
        <div key={i} className="snowflake"></div>
      ))}
    </div>
  );
};

export default Snowfall;
