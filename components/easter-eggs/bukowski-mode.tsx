'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beer, Cigarette, BookOpen, Sparkles } from 'lucide-react';

interface BukowskiModeProps {
    active: boolean;
    onClose?: () => void;
}

export function BukowskiMode({ active, onClose }: BukowskiModeProps) {
    const [showActivation, setShowActivation] = useState(false);

    useEffect(() => {
        if (active) {
            setShowActivation(true);

            // Applica il tema Bukowski al body
            document.body.classList.add('bukowski-mode');

            // Mostra l'animazione di attivazione per 3 secondi
            const timer = setTimeout(() => {
                setShowActivation(false);
            }, 3000);

            return () => {
                clearTimeout(timer);
            };
        } else {
            document.body.classList.remove('bukowski-mode');
        }
    }, [active]);

    if (!active) return null;

    return (
        <>
            {/* Animazione di attivazione */}
            <AnimatePresence>
                {showActivation && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
                    >
                        <div className="text-center space-y-6">
                            {/* Icone animate */}
                            <div className="flex items-center justify-center gap-8">
                                <motion.div
                                    animate={{
                                        rotate: [0, 10, -10, 0],
                                        y: [0, -10, 0]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <Beer className="w-16 h-16 text-amber-500" />
                                </motion.div>

                                <motion.div
                                    animate={{
                                        rotate: [0, -5, 5, 0],
                                        scale: [1, 1.1, 1]
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <BookOpen className="w-20 h-20 text-red-500" />
                                </motion.div>

                                <motion.div
                                    animate={{
                                        rotate: [0, 15, -15, 0],
                                        y: [0, -5, 0]
                                    }}
                                    transition={{
                                        duration: 1.8,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <Cigarette className="w-14 h-14 text-gray-400" />
                                </motion.div>
                            </div>

                            {/* Testo principale */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="space-y-4"
                            >
                                <h1 className="text-6xl font-bold text-red-500 tracking-wider font-mono">
                                    BUKOWSKI MODE
                                </h1>
                                <p className="text-2xl text-gray-300 italic max-w-2xl mx-auto">
                                    "Trova ciò che ami e lascia che ti uccida"
                                </p>
                            </motion.div>

                            {/* Particelle sparkle */}
                            <div className="absolute inset-0 pointer-events-none">
                                {[...Array(20)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{
                                            opacity: 0,
                                            x: Math.random() * window.innerWidth,
                                            y: Math.random() * window.innerHeight,
                                            scale: 0
                                        }}
                                        animate={{
                                            opacity: [0, 1, 0],
                                            scale: [0, 1, 0],
                                            rotate: 360
                                        }}
                                        transition={{
                                            duration: 2,
                                            delay: Math.random() * 2,
                                            repeat: Infinity,
                                            repeatDelay: Math.random() * 3
                                        }}
                                        className="absolute"
                                    >
                                        <Sparkles className="w-6 h-6 text-red-400" />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Indicatore permanente modalità attiva */}
            {!showActivation && (
                <motion.div
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="fixed bottom-4 right-4 z-50"
                >
                    <div className="bg-gradient-to-r from-red-900 to-red-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border border-red-500">
                        <Beer className="w-5 h-5" />
                        <span className="font-mono text-sm">Bukowski Mode Active</span>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="ml-2 hover:bg-red-800 rounded px-2 py-1 transition-colors"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Stili CSS per la modalità Bukowski */}
            <style jsx global>{`
        .bukowski-mode {
          /* Filtro seppia leggero per effetto vintage */
          filter: contrast(1.1) saturate(0.9);
        }
        
        .bukowski-mode * {
          /* Font più grezza e typewriter-style dove possibile */
          letter-spacing: 0.02em;
        }
        
        /* Effetto scanline sottile */
        .bukowski-mode::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.05),
            rgba(0, 0, 0, 0.05) 1px,
            transparent 1px,
            transparent 2px
          );
          pointer-events: none;
          z-index: 9998;
        }
        
        /* Accent color rosso per elementi interattivi */
        .bukowski-mode button:hover,
        .bukowski-mode a:hover {
          color: #ef4444 !important;
        }
      `}</style>
        </>
    );
}

/**
 * Componente per confetti quando si completa un task in Bukowski Mode
 */
export function BukowskiConfetti() {
    const [show, setShow] = useState(false);

    const triggerConfetti = () => {
        setShow(true);
        setTimeout(() => setShow(false), 3000);
    };

    useEffect(() => {
        // Listener per evento custom
        const handleTaskComplete = () => {
            if (document.body.classList.contains('bukowski-mode')) {
                triggerConfetti();
            }
        };

        window.addEventListener('taskCompleted', handleTaskComplete);
        return () => window.removeEventListener('taskCompleted', handleTaskComplete);
    }, []);

    if (!show) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
            {[...Array(30)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        x: Math.random() * window.innerWidth,
                        y: -20,
                        rotate: 0,
                        opacity: 1
                    }}
                    animate={{
                        y: window.innerHeight + 20,
                        rotate: Math.random() * 720 - 360,
                        opacity: 0
                    }}
                    transition={{
                        duration: 2 + Math.random() * 2,
                        ease: "easeIn"
                    }}
                    className="absolute"
                >
                    {/* Emoji casuali a tema Bukowski */}
                    <span className="text-4xl">
                        {['🍺', '📚', '🚬', '✍️', '🎭', '💀'][Math.floor(Math.random() * 6)]}
                    </span>
                </motion.div>
            ))}
        </div>
    );
}
