import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Detects user inactivity. Returns { isIdle, resetIdle }.
 * @param timeoutMinutes - minutes of inactivity before marking as idle
 */
export function useIdleDetection(timeoutMinutes: number) {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetIdle = useCallback(() => {
    setIsIdle(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIsIdle(true), timeoutMinutes * 60 * 1000)
  }, [timeoutMinutes])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']

    const handleActivity = () => resetIdle()

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }))

    // Start the initial timer
    timerRef.current = setTimeout(() => setIsIdle(true), timeoutMinutes * 60 * 1000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetIdle])

  return { isIdle, resetIdle }
}
