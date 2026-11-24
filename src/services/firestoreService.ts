import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AdminAuditLog,
  Developer,
  Enquiry,
  InventoryLog,
  Project,
  SavedSearch,
  SyncProvider,
  UserFavorite,
  UserProfile,
  UserRole,
} from '../types/realEstate.ts';
import {
  INITIAL_DEVELOPERS,
  INITIAL_PROJECTS,
  INITIAL_SYNC_PROVIDERS,
  LEGACY_SAMPLE_IDS,
} from '../data/uaeCatalog.ts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';

function clip(val: string | undefined, max: number): string {
  return (val || '').trim().slice(0, max);
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'chetandixit9968@gmail.com';

export function isStaffRole(role?: UserRole | null, email?: string | null): boolean {
  if (email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  return role === 'super_admin' || role === 'admin' || role === 'inventory_manager' || role === 'sales_agent';
}

export function isAdminRole(role?: UserRole | null, email?: string | null): boolean {
  if (email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  return role === 'super_admin' || role === 'admin';
}

export function isInventoryManagerRole(role?: UserRole | null, email?: string | null): boolean {
  if (email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  return role === 'super_admin' || role === 'admin' || role === 'inventory_manager';
}

// ============================================================================
// User Profile & RBAC
// ============================================================================
export async function syncUserProfile(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<UserProfile> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const now = new Date().toISOString();

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      return data;
    }

    const defaultRole: UserRole = email === BOOTSTRAPPED_ADMIN_EMAIL ? 'super_admin' : 'customer';
    const profile: UserProfile = {
      uid,
      email: clip(email, 160),
      displayName: clip(displayName || email.split('@')[0], 120),
      role: defaultRole,
      preferredCurrency: 'AED',
      preferredLanguage: 'en',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(ref, profile);
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeAllUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as UserProfile));
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updateUserRole(
  targetUid: string,
  newRole: UserRole,
  actorUid: string,
  actorEmail: string
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: newRole,
      updatedAt: new Date().toISOString(),
    });
    await writeAdminAuditLog({
      actorUid,
      actorEmail,
      action: 'ROLE_UPDATED',
      targetCollection: 'users',
      targetId: targetUid,
      summary: `Assigned role ${newRole} to user ${targetUid}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// Projects & Developers (Public Read, Admin/Inventory Write)
// ============================================================================
export function subscribeProjects(onData: (projects: Project[]) => void): () => void {
  const path = 'projects';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as Project);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeDevelopers(onData: (developers: Developer[]) => void): () => void {
  const path = 'developers';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as Developer));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeInventoryLogs(onData: (logs: InventoryLog[]) => void): () => void {
  const path = 'inventoryLogs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as InventoryLog));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function syncVerifiedCatalogToFirestore(
  actorUid: string,
  actorEmail: string,
  forceAll = false
): Promise<number> {
  const path = 'projects';
  const CHUNK_SIZE = 40;
  const now = new Date().toISOString();

  try {
    const [projSnap, devSnap, provSnap] = await Promise.all([
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'developers')),
      getDocs(collection(db, 'syncProviders')),
    ]);

    const existingProjectIds = new Set(projSnap.docs.map((d) => d.id));
    const existingDevIds = new Set(devSnap.docs.map((d) => d.id));
    const legacyToRemove = LEGACY_SAMPLE_IDS.filter((id) => existingProjectIds.has(id));

    const devsToWrite = forceAll
      ? INITIAL_DEVELOPERS
      : INITIAL_DEVELOPERS.filter((d) => !existingDevIds.has(d.id));

    const projectsToWrite = forceAll
      ? INITIAL_PROJECTS
      : INITIAL_PROJECTS.filter((p) => !existingProjectIds.has(p.id));

    if (
      legacyToRemove.length === 0 &&
      devsToWrite.length === 0 &&
      projectsToWrite.length === 0 &&
      !provSnap.empty
    ) {
      return 0;
    }

    // 1. Delete legacy 12 placeholder docs if present
    for (let i = 0; i < legacyToRemove.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      for (const id of legacyToRemove.slice(i, i + CHUNK_SIZE)) {
        batch.delete(doc(db, 'projects', id));
      }
      await batch.commit();
    }

    // 2. Sync developers in chunks
    for (let i = 0; i < devsToWrite.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      for (const dev of devsToWrite.slice(i, i + CHUNK_SIZE)) {
        batch.set(doc(db, 'developers', dev.id), {
          ...dev,
          name: clip(dev.name, 140),
          history: clip(dev.history, 2000),
          updatedAt: now,
        });
      }
      await batch.commit();
    }

    // 3. Sync syncProviders if empty
    if (provSnap.empty) {
      const batch = writeBatch(db);
      for (const prov of INITIAL_SYNC_PROVIDERS) {
        batch.set(doc(db, 'syncProviders', prov.id), {
          ...prov,
          name: clip(prov.name, 140),
          updatedAt: now,
        });
      }
      await batch.commit();
    }

    // 4. Sync all 182 projects in atomic 40-doc writeBatch chunks
    for (let i = 0; i < projectsToWrite.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      for (const proj of projectsToWrite.slice(i, i + CHUNK_SIZE)) {
        const payload = normalizeProjectPayload(proj, now);
        batch.set(doc(db, 'projects', payload.id), payload);
      }
      await batch.commit();
    }

    await writeAdminAuditLog({
      actorUid,
      actorEmail,
      action: 'CATALOG_182_SYNCHRONIZED',
      targetCollection: 'projects',
      summary: clip(
        `Synced ${projectsToWrite.length} verified projects and ${devsToWrite.length} developers; removed ${legacyToRemove.length} legacy placeholders.`,
        500
      ),
    });

    return projectsToWrite.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export const seedInitialCatalogIfNeeded = syncVerifiedCatalogToFirestore;

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function normalizeProjectPayload(project: Project, now: string): Project {
  return stripUndefined({
    ...project,
    id: clip(project.id, 128),
    slug: clip(project.slug, 160),
    name: clip(project.name, 180),
    nameAr: clip(project.nameAr || project.name, 180),
    developerId: clip(project.developerId, 128),
    developerName: clip(project.developerName, 140),
    community: clip(project.community, 140),
    description: clip(project.description, 4000),
    descriptionAr: clip(project.descriptionAr || project.description, 4000),
    heroImageHash: project.heroImageHash ? clip(project.heroImageHash, 128) : '',
    heroSourceName: project.heroSourceName ? clip(project.heroSourceName, 200) : '',
    projectUrl: project.projectUrl ? clip(project.projectUrl, 500) : '',
    brochureUrl: clip(project.brochureUrl, 500),
    amenities: (project.amenities || []).slice(0, 30),
    galleryImages: (project.galleryImages || []).slice(0, 20),
    constructionImages: (project.constructionImages || []).slice(0, 20),
    mediaItems: (project.mediaItems || []).slice(0, 40),
    createdAt: project.createdAt || now,
    updatedAt: project.updatedAt || now,
  });
}

export async function upsertProject(
  project: Project,
  actorUid: string,
  actorEmail: string,
  isNew: boolean
): Promise<void> {
  const path = `projects/${project.id}`;
  try {
    const now = new Date().toISOString();
    const payload = normalizeProjectPayload(project, now);

    await setDoc(doc(db, 'projects', project.id), payload);
    await writeAdminAuditLog({
      actorUid,
      actorEmail,
      action: isNew ? 'PROJECT_CREATED' : 'PROJECT_UPDATED',
      targetCollection: 'projects',
      targetId: project.id,
      summary: `${isNew ? 'Created' : 'Updated'} project ${payload.name} (${payload.emirate})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertProjectsBatch(
  projects: Project[],
  actorUid: string,
  actorEmail: string,
  summaryLabel: string
): Promise<number> {
  if (projects.length === 0) return 0;
  const path = 'projects';
  const CHUNK_SIZE = 40;
  const now = new Date().toISOString();

  try {
    for (let i = 0; i < projects.length; i += CHUNK_SIZE) {
      const chunk = projects.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const proj of chunk) {
        const payload = normalizeProjectPayload(proj, now);
        batch.set(doc(db, 'projects', payload.id), payload);
      }
      await batch.commit();
    }

    await writeAdminAuditLog({
      actorUid,
      actorEmail,
      action: 'EXCEL_IMPORT_COMPLETED',
      targetCollection: 'projects',
      summary: clip(`${summaryLabel} (${projects.length} projects synchronized)`, 500),
    });

    return projects.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProjectRecord(
  projectId: string,
  projectName: string,
  actorUid: string,
  actorEmail: string
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
    await writeAdminAuditLog({
      actorUid,
      actorEmail,
      action: 'PROJECT_DELETED',
      targetCollection: 'projects',
      targetId: projectId,
      summary: `Deleted project ${projectName}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateProjectInventory(
  project: Project,
  nextInventory: Project['inventory'],
  syncType: InventoryLog['syncType'],
  notes: string,
  actorUid: string,
  actorEmail: string
): Promise<void> {
  const path = `projects/${project.id}`;
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'projects', project.id), {
      inventory: {
        ...nextInventory,
        lastUpdatedAt: now,
      },
      updatedAt: now,
    });

    const logId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const logEntry: InventoryLog = {
      id: logId,
      projectId: project.id,
      projectName: clip(project.name, 180),
      previousAvailable: project.inventory.availableUnits,
      newAvailable: nextInventory.availableUnits,
      previousSold: project.inventory.soldUnits,
      newSold: nextInventory.soldUnits,
      previousReserved: project.inventory.reservedUnits,
      newReserved: nextInventory.reservedUnits,
      source: clip(nextInventory.dataSource, 180),
      syncType,
      actorUid,
      actorEmail: clip(actorEmail, 160),
      notes: clip(notes, 500),
      timestamp: now,
    };

    await setDoc(doc(db, 'inventoryLogs', logId), logEntry);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertDeveloper(
  developer: Developer,
  actorUid: string,
  actorEmail: string
): Promise<void> {
  const path = `developers/${developer.id}`;
  try {
    await setDoc(doc(db, 'developers', developer.id), {
      ...developer,
      name: clip(developer.name, 140),
      history: clip(developer.history, 2000),
      updatedAt: new Date().toISOString(),
    });
    await writeAdminAuditLog({
      actorUid,
      actorEmail,
      action: 'DEVELOPER_SAVED',
      targetCollection: 'developers',
      targetId: developer.id,
      summary: `Saved developer ${developer.name}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ============================================================================
// Sync Providers & Audit Logs
// ============================================================================
export function subscribeSyncProviders(
  onData: (providers: SyncProvider[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'syncProviders';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as SyncProvider));
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function upsertSyncProvider(
  provider: SyncProvider,
  actorUid: string,
  actorEmail: string
): Promise<void> {
  const path = `syncProviders/${provider.id}`;
  try {
    await setDoc(doc(db, 'syncProviders', provider.id), {
      ...provider,
      name: clip(provider.name, 140),
      updatedAt: new Date().toISOString(),
    });
    await writeAdminAuditLog({
      actorUid,
      actorEmail,
      action: 'SYNC_PROVIDER_UPDATED',
      targetCollection: 'syncProviders',
      targetId: provider.id,
      summary: `Updated sync provider ${provider.name} (${provider.lastStatus})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function writeAdminAuditLog(
  entry: Omit<AdminAuditLog, 'id' | 'timestamp'>
): Promise<void> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `adminLogs/${id}`;
  try {
    await setDoc(doc(db, 'adminLogs', id), {
      id,
      actorUid: entry.actorUid,
      actorEmail: clip(entry.actorEmail, 160),
      action: clip(entry.action, 120),
      targetCollection: clip(entry.targetCollection, 80),
      targetId: entry.targetId ? clip(entry.targetId, 128) : undefined,
      summary: clip(entry.summary, 500),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeAdminAuditLogs(
  onData: (logs: AdminAuditLog[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'adminLogs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as AdminAuditLog));
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ============================================================================
// Customer Enquiries, Favorites & Saved Searches
// ============================================================================
export async function submitEnquiry(
  input: Omit<Enquiry, 'id' | 'status' | 'createdAt'>
): Promise<Enquiry> {
  const id = `enq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `enquiries/${id}`;
  const now = new Date().toISOString();

  const record: Enquiry = {
    id,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.projectName ? { projectName: clip(input.projectName, 180) } : {}),
    enquiryType: input.enquiryType,
    fullName: clip(input.fullName, 120),
    email: clip(input.email, 160),
    ...(input.phone ? { phone: clip(input.phone, 40) } : {}),
    ...(input.preferredDate ? { preferredDate: clip(input.preferredDate, 40) } : {}),
    ...(typeof input.budgetAed === 'number' && !Number.isNaN(input.budgetAed)
      ? { budgetAed: input.budgetAed }
      : {}),
    ...(input.message ? { message: clip(input.message, 2000) } : {}),
    status: 'new',
    createdAt: now,
  };

  try {
    await setDoc(doc(db, 'enquiries', id), record);
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserEnquiries(
  uid: string,
  onData: (enquiries: Enquiry[]) => void
): () => void {
  const path = 'enquiries';
  const q = query(collection(db, path), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as Enquiry);
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllEnquiries(
  onData: (enquiries: Enquiry[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'enquiries';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as Enquiry));
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updateEnquiryAssignment(
  enquiryId: string,
  updates: Pick<Enquiry, 'status' | 'assignedAgentName' | 'staffNotes'>,
  actorUid: string,
  actorEmail: string
): Promise<void> {
  const path = `enquiries/${enquiryId}`;
  try {
    await updateDoc(doc(db, 'enquiries', enquiryId), {
      status: updates.status,
      assignedAgentName: clip(updates.assignedAgentName, 120),
      staffNotes: clip(updates.staffNotes, 2000),
      updatedAt: new Date().toISOString(),
    });
    await writeAdminAuditLog({
      actorUid,
      actorEmail,
      action: 'ENQUIRY_UPDATED',
      targetCollection: 'enquiries',
      targetId: enquiryId,
      summary: `Set enquiry ${enquiryId} status to ${updates.status} (Agent: ${updates.assignedAgentName || 'Unassigned'})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserFavorites(
  uid: string,
  onData: (favorites: UserFavorite[]) => void
): () => void {
  const path = `users/${uid}/favorites`;
  const q = query(collection(db, 'users', uid, 'favorites'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as UserFavorite));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function toggleUserFavorite(
  uid: string,
  projectId: string,
  projectName: string,
  currentlySaved: boolean
): Promise<void> {
  const path = `users/${uid}/favorites/${projectId}`;
  try {
    const ref = doc(db, 'users', uid, 'favorites', projectId);
    if (currentlySaved) {
      await deleteDoc(ref);
    } else {
      const payload: UserFavorite = {
        userId: uid,
        projectId,
        projectName: clip(projectName, 180),
        createdAt: new Date().toISOString(),
      };
      await setDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeSavedSearches(
  uid: string,
  onData: (searches: SavedSearch[]) => void
): () => void {
  const path = `users/${uid}/savedSearches`;
  const q = query(collection(db, 'users', uid, 'savedSearches'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data() as SavedSearch));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createSavedSearch(
  uid: string,
  search: Omit<SavedSearch, 'id' | 'userId' | 'createdAt'>
): Promise<void> {
  const id = `srch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${uid}/savedSearches/${id}`;
  try {
    const payload: SavedSearch = {
      id,
      userId: uid,
      title: clip(search.title, 140),
      ...(search.emirate ? { emirate: clip(search.emirate, 60) } : {}),
      ...(typeof search.maxBudgetAed === 'number' ? { maxBudgetAed: search.maxBudgetAed } : {}),
      ...(search.propertyType ? { propertyType: clip(search.propertyType, 60) } : {}),
      ...(search.category ? { category: clip(search.category, 60) } : {}),
      alertsEnabled: search.alertsEnabled,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', uid, 'savedSearches', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSavedSearch(uid: string, searchId: string): Promise<void> {
  const path = `users/${uid}/savedSearches/${searchId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'savedSearches', searchId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
