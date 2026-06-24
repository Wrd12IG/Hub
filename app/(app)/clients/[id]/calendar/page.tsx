import { EditorialPlanPageContent } from '@/app/(app)/editorial-plan/client';

export default function ClientCalendarPage({ params }: { params: { id: string } }) {
    return <EditorialPlanPageContent forcedClientId={params.id} />;
}
