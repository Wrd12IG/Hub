import { NextRequest, NextResponse } from 'next/server';
import {
    runScheduledAutomations,
    generateWeeklyReport,
    checkDueSoonTasks,
    checkOverdueTasks,
    checkStuckTasks
} from '@/lib/automation-engine';

// Secret key to protect the endpoint (set in environment variables)
const AUTOMATION_SECRET = process.env.AUTOMATION_SECRET || 'default-automation-key';

/**
 * POST /api/automations/run
 * 
 * Run scheduled automations. 
 * Can be called by:
 * - External cron job (e.g., GitHub Actions, Vercel Cron, Uptime Robot)
 * - Internal scheduler
 * 
 * Query params:
 * - type: 'all' | 'due_soon' | 'overdue' | 'stuck' | 'weekly_report'
 * 
 * Headers:
 * - x-automation-secret: Secret key for authentication
 */
export async function POST(request: NextRequest) {
    try {
        // Verify secret
        const secret = request.headers.get('x-automation-secret');
        if (secret !== AUTOMATION_SECRET) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type') || 'all';

        let result: any = {};

        switch (type) {
            case 'all':
                result = await runScheduledAutomations();
                break;
            case 'due_soon':
                result = await checkDueSoonTasks();
                break;
            case 'overdue':
                result = await checkOverdueTasks();
                break;
            case 'stuck':
                result = await checkStuckTasks();
                break;
            case 'weekly_report':
                result = await generateWeeklyReport();
                break;
            default:
                return NextResponse.json(
                    { error: `Unknown automation type: ${type}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            type,
            result,
            executedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error running automations:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/automations/run
 * 
 * Health check endpoint
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Automation endpoint is active. Use POST to run automations.',
        availableTypes: ['all', 'due_soon', 'overdue', 'stuck', 'weekly_report']
    });
}
