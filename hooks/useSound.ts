import { useCallback } from 'react';
import { playSound, playSoundSync, SoundType } from '@/lib/sounds';

/**
 * Hook per riprodurre suoni in modo semplice nei componenti React
 */
export function useSound() {
    const play = useCallback((type: SoundType, volume?: number) => {
        playSound(type, volume);
    }, []);

    const playSync = useCallback((type: SoundType, volume?: number) => {
        playSoundSync(type, volume ?? 0.5);
    }, []);

    return { play, playSync };
}

/**
 * Hook specifico per suoni di notifica task
 */
export function useTaskSounds() {
    const { play } = useSound();

    const onTaskCompleted = useCallback(() => {
        play('task_completed', 0.6);
        // Trigger evento custom per confetti (se in Bukowski mode)
        window.dispatchEvent(new Event('taskCompleted'));
    }, [play]);

    const onTaskAssigned = useCallback(() => {
        play('task_assigned', 0.5);
    }, [play]);

    const onTaskApprovalRequested = useCallback(() => {
        play('task_approval_requested', 0.7);
    }, [play]);

    const onTaskApproved = useCallback(() => {
        play('task_approval', 0.6);
    }, [play]);

    const onTaskRejected = useCallback(() => {
        play('task_rejected', 0.5);
    }, [play]);

    const onDeadlineWarning = useCallback(() => {
        play('deadline_warning', 0.8);
    }, [play]);

    return {
        onTaskCompleted,
        onTaskAssigned,
        onTaskApprovalRequested,
        onTaskApproved,
        onTaskRejected,
        onDeadlineWarning,
    };
}

/**
 * Hook per suoni di chat/messaggi
 */
export function useChatSounds() {
    const { play } = useSound();

    const onNewMessage = useCallback(() => {
        play('message', 0.4);
    }, [play]);

    const onNewComment = useCallback(() => {
        play('new_comment', 0.5);
    }, [play]);

    return {
        onNewMessage,
        onNewComment,
    };
}

/**
 * Hook per suoni di gamification
 */
export function useGamificationSounds() {
    const { play } = useSound();

    const onAchievement = useCallback(() => {
        play('achievement', 0.7);
    }, [play]);

    const onLevelUp = useCallback(() => {
        play('level_up', 0.8);
    }, [play]);

    return {
        onAchievement,
        onLevelUp,
    };
}

/**
 * Hook per suoni generici
 */
export function useGeneralSounds() {
    const { play } = useSound();

    const onSuccess = useCallback(() => {
        play('success', 0.5);
    }, [play]);

    const onError = useCallback(() => {
        play('error', 0.6);
    }, [play]);

    const onNotification = useCallback(() => {
        play('notification', 0.5);
    }, [play]);

    return {
        onSuccess,
        onError,
        onNotification,
    };
}
