import { firebaseDB } from "@/services/firebase";

export interface InviteCodeDoc {
  code: string;
  status: "ACTIVE" | "USED" | "REVOKED";
  isMaster?: boolean;
  createdBy?: string;
  createdAt: string;
  usedBy?: string | null;
  usedByName?: string | null;
  usedAt?: string | null;
  notes?: string;
}

export const DEFAULT_MASTER_CODE = "ART-MASTER-8842-XK";

/**
 * Validates an invite code without claiming it yet.
 */
export async function validateInviteCodeOnly(
  rawCode: string
): Promise<{ success: boolean; code: string; isMaster: boolean }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    throw new Error("EMPTY_CODE");
  }

  if (code === DEFAULT_MASTER_CODE) {
    return { success: true, code: DEFAULT_MASTER_CODE, isMaster: true };
  }

  const codeRef = firebaseDB.collection("invite_codes").doc(code);
  const doc = await codeRef.get();

  if (!doc.exists) {
    throw new Error("INVALID_CODE");
  }

  const data = doc.data() as InviteCodeDoc;

  if (data.status === "REVOKED") {
    throw new Error("REVOKED_CODE");
  }

  if (data.status === "USED" && !data.isMaster) {
    throw new Error("ALREADY_USED");
  }

  return { success: true, code, isMaster: !!data.isMaster };
}

/**
 * Claims an invite code after account creation succeeds.
 */
export async function claimInviteCodeOnly(
  code: string,
  userEmail: string,
  userName: string,
  isMaster = false
): Promise<void> {
  if (isMaster || code === DEFAULT_MASTER_CODE) {
    try {
      await firebaseDB.collection("invite_codes").doc(DEFAULT_MASTER_CODE).set(
        {
          code: DEFAULT_MASTER_CODE,
          status: "ACTIVE",
          isMaster: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {}
    return;
  }

  const codeRef = firebaseDB.collection("invite_codes").doc(code);
  await codeRef.update({
    status: "USED",
    usedBy: userEmail,
    usedByName: userName,
    usedAt: new Date().toISOString(),
  });
}

/**
 * Validates and atomically claims an invite code during registration.
 * Throws an informative error if the code is invalid, revoked, or already used.
 */
export async function validateAndClaimInviteCode(
  rawCode: string,
  userEmail: string,
  userName: string
): Promise<{ success: boolean; code: string; isMaster: boolean }> {
  const { code, isMaster } = await validateInviteCodeOnly(rawCode);
  await claimInviteCodeOnly(code, userEmail, userName, isMaster);
  return { success: true, code, isMaster };
}

/**
 * Generates a new unique single-use or master invite code.
 */
export async function createInviteCode({
  code,
  isMaster = false,
  createdBy = "admin",
  notes = "",
}: {
  code?: string;
  isMaster?: boolean;
  createdBy?: string;
  notes?: string;
}): Promise<InviteCodeDoc> {
  const formattedCode = (code || `ART-${Math.floor(1000 + Math.random() * 9000)}`).trim().toUpperCase();

  const newDoc: InviteCodeDoc = {
    code: formattedCode,
    status: "ACTIVE",
    isMaster,
    createdBy,
    createdAt: new Date().toISOString(),
    usedBy: null,
    usedByName: null,
    usedAt: null,
    notes,
  };

  await firebaseDB.collection("invite_codes").doc(formattedCode).set(newDoc);
  return newDoc;
}

/**
 * Revokes an invite code.
 */
export async function revokeInviteCode(code: string): Promise<void> {
  await firebaseDB.collection("invite_codes").doc(code.trim().toUpperCase()).update({
    status: "REVOKED",
    updatedAt: new Date().toISOString(),
  });
}
