/**
 * GET /api/clients/[id]/organic
 * Feed post organici aggregati (Facebook + Instagram)
 *
 * Se Meta non è configurato → { notConfigured: true } (NO dati finti).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken } from '@/lib/api-auth';
import { getFacebookPageData, getInstagramPageData } from '@/lib/meta-client';

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

    if (!tokenData?.accessToken) {
      return NextResponse.json(
        {
          posts: [],
          notConfigured: true,
          _meta: {
            source: 'empty',
            hint: 'Collega Meta nella scheda ⚙️ Setup API per vedere i post organici.',
          },
        },
        { status: 503 }
      );
    }

    if (!tokenData?.extra?.pageId) {
      return NextResponse.json(
        {
          posts: [],
          notConfigured: true,
          _meta: {
            source: 'empty',
            hint: 'Page ID mancante. Aggiungilo nella scheda ⚙️ Setup API.',
          },
        },
        { status: 503 }
      );
    }

    // Fetch reale dei post
    let posts: any[] = [];

    try {
      if (platform === 'all' || platform === 'facebook') {
        const fbData = await getFacebookPageData(clientId);
        const fbPosts = (fbData?.posts?.data || []).map((p: any) => ({
          id: p.id,
          platform: 'facebook',
          message: p.message || '',
          createdTime: p.created_time,
          permalink: p.permalink_url,
          likes: p.reactions?.summary?.total_count || 0,
          comments: p.comments?.summary?.total_count || 0,
          shares: p.shares?.count || 0,
          mediaType: p.attachments?.data?.[0]?.media_type,
        }));
        posts = [...posts, ...fbPosts];
      }

      if (platform === 'all' || platform === 'instagram') {
        const igData = await getInstagramPageData(clientId);
        const igPosts = (igData?.media?.data || []).map((p: any) => ({
          id: p.id,
          platform: 'instagram',
          message: p.caption || '',
          createdTime: p.timestamp,
          permalink: p.permalink,
          likes: p.like_count || 0,
          comments: p.comments_count || 0,
          shares: 0,
          mediaType: p.media_type,
          mediaUrl: p.media_url,
        }));
        posts = [...posts, ...igPosts];
      }
    } catch (fetchError: any) {
      console.error(`[organic] Fetch error for client ${clientId}:`, fetchError.message);
    }

    // Ordina per data decrescente
    posts.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    return NextResponse.json({
      posts,
      _meta: { source: 'live', count: posts.length },
    });
  } catch (error: any) {
    console.error(`[organic] Error for client ${clientId}:`, error);
    return NextResponse.json(
      { posts: [], error: String(error), notConfigured: false },
      { status: 500 }
    );
  }
}
