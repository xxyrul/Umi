import { firebaseDB, firebaseAuth } from "@/services/firebase";
import { createInviteCode, revokeInviteCode, InviteCodeDoc } from "@/services/inviteCodes";
import { FeedbackSubmission, FeedbackStatus } from "@/services/feedback";

const ADMIN_MANAGE_USER_URL = "https://us-central1-umiren-d6a66.cloudfunctions.net/adminManageUser";
const ADMIN_DELETE_ANNOUNCEMENT_URL = "https://us-central1-umiren-d6a66.cloudfunctions.net/adminDeleteAnnouncement";

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const token = await firebaseAuth.currentUser?.getIdToken().catch(() => null);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function manageUserAsAdmin(
  action: "approve" | "reject" | "suspend" | "activate" | "updateRole" | "delete",
  uid: string,
  extra: { role?: "admin" | "agent"; reason?: string } = {}
): Promise<void> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(ADMIN_MANAGE_USER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, uid, ...extra }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `Failed to ${action} user`);
  }
}

export interface AdminAgent {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  phone?: string;
  role: "admin" | "agent";
  status?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED" | "REJECTED";
  approved?: boolean;
  registeredWithCode?: string;
  createdAt?: string;
  updatedAt?: string;
  photoURL?: string;
}

export interface BroadcastPayload {
  titleEN: string;
  titleBM: string;
  messageEN: string;
  messageBM: string;
  type?: "GENERAL" | "URGENT" | "LISTING" | "COMMISSION";
  pinned?: boolean;
}

/**
 * Subscribe to pending agents waiting for admin approval in real time
 */
export function subscribeToPendingAgents(callback: (agents: AdminAgent[]) => void): () => void {
  return firebaseDB
    .collection("users")
    .onSnapshot(
      (snapshot) => {
        if (!snapshot) {
          callback([]);
          return;
        }
        const pending: AdminAgent[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as AdminAgent;
          // An agent is pending strictly if role is not admin and status is PENDING_APPROVAL
          if (
            data.role !== "admin" &&
            data.status === "PENDING_APPROVAL"
          ) {
            pending.push({ ...data, uid: doc.id });
          }
        });
        // Sort newest first
        pending.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        callback(pending);
      },
      (error) => {
        console.warn("Error subscribing to pending agents:", error);
        callback([]);
      }
    );
}

/**
 * Subscribe to all registered agents for directory and management (excludes pending & rejected applicants)
 */
export function subscribeToAllAgents(callback: (agents: AdminAgent[]) => void): () => void {
  return firebaseDB
    .collection("users")
    .onSnapshot(
      (snapshot) => {
        if (!snapshot) {
          callback([]);
          return;
        }
        const agents: AdminAgent[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as AdminAgent;
          // Only include verified/registered team members (ACTIVE or SUSPENDED or ADMIN)
          if (
            doc.id !== "super_admin_web_portal" &&
            data.status !== "PENDING_APPROVAL" &&
            data.status !== "REJECTED" &&
            (data.email || data.displayName)
          ) {
            agents.push({ ...data, uid: doc.id });
          }
        });
        agents.sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
        callback(agents);
      },
      (error) => {
        console.warn("Error subscribing to all agents:", error);
        callback([]);
      }
    );
}

/**
 * Approve a pending agent, granting immediate full CRM access
 */
export async function approveAgent(uid: string): Promise<void> {
  try {
    await manageUserAsAdmin("approve", uid);
  } catch (cfErr) {
    console.warn("CF approveAgent failed, falling back to Firestore:", cfErr);
    const now = new Date().toISOString();
    await firebaseDB.collection("users").doc(uid).set(
      { status: "ACTIVE", approved: true, approvedAt: now, updatedAt: now },
      { merge: true }
    );
  }
}

/**
 * Reject a pending agent application (sets status to REJECTED)
 */
export async function rejectOrSuspendAgent(uid: string, reason?: string): Promise<void> {
  try {
    await manageUserAsAdmin("reject", uid, { reason });
  } catch (cfErr) {
    console.warn("CF rejectAgent failed, falling back to Firestore:", cfErr);
    const now = new Date().toISOString();
    await firebaseDB.collection("users").doc(uid).set(
      {
        status: "REJECTED",
        approved: false,
        rejectedAt: now,
        rejectionReason: reason || "Pendaftaran ditolak oleh pentadbir.",
        updatedAt: now,
      },
      { merge: true }
    );
  }
}

/**
 * Suspend an existing agent account
 */
export async function suspendAgent(uid: string, reason?: string): Promise<void> {
  try {
    await manageUserAsAdmin("suspend", uid, { reason });
  } catch (cfErr) {
    console.warn("CF suspendAgent failed, falling back to Firestore:", cfErr);
    const now = new Date().toISOString();
    await firebaseDB.collection("users").doc(uid).set(
      {
        status: "SUSPENDED",
        approved: false,
        suspendedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }
}

/**
 * Reactivate / Unsuspend an existing agent account
 */
export async function activateAgent(uid: string): Promise<void> {
  try {
    await manageUserAsAdmin("activate", uid);
  } catch (cfErr) {
    console.warn("CF activateAgent failed, falling back to Firestore:", cfErr);
    const now = new Date().toISOString();
    await firebaseDB.collection("users").doc(uid).set(
      { status: "ACTIVE", approved: true, updatedAt: now },
      { merge: true }
    );
  }
}

/**
 * Permanently delete an agent profile and Auth credentials
 */
export async function deleteAgent(uid: string): Promise<void> {
  try {
    await manageUserAsAdmin("delete", uid);
  } catch (cfErr) {
    console.warn("CF deleteAgent failed, falling back to Firestore:", cfErr);
    await firebaseDB.collection("users").doc(uid).delete();
  }
}

/**
 * Update an agent's role (promote to admin or demote to agent)
 */
export async function updateAgentRole(uid: string, role: "admin" | "agent"): Promise<void> {
  try {
    await manageUserAsAdmin("updateRole", uid, { role });
  } catch (cfErr) {
    console.warn("CF updateAgentRole failed, falling back to Firestore:", cfErr);
    const now = new Date().toISOString();
    await firebaseDB.collection("users").doc(uid).set(
      { role, updatedAt: now },
      { merge: true }
    );
  }
}

/**
 * Delete an announcement from noticeboard as admin
 */
export async function deleteAnnouncementAsAdmin(announcementId: string): Promise<void> {
  try {
    const headers = await getAdminAuthHeaders();
    const res = await fetch(ADMIN_DELETE_ANNOUNCEMENT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ announcementId }),
    });
    if (!res.ok) {
      throw new Error("Failed to delete announcement via API");
    }
  } catch (cfErr) {
    console.warn("CF deleteAnnouncement failed, falling back to Firestore:", cfErr);
    await firebaseDB.collection("announcements").doc(announcementId).delete();
  }
}

/**
 * Subscribe to the active and claimed invite codes list
 */
export function subscribeToInviteCodes(callback: (codes: InviteCodeDoc[]) => void): () => void {
  return firebaseDB
    .collection("invite_codes")
    .onSnapshot(
      (snapshot) => {
        if (!snapshot) {
          callback([]);
          return;
        }
        const codes: InviteCodeDoc[] = [];
        snapshot.forEach((doc) => {
          codes.push(doc.data() as InviteCodeDoc);
        });
        codes.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        callback(codes);
      },
      (error) => {
        console.warn("Error subscribing to invite codes:", error);
        callback([]);
      }
    );
}

/**
 * Generate multiple single-use invite codes in a batch
 */
export async function generateBatchInviteCodes({
  count = 5,
  prefix = "ART",
  isMaster = false,
  notes = "",
  createdBy = "admin",
}: {
  count?: number;
  prefix?: string;
  isMaster?: boolean;
  notes?: string;
  createdBy?: string;
}): Promise<InviteCodeDoc[]> {
  const cleanCount = Math.min(Math.max(1, count), 25);
  const results: InviteCodeDoc[] = [];

  for (let i = 0; i < cleanCount; i++) {
    const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
    const random = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, "0")
      .toUpperCase();
    const cleanPrefix = (prefix.trim() || "ART").toUpperCase();
    const customCode = `${cleanPrefix}-${timestamp}-${random}`;

    const newCode = await createInviteCode({
      code: customCode,
      isMaster,
      createdBy,
      notes: notes || `Batch generated (${i + 1}/${cleanCount})`,
    });
    results.push(newCode);
  }

  return results;
}

/**
 * Send an agency-wide broadcast announcement and trigger instant push notifications
 */
export async function sendBroadcastAnnouncement(
  payload: BroadcastPayload,
  adminName = "Pentadbir Agensi"
): Promise<{ success: boolean; sentCount?: number }> {
  const now = new Date().toISOString();
  const annId = "ann_" + Date.now();

  // 1. Save announcement document in Firestore for noticeboard
  await firebaseDB.collection("announcements").doc(annId).set({
    id: annId,
    title: payload.titleBM || payload.titleEN,
    titleEN: payload.titleEN,
    titleBM: payload.titleBM,
    content: payload.messageBM || payload.messageEN,
    contentEN: payload.messageEN,
    contentBM: payload.messageBM,
    type: payload.type || "GENERAL",
    pinned: !!payload.pinned,
    author: adminName,
    createdAt: now,
    timestamp: Date.now(),
  });

  // 2. Trigger high-priority push notifications to all agent devices via Cloud Function
  let pushResult = { success: true, sentCount: 0 };
  try {
    const response = await fetch("https://sendbroadcastpush-4511887297806416.asia-southeast1.run.app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleEN: payload.titleEN,
        titleBM: payload.titleBM,
        messageEN: payload.messageEN,
        messageBM: payload.messageBM,
        type: payload.type || "GENERAL",
      }),
    });
    if (response.ok) {
      const data = await response.json();
      pushResult.sentCount = data.sentCount || 0;
    }
  } catch (pushErr) {
    console.warn("Could not dispatch instant push notification:", pushErr);
  }

  return pushResult;
}

/**
 * Quick admin moderation for property listings
 */
export async function updateAgencyListingStatus(listingId: string, status: string): Promise<void> {
  const now = new Date().toISOString();
  await firebaseDB.collection("publicListings").doc(listingId).set(
    { status, updatedAt: now },
    { merge: true }
  );

  await firebaseDB.collection("listings").doc(listingId).set(
    { status, updatedAt: now },
    { merge: true }
  ).catch(() => {});
}

/**
 * Real-time subscription to all agent feedback submissions for Admin Hub
 */
export function subscribeToAllFeedback(callback: (feedbackList: FeedbackSubmission[]) => void): () => void {
  try {
    const unsubscribe = firebaseDB
      .collection("feedback")
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) {
            callback([]);
            return;
          }
          const list: FeedbackSubmission[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...(doc.data() as any) });
          });
          // Safe newest first sort
          list.sort((a, b) => {
            const getMillis = (v: any) => {
              if (!v) return 0;
              if (typeof v === "string") {
                const t = new Date(v).getTime();
                return isNaN(t) ? 0 : t;
              }
              if (typeof v?.toMillis === "function") return v.toMillis();
              if (typeof v?.seconds === "number") return v.seconds * 1000;
              if (v instanceof Date) return v.getTime();
              return 0;
            };
            return getMillis(b.createdAt) - getMillis(a.createdAt);
          });
          callback(list);
        },
        (error) => {
          console.warn("subscribeToAllFeedback error:", error);
          callback([]);
        }
      );

    return typeof unsubscribe === "function" ? unsubscribe : () => {};
  } catch (err) {
    console.warn("subscribeToAllFeedback sync error:", err);
    callback([]);
    return () => {};
  }
}

/**
 * Update feedback ticket status and add developer/admin response
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  adminResponse?: string
): Promise<void> {
  if (!feedbackId) return;
  const now = new Date().toISOString();
  const updateData: any = {
    status,
    updatedAt: now,
  };
  if (adminResponse !== undefined) {
    updateData.adminResponse = adminResponse.trim();
  }
  await firebaseDB.collection("feedback").doc(feedbackId).set(updateData, { merge: true });
}

/**
 * Delete feedback submission as admin
 */
export async function deleteFeedbackAsAdmin(feedbackId: string): Promise<void> {
  if (!feedbackId) return;
  await firebaseDB.collection("feedback").doc(feedbackId).delete();
}

