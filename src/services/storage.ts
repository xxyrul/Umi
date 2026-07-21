import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  orderBy,
  limit,
  QueryConstraint,
} from "@react-native-firebase/firestore";
import { firebaseDB, firebaseAuth } from "./firebase";
import type { PropertyCase, CaseMetrics } from "@/types/case";

const CASES_COLLECTION = "cases";

/**
 * Get the current user's unique Firebase UID
 * All Firestore operations are scoped by this UID
 */
function getCurrentUserId(): string {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) {
    throw new Error("User not authenticated");
  }
  return uid;
}

/**
 * Create a new property case
 */
export async function createCase(caseData: Omit<PropertyCase, "id" | "userId" | "createdAt" | "updatedAt">): Promise<PropertyCase> {
  try {
    const userId = getCurrentUserId();
    const now = new Date().toISOString();

    const docRef = await addDoc(collection(firebaseDB, CASES_COLLECTION), {
      ...caseData,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: docRef.id,
      userId,
      ...caseData,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    console.error("Error creating case:", error);
    throw error;
  }
}

/**
 * Get all cases for the current user
 */
export async function getUserCases(): Promise<PropertyCase[]> {
  try {
    const userId = getCurrentUserId();
    const constraints: QueryConstraint[] = [
      where("userId", "==", userId),
      orderBy("updatedAt", "desc"),
    ];

    const q = query(collection(firebaseDB, CASES_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PropertyCase));
  } catch (error) {
    console.error("Error fetching cases:", error);
    throw error;
  }
}

/**
 * Get recent cases for the current user (limited to N items)
 */
export async function getRecentCases(limitCount: number = 3): Promise<PropertyCase[]> {
  try {
    const userId = getCurrentUserId();
    const constraints: QueryConstraint[] = [
      where("userId", "==", userId),
      orderBy("updatedAt", "desc"),
      limit(limitCount),
    ];

    const q = query(collection(firebaseDB, CASES_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PropertyCase));
  } catch (error) {
    console.error("Error fetching recent cases:", error);
    throw error;
  }
}

/**
 * Get a single case by ID (verified to belong to current user)
 */
export async function getCaseById(caseId: string): Promise<PropertyCase | null> {
  try {
    const userId = getCurrentUserId();
    const docRef = doc(firebaseDB, CASES_COLLECTION, caseId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      return null;
    }

    const caseData = docSnapshot.data() as PropertyCase;

    // Ensure the case belongs to the current user (security check)
    if (caseData.userId !== userId) {
      throw new Error("Unauthorized: Case does not belong to current user");
    }

    return {
      id: docSnapshot.id,
      ...caseData,
    };
  } catch (error) {
    console.error("Error fetching case:", error);
    throw error;
  }
}

/**
 * Update an existing property case
 */
export async function updateCase(caseId: string, updates: Partial<PropertyCase>): Promise<void> {
  try {
    const userId = getCurrentUserId();

    // Verify ownership before updating
    const existingCase = await getCaseById(caseId);
    if (!existingCase) {
      throw new Error("Case not found");
    }

    const now = new Date().toISOString();
    const docRef = doc(firebaseDB, CASES_COLLECTION, caseId);

    await updateDoc(docRef, {
      ...updates,
      userId, // Ensure userId is preserved
      updatedAt: now,
    });
  } catch (error) {
    console.error("Error updating case:", error);
    throw error;
  }
}

/**
 * Delete a property case
 */
export async function deleteCase(caseId: string): Promise<void> {
  try {
    const userId = getCurrentUserId();

    // Verify ownership before deleting
    const existingCase = await getCaseById(caseId);
    if (!existingCase) {
      throw new Error("Case not found");
    }

    const docRef = doc(firebaseDB, CASES_COLLECTION, caseId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting case:", error);
    throw error;
  }
}

/**
 * Get case metrics (counts by status) for the current user
 */
export async function getCaseMetrics(): Promise<CaseMetrics> {
  try {
    const userId = getCurrentUserId();
    const cases = await getUserCases();

    const metrics: CaseMetrics = {
      totalCases: cases.length,
      pending: cases.filter((c) => c.status === "Pending" || c.status === "Viewing").length,
      approved: cases.filter((c) => c.status === "Loan Approved" || c.status === "SPA Signed").length,
      completed: cases.filter((c) => c.status === "Completed").length,
    };

    return metrics;
  } catch (error) {
    console.error("Error calculating metrics:", error);
    throw error;
  }
}

/**
 * Get cases filtered by status
 */
export async function getCasesByStatus(status: string): Promise<PropertyCase[]> {
  try {
    const userId = getCurrentUserId();
    const constraints: QueryConstraint[] = [
      where("userId", "==", userId),
      where("status", "==", status),
      orderBy("updatedAt", "desc"),
    ];

    const q = query(collection(firebaseDB, CASES_COLLECTION), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PropertyCase));
  } catch (error) {
    console.error("Error fetching cases by status:", error);
    throw error;
  }
}

/**
 * Search cases by property name
 */
export async function searchCases(searchTerm: string): Promise<PropertyCase[]> {
  try {
    const userId = getCurrentUserId();
    const allCases = await getUserCases();

    // Client-side search since Firestore doesn't support full-text search out of the box
    const searchLower = searchTerm.toLowerCase();
    return allCases.filter(
      (c) =>
        c.namaCase.toLowerCase().includes(searchLower) ||
        c.clientName.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error("Error searching cases:", error);
    throw error;
  }
}
