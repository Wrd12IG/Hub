## 2026-07-28T09:35:56Z
<USER_REQUEST>
You are Explorer 2, responsible for Milestone 2: Verifica Architettura Permessi e Sicurezza dei Dati (R2) for the W[r]Digital Marketing HUB application located at /Volumes/WEB_DEV/hub-wrdigital/hub-app.

Your working directory is: /Volumes/WEB_DEV/hub-wrdigital/hub-app/.agents/explorer_m2

Task:
Audit role permission consistency and data security boundaries across the entire application codebase for four roles: Amministratore (Admin), Collaboratore (Collaborator), Cliente (Client), and Guest.

Specifically, check:
1. Route & Page Level Permissions: How routes are protected (middleware, layout guards, page checks). Are any administrative routes accessible to non-admin roles?
2. Navigation & Sidebar Permissions: Are sidebar items and navigation links correctly hidden/shown based on user role?
3. Action Components & Edit Forms: Are edit, delete, create, and configuration buttons/forms properly guarded by permission checks? Can a Client or Guest trigger an Admin/Collaborator action?
4. Data Fetching & Firestore Query Security: How Firestore queries and listeners filter data by role/client ID. Are client data boundaries enforced? Are there real-time listener leaks? Check firestore.indexes.json, firebase configs, security rules, and data access hooks.

Codebase paths to investigate:
- /Volumes/WEB_DEV/hub-wrdigital/hub-app/app
- /Volumes/WEB_DEV/hub-wrdigital/hub-app/components
- /Volumes/WEB_DEV/hub-wrdigital/hub-app/hooks (auth hooks, permission hooks, firestore hooks)
- /Volumes/WEB_DEV/hub-wrdigital/hub-app/lib (firebase, auth, permissions, middleware)

Deliverable:
Write your complete audit findings to /Volumes/WEB_DEV/hub-wrdigital/hub-app/.agents/explorer_m2/M2_PERMISSIONS_SECURITY_AUDIT.md.
The document must include:
- Role Permission Matrix across all modules and views.
- Detailed audit of Route Guards, Navigation Visibility, Form & Action Controls, and Firestore Data Access.
- Identification of any security flaws, permission inconsistencies, or missing checks with exact file paths and line numbers.
- Recommendations for strengthening role-based access control (RBAC) and data isolation.

Also update /Volumes/WEB_DEV/hub-wrdigital/hub-app/.agents/explorer_m2/progress.md and send a message back to parent when done.
</USER_REQUEST>
