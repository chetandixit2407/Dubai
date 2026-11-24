# WHITE COLLAR REALTY — Security Specification & Eight Pillars Audit

## 1. Data Invariants

1. **Identity & Role Integrity**: Users registering in `/users/{userId}` can only create their own profile (`userId == request.auth.uid`) with `role == 'customer'` (unless they are the verified bootstrapped Super Admin `chetandixit9968@gmail.com`). Users cannot escalate their own `role` during updates.
2. **Public Catalog vs. PII Isolation**: `/projects`, `/developers`, and `/inventoryLogs` contain zero PII and allow public read access. All PII collections (`/users`, `/enquiries`, `/syncProviders`, `/adminLogs`, `favorites`, `savedSearches`) strictly isolate read access to the owning user (`userId == request.auth.uid`) or verified staff/admin.
3. **Verified Email Mandate**: All authenticated mutations require `request.auth.token.email_verified == true`.
4. **Strict Payload Boundaries**: Every `create` validates exact required and allowed keys (`hasAll` + `hasOnly`), string length bounds, numeric ranges, and valid enum states. Every `update` validates `isValid[Entity](incoming())` and `affectedKeys().hasOnly(...)`.
5. **Immutable Audit & Ownership Fields**: `userId`, `createdAt`, `actorUid` cannot be altered after creation. Timestamps on client writes match `request.time` or validated ISO bounds.
6. **Admin & Staff Separation**:
   - `super_admin` / `admin`: Full project, developer, sync provider, enquiry assignment, and role management.
   - `inventory_manager`: Project inventory updates, sync provider triggers, and inventory audit logs.
   - `sales_agent`: Read and update status/notes on enquiries.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Self-Role Escalation**: `POST /users/{uid}` with `{ uid, email, role: 'super_admin' }` by a non-admin user -> `PERMISSION_DENIED`.
2. **Profile Role Tampering on Update**: `PATCH /users/{uid}` updating `role` from `'customer'` to `'admin'` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Project Create**: Creating a project with an unapproved field `{ ..., isSystemOverride: true }` -> `PERMISSION_DENIED`.
4. **Email Spoofing (Unverified Email)**: Authenticated token with `email: 'chetandixit9968@gmail.com'` and `email_verified: false` attempting admin write -> `PERMISSION_DENIED`.
5. **Cross-Tenant Favourite Creation**: Creating `/users/otherUid/favorites/proj-1` while signed in as `attackerUid` -> `PERMISSION_DENIED`.
6. **Cross-Tenant Enquiry Read (`get`)**: Reading `/enquiries/enq-1` belonging to another user as a `'customer'` -> `PERMISSION_DENIED`.
7. **Blanket Enquiry Scraping (`list`)**: Listing `/enquiries` without matching `userId == request.auth.uid` as a `'customer'` -> `PERMISSION_DENIED`.
8. **ID Poisoning Attack**: Writing to `/projects/` with a 500-character or special-character document ID (`../admin`) -> `PERMISSION_DENIED`.
9. **Resource Exhaustion (1MB String)**: Submitting an enquiry with a `message` exceeding 2,000 characters -> `PERMISSION_DENIED`.
10. **Enquiry Status Shortcutting by Customer**: Customer updating their enquiry `status` directly to `'closed'` or changing `assignedAgentName` -> `PERMISSION_DENIED`.
11. **Unauthorized Sync Provider Tampering**: Non-admin user creating or disabling `/syncProviders/{providerId}` -> `PERMISSION_DENIED`.
12. **Audit Log Deletion / Tampering**: Attempting to update or delete an immutable `/inventoryLogs/{logId}` or `/adminLogs/{logId}` entry -> `PERMISSION_DENIED`.
