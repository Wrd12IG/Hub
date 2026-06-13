'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

/**
 * Fade In Animation
 */
export function FadeIn({
    children,
    delay = 0,
    duration = 0.3
}: {
    children: ReactNode;
    delay?: number;
    duration?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration, delay }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Slide In Animation
 */
export function SlideIn({
    children,
    direction = 'up',
    delay = 0,
    duration = 0.3
}: {
    children: ReactNode;
    direction?: 'up' | 'down' | 'left' | 'right';
    delay?: number;
    duration?: number;
}) {
    const directions = {
        up: { y: 20 },
        down: { y: -20 },
        left: { x: 20 },
        right: { x: -20 },
    };

    return (
        <motion.div
            initial={{ ...directions[direction], opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ ...directions[direction], opacity: 0 }}
            transition={{ duration, delay }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Scale In Animation
 */
export function ScaleIn({
    children,
    delay = 0,
    duration = 0.2
}: {
    children: ReactNode;
    delay?: number;
    duration?: number;
}) {
    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration, delay }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Bounce In Animation
 */
export function BounceIn({
    children,
    delay = 0
}: {
    children: ReactNode;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
                type: 'spring',
                stiffness: 260,
                damping: 20,
                delay
            }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Stagger Children Animation
 */
export function StaggerChildren({
    children,
    staggerDelay = 0.1
}: {
    children: ReactNode;
    staggerDelay?: number;
}) {
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{
                visible: {
                    transition: {
                        staggerChildren: staggerDelay
                    }
                }
            }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Stagger Item (da usare con StaggerChildren)
 */
export function StaggerItem({ children }: { children: ReactNode }) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
            }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Hover Scale Animation
 */
export function HoverScale({
    children,
    scale = 1.05
}: {
    children: ReactNode;
    scale?: number;
}) {
    return (
        <motion.div
            whileHover={{ scale }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Hover Lift Animation
 */
export function HoverLift({ children }: { children: ReactNode }) {
    return (
        <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Shake Animation (per errori)
 */
export function Shake({
    children,
    trigger
}: {
    children: ReactNode;
    trigger: boolean;
}) {
    return (
        <motion.div
            animate={trigger ? {
                x: [0, -10, 10, -10, 10, 0],
                transition: { duration: 0.5 }
            } : {}}
        >
            {children}
        </motion.div>
    );
}

/**
 * Pulse Animation
 */
export function Pulse({
    children,
    duration = 2
}: {
    children: ReactNode;
    duration?: number;
}) {
    return (
        <motion.div
            animate={{
                scale: [1, 1.05, 1],
                opacity: [1, 0.8, 1]
            }}
            transition={{
                duration,
                repeat: Infinity,
                ease: 'easeInOut'
            }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Rotate Animation
 */
export function Rotate({
    children,
    duration = 2
}: {
    children: ReactNode;
    duration?: number;
}) {
    return (
        <motion.div
            animate={{ rotate: 360 }}
            transition={{
                duration,
                repeat: Infinity,
                ease: 'linear'
            }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Flip Animation
 */
export function Flip({
    children,
    isFlipped
}: {
    children: ReactNode;
    isFlipped: boolean;
}) {
    return (
        <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6 }}
            style={{ transformStyle: 'preserve-3d' }}
        >
            {children}
        </motion.div>
    );
}

/**
 * Expand/Collapse Animation
 */
export function ExpandCollapse({
    children,
    isExpanded
}: {
    children: ReactNode;
    isExpanded: boolean;
}) {
    return (
        <AnimatePresence initial={false}>
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: 'hidden' }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Number Counter Animation
 */
export function CountUp({
    from = 0,
    to,
    duration = 1
}: {
    from?: number;
    to: number;
    duration?: number;
}) {
    return (
        <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <motion.span
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ duration }}
            >
                {to}
            </motion.span>
        </motion.span>
    );
}

/**
 * Progress Bar Animation
 */
export function ProgressBar({
    progress,
    color = '#4285F4'
}: {
    progress: number;
    color?: string;
}) {
    return (
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            />
        </div>
    );
}

/**
 * Notification Toast Animation
 */
export function NotificationToast({
    children,
    isVisible,
    onClose
}: {
    children: ReactNode;
    isVisible: boolean;
    onClose: () => void;
}) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed top-4 right-4 z-50"
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Modal Animation
 */
export function ModalAnimation({
    children,
    isOpen
}: {
    children: ReactNode;
    isOpen: boolean;
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        {children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

/**
 * Page Transition
 */
export function PageTransition({ children }: { children: ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
        >
            {children}
        </motion.div>
    );
}
