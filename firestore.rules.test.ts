/**
 * Phase 0 Security Rules Verification Specification (Dirty Dozen)
 * Documents expected ALLOW / DENY outcomes across all WHITE COLLAR REALTY Firestore collections.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actorRole: 'anonymous' | 'customer' | 'sales_agent' | 'inventory_manager' | 'admin';
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-role escalation on user registration',
    collection: 'users/user_abc',
    operation: 'create',
    actorRole: 'customer',
    emailVerified: true,
    payload: { uid: 'user_abc', email: 'buyer@example.com', role: 'super_admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Profile role tampering on user update',
    collection: 'users/user_abc',
    operation: 'update',
    actorRole: 'customer',
    emailVerified: true,
    payload: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow field injection on project creation',
    collection: 'projects/proj_1',
    operation: 'create',
    actorRole: 'admin',
    emailVerified: true,
    payload: { id: 'proj_1', name: 'Test Tower', isSystemOverride: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified admin email spoofing',
    collection: 'projects/proj_1',
    operation: 'create',
    actorRole: 'admin',
    emailVerified: false,
    payload: { id: 'proj_1', name: 'Spoof Tower' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-tenant favorite write',
    collection: 'users/victim_uid/favorites/proj_1',
    operation: 'create',
    actorRole: 'customer',
    emailVerified: true,
    payload: { userId: 'victim_uid', projectId: 'proj_1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Cross-tenant enquiry PII read',
    collection: 'enquiries/enq_victim',
    operation: 'get',
    actorRole: 'customer',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Blanket enquiry list scraping',
    collection: 'enquiries',
    operation: 'list',
    actorRole: 'customer',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Document ID poisoning on project path',
    collection: 'projects/invalid..id$poison',
    operation: 'create',
    actorRole: 'admin',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized 1MB payload rejection on enquiry',
    collection: 'enquiries/enq_1',
    operation: 'create',
    actorRole: 'customer',
    emailVerified: true,
    payload: { message: 'x'.repeat(10000) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Customer enquiry status & agent assignment tamper',
    collection: 'enquiries/enq_own',
    operation: 'update',
    actorRole: 'customer',
    emailVerified: true,
    payload: { status: 'closed', assignedAgentName: 'Self' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Non-admin sync provider modification',
    collection: 'syncProviders/dld_feed',
    operation: 'update',
    actorRole: 'customer',
    emailVerified: true,
    payload: { enabled: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Immutable inventory log deletion',
    collection: 'inventoryLogs/log_1',
    operation: 'delete',
    actorRole: 'admin',
    emailVerified: true,
    expected: 'PERMISSION_DENIED',
  },
];
