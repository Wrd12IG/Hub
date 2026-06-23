import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { contentId, type, clientId } = body;

        if (!contentId) {
            return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
        }

        const webhookUrl = process.env.ZAPIER_EDITORIAL_WEBHOOK_URL;

        if (!webhookUrl) {
            console.error('ZAPIER_EDITORIAL_WEBHOOK_URL is not configured');
            return NextResponse.json({ error: 'Zapier Webhook is not configured' }, { status: 500 });
        }

        let contentRef;
        if (type === 'organic' && clientId) {
            contentRef = adminDb.collection('clients').doc(clientId).collection('organicPosts').doc(contentId);
        } else {
            contentRef = adminDb.collection('editorialContents').doc(contentId);
        }
        
        const contentSnap = await contentRef.get();

        if (!contentSnap.exists) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        const contentData = contentSnap.data();

        // Send data to Zapier
        const zapierPayload = {
            id: contentSnap.id,
            ...contentData,
            // Convert timestamps if necessary
            createdAt: contentData?.createdAt?.toDate ? contentData.createdAt.toDate().toISOString() : contentData?.createdAt,
            updatedAt: contentData?.updatedAt?.toDate ? contentData.updatedAt.toDate().toISOString() : contentData?.updatedAt,
            // Ensure type is clear in the payload
            sourceType: type === 'organic' ? 'organic' : 'editorial'
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(zapierPayload),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Zapier error:', errText);
            return NextResponse.json({ error: 'Failed to send data to Zapier' }, { status: response.status });
        }

        // Update the content status to "PUBLISHED" or "Pubblicato"
        await contentRef.update({
            status: type === 'organic' ? 'PUBLISHED' : 'Pubblicato',
            updatedAt: new Date(),
        });

        return NextResponse.json({ success: true, message: 'Content published to Zapier' });
    } catch (error) {
        console.error('Error in publish-zapier API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
