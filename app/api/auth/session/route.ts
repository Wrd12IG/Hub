/**
 * app/api/auth/session/route.ts
 *
 * Establishes/clears the httpOnly session cookie that `middleware.ts` relies on
 * to gate `/admin/*` and `/clients/*` at the edge.
 *
 * The client (see the `onIdTokenChanged` listener in `app/(app)/layout-context.tsx`)
 * calls POST here whenever it obtains a fresh Firebase ID token (on login, and on
 * every silent token refresh), and DELETE on logout. The ID token itself is
 * verified with firebase-admin before being stored, so a forged/expired token is
 * rejected here rather than trusted blindly.
 */

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

const SESSION_COOKIE = 'fb_session';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    // Verify before trusting it — never store a token we haven't checked.
    const decoded = await adminAuth.verifyIdToken(idToken);

    const res = NextResponse.json({ ok: true });
    const maxAge = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
    res.cookies.set(SESSION_COOKIE, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    return res;
  } catch (err: any) {
    console.error('[api/auth/session] Failed to establish session:', err.message);
    return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
