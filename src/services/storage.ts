import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import type { PropertyCase, CaseMetrics } from "@/types/case";
import type { PropertyListing } from "@/types/listing";
import { Alert, Platform } from "react-native";

const CASES_COLLECTION = "cases";

/**
 * Get the current user's unique Firebase UID
 * All Firestore operations are scoped by this UID
 */
function getCurrentUserId(): string {
  const uid = auth().currentUser?.uid;
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

    // Ensure optional note fields are stored as empty string rather than undefined
    const payload = {
      ...caseData,
      financeNotes: caseData.financeNotes ?? "",
      statusNotes: caseData.statusNotes ?? "",
      userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await firestore().collection(CASES_COLLECTION).add(payload);

    return {
      id: docRef.id,
      ...payload,
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
    const querySnapshot = await firestore()
      .collection(CASES_COLLECTION)
      .where("userId", "==", userId)
      .get();

    const cases = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PropertyCase));

    return cases.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
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
    const querySnapshot = await firestore()
      .collection(CASES_COLLECTION)
      .where("userId", "==", userId)
      .get();

    const cases = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PropertyCase));

    return cases
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, limitCount);
  } catch (error) {
    console.error("Error fetching recent cases:", error);
    throw error;
  }
}

/**
 * Status transition validation
 * App now allows flexible status updates by user choice.
 */
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  void currentStatus;
  void newStatus;
  return true;
}

/**
 * Get a single case by ID (verified to belong to current user)
 */
export async function getCaseById(caseId: string): Promise<PropertyCase | null> {
  try {
    const userId = getCurrentUserId();
    const docSnapshot = await firestore()
      .collection(CASES_COLLECTION)
      .doc(caseId)
      .get();

    if (!docSnapshot.exists) {
      return null;
    }

    const caseData = docSnapshot.data() as Omit<PropertyCase, "id">;

    // Ensure the case belongs to the current user (security check)
    if (caseData.userId !== userId) {
      throw new Error("Unauthorized: Case does not belong to current user");
    }

    return {
      id: docSnapshot.id,
      ...caseData,
    } as PropertyCase;
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

    // Validate status transition if status is being updated
    if (updates.status && updates.status !== existingCase.status) {
      if (!isValidStatusTransition(existingCase.status, updates.status)) {
        throw new Error(`Invalid status transition: ${existingCase.status} → ${updates.status}.\nCorrect order:\n1. Viewing\n2. Booking Paid (deposit)\n3. Loan Approved (bank approval)\n4. SPA Signed (purchase agreement)\n5. Deal Completed (funds transfer)`);
      }
    }

    const now = new Date().toISOString();

    // Merge in the updates, always write financeNotes/statusNotes (even empty string)
    const payload: Partial<PropertyCase> = {
      ...updates,
      financeNotes: updates.financeNotes ?? existingCase.financeNotes ?? "",
      statusNotes: updates.statusNotes ?? existingCase.statusNotes ?? "",
      userId, // Preserve ownership
      updatedAt: now,
    };

    await firestore()
      .collection(CASES_COLLECTION)
      .doc(caseId)
      .update(payload);
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
    // Verify ownership before deleting
    const existingCase = await getCaseById(caseId);
    if (!existingCase) {
      throw new Error("Case not found");
    }

    await firestore()
      .collection(CASES_COLLECTION)
      .doc(caseId)
      .delete();
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
    const querySnapshot = await firestore()
      .collection(CASES_COLLECTION)
      .where("userId", "==", userId)
      .where("status", "==", status)
      .get();

    const cases = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PropertyCase));

    return cases.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  } catch (error) {
    console.error("Error fetching cases by status:", error);
    throw error;
  }
}

/**
 * Search cases by property name, vendor, or buyer
 */
export async function searchCases(searchTerm: string): Promise<PropertyCase[]> {
  try {
    const allCases = await getUserCases();

    // Client-side search since Firestore doesn't support full-text search out of the box
    const searchLower = searchTerm.toLowerCase();
    return allCases.filter(
      (c) =>
        c.namaCase.toLowerCase().includes(searchLower) ||
        (c.vendorName ?? "").toLowerCase().includes(searchLower) ||
        (c.buyerName ?? "").toLowerCase().includes(searchLower) ||
        (c.clientName ?? "").toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error("Error searching cases:", error);
    throw error;
  }
}

// ─── Feedback Submission (100% Free on Spark Plan) ───────────────────────────
const ADMIN_EMAIL = "azrulbaharum@proton.me";

/**
 * Submit user feedback:
 * 1. Saves feedback directly to Firestore 'feedback' collection (Free on Spark plan).
 * 2. Launches the user's native email client (Gmail) with prefilled details.
 */
export async function submitFeedback(
  text: string,
  imageUri?: string
): Promise<void> {
  if (!text.trim()) {
    throw new Error("Feedback text cannot be empty");
  }

  const currentUser = auth().currentUser;
  const userEmail = currentUser?.email || "Unknown User";
  const userId = currentUser?.uid || "anonymous";

  // Save to Firestore 'feedback' collection (free database write)
  await firestore().collection("feedback").add({
    userId,
    userEmail,
    message: text.trim(),
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  // Open Gmail / Mail app directly with pre-filled content (bypasses Android 11+ canOpenURL package restriction)
  try {
    const { Linking } = require("react-native");
    const submittedAt = new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
    const subject = encodeURIComponent(`[Umi Feedback] from ${userEmail}`);
    const body = encodeURIComponent(
      `From: ${userEmail}\nSubmitted: ${submittedAt} (MYT)\n\n${text.trim()}`
    );
    const mailtoUrl = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;

    await Linking.openURL(mailtoUrl);
  } catch (error) {
    console.warn("Mailto launcher warning (non-fatal):", error);
  }
}

// ─── Property Listings Backend Logic (DRT Master Listing CRM) ───────────────

export interface ListingFiles {
  gambar?: string[];
  geran?: string | null;
  icOwner?: string | null;
  spa?: string | null;
  bilUtility?: string | null;
}

function collectListingImageUrls(listing?: Partial<PropertyListing> | null): string[] {
  if (!listing) return [];
  const urls: string[] = [];

  if (listing.imageUrl && typeof listing.imageUrl === "string") {
    urls.push(listing.imageUrl);
  }

  if (Array.isArray(listing.images)) {
    listing.images.forEach((img) => {
      if (img && typeof img === "string" && !urls.includes(img)) {
        urls.push(img);
      }
    });
  }

  if (Array.isArray(listing.gambar)) {
    listing.gambar.forEach((img) => {
      if (img && typeof img === "string" && !urls.includes(img)) {
        urls.push(img);
      }
    });
  }

  return urls;
}

async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (e) {
      console.error("XHR failed for URI:", uri, e);
      reject(new TypeError("Network request failed"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDownloadUrlWithRetry(reference: ReturnType<typeof storage>["ref"] extends (...args: any[]) => infer R ? R : any): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      return await reference.getDownloadURL();
    } catch (error: any) {
      lastError = error;
      const code = error?.code || "";
      // Object may not be immediately visible right after upload.
      if (code !== "storage/object-not-found") {
        throw error;
      }
      await wait(Math.min(2000, 300 + attempt * 120));
    }
  }
  throw lastError;
}

/**
 * Upload local file to Firebase Cloud Storage and return download URL.
 */
async function uploadFileToStorage(localUri: string, path: string): Promise<string> {
  try {
    if (!localUri) return "";

    // If localUri is already a remote HTTP URL, return as-is
    if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
      return localUri;
    }

    const reference = storage().ref(path);

    // Android gallery/media URIs commonly come as content://... which putFile supports directly.
    // file:// URIs need to be converted to a plain filesystem path for putFile.
    const normalizedUri =
      Platform.OS === "android" && localUri.startsWith("file://")
        ? localUri.replace("file://", "")
        : localUri;

    // Try several upload strategies for different URI providers on Android/iOS.
    const uploadAttempts: Array<() => Promise<void>> = [
      async () => {
        await reference.putFile(normalizedUri);
      },
      async () => {
        await reference.putFile(localUri);
      },
      async () => {
        const blob = await uriToBlob(localUri);
        try {
          await reference.put(blob);
        } finally {
          if (typeof (blob as any).close === "function") {
            (blob as any).close();
          }
        }
      },
    ];

    let lastUploadError: any;
    for (const uploadAttempt of uploadAttempts) {
      try {
        await uploadAttempt();
        return await getDownloadUrlWithRetry(reference);
      } catch (error) {
        lastUploadError = error;
      }
    }

    throw lastUploadError;
  } catch (error: any) {
    console.error(`Error uploading file to storage (${path}):`, error);
    const bucketName = storage().app.options.storageBucket || "(unknown bucket)";
    Alert.alert(
      "Firebase Storage Upload Error",
      `Failed to upload file to path: ${path}\nBucket: ${bucketName}\n\nError: ${error?.message || error?.toString() || "Unknown error"}`
    );
    return "";
  }
}

/**
 * Create a new Property Listing:
 * 1. Uploads property images and documents to Firebase Cloud Storage (listings/{listingId}/...).
 * 2. Saves the PropertyListing record (with storage URLs, GPS coordinates, agentId) to Firestore 'listings' collection.
 */
export async function createPropertyListing(
  listingData: Partial<PropertyListing>,
  files: ListingFiles
): Promise<PropertyListing> {
  try {
    const agentId = getCurrentUserId();
    const now = new Date().toISOString();
    const docRef = firestore().collection("listings").doc();
    const listingId = docRef.id;

    // Upload Property Images (Gambar Hartanah)
    const uploadedGambarUrls: string[] = [];
    if (files.gambar && files.gambar.length > 0) {
      for (let i = 0; i < files.gambar.length; i++) {
        const uri = files.gambar[i];
        if (uri) {
          const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
          const path = `listings/${listingId}/gambar_${i}_${Date.now()}.${ext}`;
          const url = await uploadFileToStorage(uri, path);
          if (url) uploadedGambarUrls.push(url);
        }
      }
    }

    // Upload Geran Document
    let geranUrl = "";
    if (files.geran) {
      const ext = files.geran.split(".").pop()?.split("?")[0] || "pdf";
      const path = `listings/${listingId}/geran_${Date.now()}.${ext}`;
      geranUrl = await uploadFileToStorage(files.geran, path);
    }

    // Upload IC Owner Document
    let icOwnerUrl = "";
    if (files.icOwner) {
      const ext = files.icOwner.split(".").pop()?.split("?")[0] || "pdf";
      const path = `listings/${listingId}/icOwner_${Date.now()}.${ext}`;
      icOwnerUrl = await uploadFileToStorage(files.icOwner, path);
    }

    // Upload SPA Document (if provided)
    let spaUrl = "";
    if (files.spa) {
      const ext = files.spa.split(".").pop()?.split("?")[0] || "pdf";
      const path = `listings/${listingId}/spa_${Date.now()}.${ext}`;
      spaUrl = await uploadFileToStorage(files.spa, path);
    }

    // Upload Bil Utility Document (if provided)
    let bilUtilityUrl = "";
    if (files.bilUtility) {
      const ext = files.bilUtility.split(".").pop()?.split("?")[0] || "pdf";
      const path = `listings/${listingId}/bilUtility_${Date.now()}.${ext}`;
      bilUtilityUrl = await uploadFileToStorage(files.bilUtility, path);
    }

    const currentUser = auth().currentUser;
    const userId = currentUser?.uid || "";
    const authorName = currentUser ? (currentUser.displayName || currentUser.email || "") : "";

    const payload: PropertyListing = {
      id: listingId,
      agentId,
      status: (listingData.status as any) || "Aktif",
      tajuk: listingData.tajuk || "",
      harga: listingData.harga || "",
      alamat: listingData.alamat || "",
      negeri: listingData.negeri || "",
      jenis: listingData.jenis || "",
      pegangan: listingData.pegangan || "Freehold",
      lot: listingData.lot || "Bumi Lot",
      bilikTidur: listingData.bilikTidur || 0,
      bilikAir: listingData.bilikAir || 0,
      keluasan: listingData.keluasan || "",
      location: listingData.location || null,
      namaOwner: listingData.namaOwner || "",
      telOwner: listingData.telOwner || "",
      gambar: uploadedGambarUrls,
      imageUrl: uploadedGambarUrls[0] || "",
      images: uploadedGambarUrls,
      geran: geranUrl,
      icOwner: icOwnerUrl,
      spa: spaUrl,
      bilUtility: bilUtilityUrl,
      userId,
      authorName,
      navLink: listingData.navLink || "",
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(payload);
    return payload;
  } catch (error) {
    console.error("Error creating property listing:", error);
    throw error;
  }
}

export async function updatePropertyListing(
  listingId: string,
  listingData: Partial<PropertyListing>,
  files: ListingFiles
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const currentUid = getCurrentUserId();
    const existingDoc = await firestore().collection("listings").doc(listingId).get();
    const existingListing = existingDoc.exists
      ? (existingDoc.data() as Partial<PropertyListing>)
      : null;
    const existingImageUrls = collectListingImageUrls(existingListing);

    // 1. Upload new/existing images
    const uploadedGambarUrls: string[] = [];
    if (files.gambar !== undefined && files.gambar.length > 0) {
      for (let i = 0; i < files.gambar.length; i++) {
        const uri = files.gambar[i];
        if (uri) {
          if (uri.startsWith("http://") || uri.startsWith("https://")) {
            uploadedGambarUrls.push(uri);
          } else {
            const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
            const path = `listings/${listingId}/gambar_${i}_${Date.now()}.${ext}`;
            const url = await uploadFileToStorage(uri, path);
            if (url) uploadedGambarUrls.push(url);
          }
        }
      }
    }

    const finalGambarUrls =
      files.gambar === undefined
        ? existingImageUrls
        : (uploadedGambarUrls.length > 0 ? uploadedGambarUrls : (files.gambar.length === 0 ? [] : existingImageUrls));

    // 2. Upload documents
    let geranUrl = listingData.geran || null;
    if (files.geran) {
      if (files.geran.startsWith("http://") || files.geran.startsWith("https://")) {
        geranUrl = files.geran;
      } else {
        const ext = files.geran.split(".").pop()?.split("?")[0] || "pdf";
        const path = `listings/${listingId}/geran_${Date.now()}.${ext}`;
        geranUrl = await uploadFileToStorage(files.geran, path);
      }
    }

    let icOwnerUrl = listingData.icOwner || null;
    if (files.icOwner) {
      if (files.icOwner.startsWith("http://") || files.icOwner.startsWith("https://")) {
        icOwnerUrl = files.icOwner;
      } else {
        const ext = files.icOwner.split(".").pop()?.split("?")[0] || "pdf";
        const path = `listings/${listingId}/icOwner_${Date.now()}.${ext}`;
        icOwnerUrl = await uploadFileToStorage(files.icOwner, path);
      }
    }

    let spaUrl = listingData.spa || null;
    if (files.spa) {
      if (files.spa.startsWith("http://") || files.spa.startsWith("https://")) {
        spaUrl = files.spa;
      } else {
        const ext = files.spa.split(".").pop()?.split("?")[0] || "pdf";
        const path = `listings/${listingId}/spa_${Date.now()}.${ext}`;
        spaUrl = await uploadFileToStorage(files.spa, path);
      }
    }

    let bilUtilityUrl = listingData.bilUtility || null;
    if (files.bilUtility) {
      if (files.bilUtility.startsWith("http://") || files.bilUtility.startsWith("https://")) {
        bilUtilityUrl = files.bilUtility;
      } else {
        const ext = files.bilUtility.split(".").pop()?.split("?")[0] || "pdf";
        const path = `listings/${listingId}/bilUtility_${Date.now()}.${ext}`;
        bilUtilityUrl = await uploadFileToStorage(files.bilUtility, path);
      }
    }

    // 3. Update firestore document
    await firestore().collection("listings").doc(listingId).update({
      ...listingData,
      userId: existingListing?.userId || currentUid,
      agentId: existingListing?.agentId || currentUid,
      gambar: finalGambarUrls,
      imageUrl: finalGambarUrls[0] || "",
      images: finalGambarUrls,
      geran: geranUrl,
      icOwner: icOwnerUrl,
      spa: spaUrl,
      bilUtility: bilUtilityUrl,
      updatedAt: now,
    });
  } catch (error) {
    console.error("Error updating property listing:", error);
    throw error;
  }
}






