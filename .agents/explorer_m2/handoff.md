# Handoff Report — Explorer 2 (Milestone 2: M2_PERMISSIONS_SECURITY_AUDIT)

## 1. Observation
Direct, evidence-backed findings from investigating `/Volumes/WEB_DEV/hub-wrdigital/hub-app`:

- **Missing Server-Side Middleware**: No `middleware.ts` exists in `/Volumes/WEB_DEV/hub-wrdigital/hub-app/`. Route protection relies solely on `app/(app)/layout.tsx` lines 38-42 which only checks `!currentUser` (redirecting unauthenticated users to `/login`), but enforces **no role checks** (`Amministratore`, `Collaboratore`, `Cliente`, `Guest`).
- **Unprotected Admin Pages**:
  - `app/(app)/admin/page.tsx`: Lacks role check. Non-admin users can access user management, role permissions, company costs (`AdminCompanyCosts`), and automations by navigating directly to `/admin`.
  - `app/(app)/admin/dashboard/page.tsx`: Line 301 computes `const isAccessDenied = !isLoadingLayout && currentUser && currentUser.role !== 'Amministratore';` but line comment states *"check viene applicato nel JSX sottostante"*. A search for `isAccessDenied` across the file confirms it is **never used** anywhere in the JSX or rendering logic. Financial charts, hourly rates, client profitability, and team metrics are fully rendered.
  - `app/(app)/admin/recurring-projects/page.tsx` & `app/(app)/admin/recurring-tasks/page.tsx`: Lacks page-level role check.
- **Global Real-Time Listener Data Leakage**:
  - `app/(app)/layout-context.tsx` lines 319-346 initiates `onSnapshot` subscriptions on 12 collections (`users`, `clients`, `projects`, `tasks`, `absences`, `activityTypes`, `calendarActivities`, `calendarActivityPresets`, `briefServices`, `briefServiceCategories`, `serviceContracts`, `rolePermissions`) for **any authenticated user**.
  - All documents including sensitive user fields (`salary`, `hourlyRate`), client budgets, service contracts, and all client tasks are downloaded into the browser React state (`currentUser`, `users`, `clients`, `allProjects`, `allTasks`, `serviceContracts`).
  - Client and collaborator roles only filter this data in client component memory (e.g. `projects-content.tsx` lines 239-259). Any client user can view full database contents via DevTools.
- **Missing `firestore.rules`**:
  - Only `firestore.indexes.json` exists in the repository. No `firestore.rules` file is tracked or present. If Firestore rules in Firebase Console allow authenticated reads/writes (`request.auth != null`), any client can execute arbitrary CRUD operations using `lib/actions.ts` client SDK calls.
- **Unauthenticated & Unchecked API Routes**:
  - `app/api/publish-zapier/route.ts` lines 4-12 does not call `verifyAuth(request)`. Anyone can issue HTTP POST requests to trigger Zapier webhooks and update editorial status to `Pubblicato`.
  - `app/api/clients/[id]/route.ts`: Does not enforce client ID isolation matching `user.clientId` for `Cliente` role on `GET`, `PUT`, `PATCH`, or `DELETE`.

## 2. Logic Chain
1. **Observation**: `app/(app)/layout.tsx` only validates authentication (`!currentUser`) -> **Inference**: Any logged-in user can request any valid app route.
2. **Observation**: Admin pages (`/admin`, `/admin/dashboard`, `/admin/recurring-projects`, `/admin/recurring-tasks`, `/clients`) lack role checks -> **Inference**: URL navigation bypasses UI menu hiding (Security through Obscurity).
3. **Observation**: `app/(app)/layout-context.tsx` attaches `onSnapshot` listeners to 12 top-level collections for all authenticated users -> **Inference**: All tenant data, financial data, and user salaries are sent over WebChannel to every logged-in client browser.
4. **Observation**: `app/api/publish-zapier/route.ts` omits `verifyAuth` -> **Inference**: Unauthenticated external callers can mutate DB state and fire webhooks.

## 3. Caveats
- Firebase Console rules (`firestore.rules` deployed on GCP/Firebase) could not be read directly from local files since no `firestore.rules` file exists in the git repository.
- Investigation was read-only as required. No code changes were applied to `hub-app`.

## 4. Conclusion
The RBAC and data security boundary architecture currently suffers from critical vulnerabilities:
1. **Critical Data Leakage (SEC-01)**: Global `onSnapshot` listeners over-fetch all application data (including `salary`, `hourlyRate`, budget, all client tasks/projects) to every authenticated user's browser.
2. **Unauthenticated API Endpoint (SEC-02)**: `/api/publish-zapier` is publicly accessible.
3. **Missing Route Guards (SEC-03, SEC-04, SEC-05)**: `/admin`, `/admin/dashboard`, `/admin/recurring-projects`, `/admin/recurring-tasks`, and `/clients` lack server or client-side route guards.
4. **Missing Repository `firestore.rules` (SEC-06)**.

The full detailed report, permission matrix, and recommendations have been written to `/Volumes/WEB_DEV/hub-wrdigital/hub-app/.agents/explorer_m2/M2_PERMISSIONS_SECURITY_AUDIT.md`.

## 5. Verification Method
1. Inspect `/Volumes/WEB_DEV/hub-wrdigital/hub-app/.agents/explorer_m2/M2_PERMISSIONS_SECURITY_AUDIT.md`.
2. Inspect `app/(app)/layout-context.tsx` lines 319-346 to verify `onSnapshot` subscriptions.
3. Inspect `app/(app)/admin/dashboard/page.tsx` line 301 to verify un-enforced `isAccessDenied`.
4. Inspect `app/api/publish-zapier/route.ts` lines 4-12 to verify missing `verifyAuth`.
