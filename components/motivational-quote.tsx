'use client';

import { useState, useEffect } from 'react';
import { motivationalQuotes } from '@/lib/quotes';
import { cn } from '@/lib/utils';
import { Rocket } from 'lucide-react';

const MIN_INTERVAL = 2 * 60 * 1000; // 2 minuti
const MAX_INTERVAL = 5 * 60 * 1000; // 5 minuti
const VISIBLE_DURATION = 5000; // 5 secondi

export default function MotivationalQuote() {
  const [quote, setQuote] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    let timerId: NodeJS.Timeout;

    const showRandomQuote = () => {
      // Scegli una frase a caso
      const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
      setQuote(motivationalQuotes[randomIndex]);
      setIsVisible(true);

      // Imposta il timer per nascondere la frase
      setTimeout(() => {
        setIsVisible(false);
        // Dopo che la frase è scomparsa, imposta il prossimo timer per mostrarne una nuova
        scheduleNextQuote();
      }, VISIBLE_DURATION);
    };

    const scheduleNextQuote = () => {
      // Calcola un intervallo casuale
      const randomInterval = Math.random() * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL;
      timerId = setTimeout(showRandomQuote, randomInterval);
    };

    // Avvia il ciclo
    scheduleNextQuote();

    // Pulisci il timer quando il componente viene smontato
    return () => clearTimeout(timerId);
  }, [isMounted]);

  return (
    <div
      className={cn(
        'fixed bottom-8 right-8 z-[200] max-w-sm rounded-xl border-2 border-primary/30 bg-background/80 p-6 shadow-2xl backdrop-blur-sm transition-all duration-700',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <Rocket className="absolute -top-4 -left-4 h-8 w-8 text-primary/70" />
      <p className="text-lg font-semibold italic text-foreground">
        "{quote}"
      </p>
    </div>
  );
}
