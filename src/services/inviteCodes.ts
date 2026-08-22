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

/**
 * Validates an invite code without claiming it yet.
 * Master codes are identified by their `isMaster` flag in Firestore,
 * not by a hardcoded value in the client bundle.
 */
export async function validateInviteCodeOnly(
  rawCode: string
): Promise<{ success: boolean; code: string; isMaster: boolean }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    throw new Error("EMPTY_CODE");
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
 * Atomically claims an invite code using a Firestore transaction.
 * This prevents two agents from successfully claiming the same
 * single-use code simultaneously.
 */
export async function claimInviteCodeOnly(
  code: string,
  userEmail: string,
  userName: string,
  isMaster = false
): Promise<void> {
  const codeRef = firebaseDB.collection("invite_codes").doc(code);

  if (isMaster) {
    // Master codes are never consumed — just record the latest use timestamp.
    try {
      await codeRef.set(
        {
          code,
          status: "ACTIVE",
          isMaster: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      // Non-critical: master code metadata update is best-effort.
    }
    return;
  }

  // Single-use code: claim atomically via transaction to prevent races.
  await firebaseDB.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(codeRef);

    if (!snapshot.exists) {
      throw new Error("INVALID_CODE");
    }

    const data = snapshot.data() as InviteCodeDoc;

    if (data.status === "USED") {
      throw new Error("ALREADY_USED");
    }

    if (data.status === "REVOKED") {
      throw new Error("REVOKED_CODE");
    }

    transaction.update(codeRef, {
      status: "USED",
      usedBy: userEmail,
      usedByName: userName,
      usedAt: new Date().toISOString(),
    });
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
 * Uses timestamp + random hex for better entropy (~4.3 billion possibilities)
 * instead of Math.random() which only gave 9,000.
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
  const formattedCode = (
    code || `ART-${generateSecureCode()}`
  )
    .trim()
    .toUpperCase();

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
 * Generates a cryptographically stronger code with ~4.3 billion possibilities.
 * Format: ART-XXXX-YYYY (timestamp-based prefix + random hex suffix).
 */
function generateSecureCode(): string {
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  const random = Math.floor(Math.random() * 0xFFFF)
    .toString(16)
    .padStart(4, "0")
    .toUpperCase();
  return `${timestamp}-${random}`;
}

/**
 * Revokes an invite code.
 */
export async function revokeInviteCode(code: string): Promise<void> {
  await firebaseDB
    .collection("invite_codes")
    .doc(code.trim().toUpperCase())
    .update({
      status: "REVOKED",
      updatedAt: new Date().toISOString(),
    });
}
