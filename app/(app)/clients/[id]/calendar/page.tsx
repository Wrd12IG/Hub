import { EditorialPlanPageContent } from '@/app/(app)/editorial-plan/client';

/**
 * /clients/[id]/calendar
 * Vista piano editoriale filtrata per questo cliente, con layout calendario.
 * La forceView='calendar' apre direttamente la vista calendario del piano editoriale.
 */
export default function ClientCalendarPage({ params }: { params: { id: string } }) {
    return <EditorialPlanPageContent forcedClientId={params.id} forceView="calendar" />;
}
