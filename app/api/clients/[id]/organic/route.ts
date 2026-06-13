/**
 * GET /api/clients/[id]/organic
 * Feed post organici aggregati (Facebook + Instagram)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken } from '@/lib/api-auth';
import { getPageInsights } from '@/lib/meta-client';

function buildMockPosts(clientId: string) {
  return [];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  const platform = request.nextUrl.searchParams.get('platform') || 'all';

  try {
    const tokenData = await getClientToken(clientId, 'meta');

    if (!tokenData?.accessToken || !tokenData?.extra?.pageId) {
      return NextResponse.json({
        posts: buildMockPosts(clientId),
        _meta: { source: 'mock' },
      });
    }

    // TODO: Implement real organic posts fetch
    // GET /{page-id}/posts?fields=id,message,created_time,attachments,insights
    return NextResponse.json({
      posts: buildMockPosts(clientId),
      _meta: { source: 'mock', reason: 'Real organic feed coming soon' },
    });
  } catch (error) {
    console.error(`[organic] Error for client ${clientId}:`, error);
    return NextResponse.json({ posts: [], error: String(error) }, { status: 500 });
  }
}
