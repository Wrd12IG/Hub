import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

/**
 * Edge-safe verification of the Firebase ID token stored in the `fb_session`
 * httpOnly cookie (set by app/api/auth/session/route.ts).
 *
 * IMPORTANT — this used to check a `hub_user_role`/`user_role` cookie that was
 * NEVER set anywhere in the codebase, so `userRole` was always `undefined` and
 * every request to /admin/* and /clients/* silently fell through to
 * `NextResponse.next()`. It looked like a route guard but protected nothing.
 *
 * This version verifies the token's signature against Google's public keys and
 * checks issuer/audience/expiry, so it actually proves the request comes from a
 * signed-in Firebase user before letting it through — and fails closed (redirect
 * to /login) on anything missing or invalid.
 *
 * Note on scope: this enforces AUTHENTICATION at the edge (you must be a real,
 * logged-in user). It does not itself enforce the per-role AUTHORIZATION
 * (Amministratore vs Cliente) — the Firebase ID token doesn't carry a role claim
 * today, and stamping one on would mean finding & touching every place a user's
 * role is written. That per-role check must keep happening where it already
 * correctly does: server API routes via `verifyAuth` + a Firestore role lookup,
 * and — once added — `firestore.rules`. Treat this middleware as the first gate,
 * not the only one.
 */

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URL));
  return jwks;
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('fb_session')?.value;
  if (!token || !FIREBASE_PROJECT_ID) return false;

  try {
    await jwtVerify(token, getJwks(), {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    return true;
  } catch (err) {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isAdminRoute = path.startsWith('/admin');
  const isClientsRoute = path.startsWith('/clients');

  if (isAdminRoute || isClientsRoute) {
    const authed = await isAuthenticated(request);
    if (!authed) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/clients/:path*',
  ],
};
