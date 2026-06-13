'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cake, PartyPopper, Gift, Sparkles } from 'lucide-react';
import { User } from '@/lib/data';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface BirthdayCelebrationProps {
    users: User[];
}

export function BirthdayCelebration({ users }: BirthdayCelebrationProps) {
    const [showCelebration, setShowCelebration] = useState(false);
    const [birthdayUsers, setBirthdayUsers] = useState<User[]>([]);

    useEffect(() => {
        // Trova utenti con compleanno oggi
        const today = new Date();
        const todayBirthdays = users.filter(user => {
            if (!user.birthDate) return false;

            try {
                const birthDate = parseISO(user.birthDate);
                const birthMonth = birthDate.getMonth();
                const birthDay = birthDate.getDate();

                return birthMonth === today.getMonth() && birthDay === today.getDate();
            } catch (e) {
                return false;
            }
        });

        if (todayBirthdays.length > 0) {
            setBirthdayUsers(todayBirthdays);
            setShowCelebration(true);

            // Nascondi dopo 10 secondi
            const timer = setTimeout(() => {
                setShowCelebration(false);
            }, 10000);

            return () => clearTimeout(timer);
        }
    }, [users]);

    if (birthdayUsers.length === 0) return null;

    return (
        <AnimatePresence>
            {showCelebration && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 50 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={() => setShowCelebration(false)}
                >
                    <motion.div
                        className="relative bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-8 rounded-3xl shadow-2xl max-w-2xl mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Palloncini animati */}
                        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                            {[...Array(15)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{
                                        x: Math.random() * 100 - 50 + '%',
                                        y: '120%',
                                        rotate: 0
                                    }}
                                    animate={{
                                        y: '-20%',
                                        rotate: Math.random() * 360 - 180,
                                        x: Math.random() * 100 - 50 + '%'
                                    }}
                                    transition={{
                                        duration: 3 + Math.random() * 2,
                                        delay: Math.random() * 2,
                                        repeat: Infinity,
                                        repeatDelay: Math.random() * 3
                                    }}
                                    className="absolute text-4xl"
                                >
                                    🎈
                                </motion.div>
                            ))}
                        </div>

                        {/* Contenuto */}
                        <div className="relative z-10 text-center space-y-6">
                            {/* Icone animate */}
                            <div className="flex items-center justify-center gap-6">
                                <motion.div
                                    animate={{
                                        rotate: [0, -10, 10, -10, 0],
                                        scale: [1, 1.1, 1]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <Cake className="w-20 h-20 text-yellow-300" />
                                </motion.div>

                                <motion.div
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 5, -5, 0]
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <PartyPopper className="w-16 h-16 text-pink-300" />
                                </motion.div>

                                <motion.div
                                    animate={{
                                        y: [0, -10, 0],
                                        rotate: [0, 10, -10, 0]
                                    }}
                                    transition={{
                                        duration: 2.5,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    <Gift className="w-18 h-18 text-blue-300" />
                                </motion.div>
                            </div>

                            {/* Testo */}
                            <div className="space-y-4">
                                <motion.h1
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", bounce: 0.5 }}
                                    className="text-6xl font-bold text-white drop-shadow-lg"
                                >
                                    🎉 Buon Compleanno! 🎉
                                </motion.h1>

                                <div className="space-y-2">
                                    {birthdayUsers.map((user, index) => (
                                        <motion.div
                                            key={user.id}
                                            initial={{ opacity: 0, x: -50 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.3 + index * 0.2 }}
                                            className="text-3xl font-semibold text-white drop-shadow-md"
                                        >
                                            {user.name}
                                        </motion.div>
                                    ))}
                                </div>

                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.8 }}
                                    className="text-xl text-white/90 max-w-md mx-auto"
                                >
                                    Che questo sia un anno pieno di successi, gioia e nuove avventure! 🎊
                                </motion.p>
                            </div>

                            {/* Pulsante chiudi */}
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                                onClick={() => setShowCelebration(false)}
                                className="mt-6 px-8 py-3 bg-white text-purple-600 rounded-full font-semibold hover:bg-purple-50 transition-colors shadow-lg"
                            >
                                Grazie! 💝
                            </motion.button>
                        </div>

                        {/* Confetti */}
                        <div className="absolute inset-0 pointer-events-none">
                            {[...Array(50)].map((_, i) => (
                                <motion.div
                                    key={`confetti-${i}`}
                                    initial={{
                                        x: '50%',
                                        y: '50%',
                                        rotate: 0,
                                        opacity: 1
                                    }}
                                    animate={{
                                        x: Math.random() * 200 - 100 + '%',
                                        y: Math.random() * 200 - 100 + '%',
                                        rotate: Math.random() * 720,
                                        opacity: 0
                                    }}
                                    transition={{
                                        duration: 2,
                                        delay: Math.random() * 0.5,
                                        repeat: Infinity,
                                        repeatDelay: 3
                                    }}
                                    className="absolute w-3 h-3 rounded-full"
                                    style={{
                                        backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94'][Math.floor(Math.random() * 5)]
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Widget per mostrare i prossimi compleanni nella dashboard
 */
export function UpcomingBirthdaysWidget({ users }: { users: User[] }) {
    const [upcomingBirthdays, setUpcomingBirthdays] = useState<Array<{ user: User; date: Date; daysUntil: number }>>([]);

    useEffect(() => {
        const today = new Date();
        const upcoming = users
            .filter(user => user.birthDate)
            .map(user => {
                const birthDate = parseISO(user.birthDate!);
                const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

                // Se il compleanno è già passato quest'anno, considera l'anno prossimo
                if (thisYearBirthday < today) {
                    thisYearBirthday.setFullYear(today.getFullYear() + 1);
                }

                const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                return {
                    user,
                    date: thisYearBirthday,
                    daysUntil
                };
            })
            .filter(item => item.daysUntil <= 30) // Prossimi 30 giorni
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .slice(0, 5); // Massimo 5

        setUpcomingBirthdays(upcoming);
    }, [users]);

    if (upcomingBirthdays.length === 0) return null;

    return (
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 p-4 rounded-lg border border-pink-200 dark:border-pink-800">
            <div className="flex items-center gap-2 mb-3">
                <Cake className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                <h3 className="font-semibold text-pink-900 dark:text-pink-100">Prossimi Compleanni</h3>
            </div>

            <div className="space-y-2">
                {upcomingBirthdays.map(({ user, date, daysUntil }) => (
                    <div
                        key={user.id}
                        className="flex items-center justify-between p-2 bg-white/50 dark:bg-black/20 rounded-md"
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                style={{ backgroundColor: user.color || '#4285F4' }}
                            >
                                {user.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-medium text-sm">{user.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {format(date, 'd MMMM', { locale: it })}
                                </p>
                            </div>
                        </div>

                        <div className="text-right">
                            {daysUntil === 0 && (
                                <span className="text-xs font-semibold text-pink-600 dark:text-pink-400">
                                    Oggi! 🎉
                                </span>
                            )}
                            {daysUntil === 1 && (
                                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                    Domani 🎂
                                </span>
                            )}
                            {daysUntil > 1 && (
                                <span className="text-xs text-muted-foreground">
                                    tra {daysUntil} giorni
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
