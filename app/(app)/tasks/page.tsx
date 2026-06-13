'use client'

import { Suspense } from 'react'
import { TasksPageContent } from './tasks-content'

export default function TasksPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TasksPageContent />
        </Suspense>
    )
}
