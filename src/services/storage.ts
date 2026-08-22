import { auth, firestore } from "@/services/firebase";
import storage from "@react-native-firebase/storage";
import type { PropertyCase, CaseMetrics } from "@/types/case";
import type { PropertyListing } from "@/types/listing";
import { compressImage } from "@/utils/imageUtils";
import { Alert, Platform } from "react-native";

const CASES_COLLECTION = "cases";
const LISTINGS_COLLECTION = "listings";
const PUBLIC_LISTINGS_COLLECTION = "publicListings";

/**
 * Public listing cards are intentionally separate from the private listing
 * document so authenticated agents can browse property details without
 * receiving owner documents such as IC, geran, SPA, or utility-bill URLs.
 */
function toPublicListingPayload(listing: PropertyListing) {
  const { geran, icOwner, spa, bilUtility, ...publicListing } = listing;
  return publicListing;
}

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
 * Get all cases for the current user (supports optional limit)
 */
export async function getUserCases(limitCount?: number): Promise<PropertyCase[]> {
  try {
    const userId = getCurrentUserId();
    let query = firestore()
      .collection(CASES_COLLECTION)
      .where("userId", "==", userId);

    if (limitCount && limitCount > 0) {
      query = query.limit(limitCount);
    }

    const querySnapshot = await query.get();

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
 * Get recent cases for the current user with server-side limit
 */
export async function getRecentCases(limitCount: number = 3): Promise<PropertyCase[]> {
  try {
    const userId = getCurrentUserId();
    let querySnapshot;
    try {
      querySnapshot = await firestore()
        .collection(CASES_COLLECTION)
        .where("userId", "==", userId)
        .orderBy("updatedAt", "desc")
        .limit(limitCount)
        .get();
    } catch {
      // Fallback in case compound index is not deployed yet
      querySnapshot = await firestore()
        .collection(CASES_COLLECTION)
        .where("userId", "==", userId)
        .limit(Math.max(limitCount * 2, 10))
        .get();
    }

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
    const userId = getCurrentUserId();
    const collection = firestore().collection(CASES_COLLECTION);
    
    // Using aggregation queries avoids downloading all documents, saving massive bandwidth
    const [
      totalSnap,
      viewingSnap,
      bookingSnap,
      loanSnap,
      spaSnap,
      completedSnap,
      cancelledSnap,
      bankLoanSnap
    ] = await Promise.all([
      collection.where("userId", "==", userId).count().get(),
      collection.where("userId", "==", userId).where("status", "==", "Viewing").count().get(),
      collection.where("userId", "==", userId).where("status", "==", "Booking Paid").count().get(),
      collection.where("userId", "==", userId).where("status", "==", "Loan Approved").count().get(),
      collection.where("userId", "==", userId).where("status", "==", "SPA Signed").count().get(),
      collection.where("userId", "==", userId).where("status", "==", "Completed").count().get(),
      collection.where("userId", "==", userId).where("status", "==", "Cancelled").count().get(),
      collection.where("userId", "==", userId).where("finance", "==", "Bank Loan").count().get(),
    ]);

    // To prevent double counting for "underLoan" if status is "Loan Approved" AND finance is "Bank Loan"
    // Since aggregation queries don't easily do complex distinct ORs across fields in older versions, 
    // we'll just sum them roughly or you can use `Filter.or` if using Firebase v9+.
    const loanApprovedCount = loanSnap.data().count;
    const bankLoanCount = bankLoanSnap.data().count;

    return {
      totalCases: totalSnap.data().count,
      aktif: viewingSnap.data().count + bookingSnap.data().count + loanSnap.data().count + spaSnap.data().count,
      booking: bookingSnap.data().count,
      underLoan: Math.max(loanApprovedCount, bankLoanCount), // Approximation to avoid double counting without fetching
      underSpa: spaSnap.data().count,
      sold: completedSnap.data().count,
      expired: cancelledSnap.data().count,
    };
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
  files: ListingFiles,
  onProgress?: (progress: { current: number; total: number; stage: string }) => void
): Promise<PropertyListing> {
  try {
    const agentId = getCurrentUserId();
    const now = new Date().toISOString();
    const docRef = firestore().collection(LISTINGS_COLLECTION).doc();
    const listingId = docRef.id;

    // Upload Property Images (Gambar Hartanah) concurrently
    let uploadedGambarUrls: string[] = [];
    if (files.gambar && files.gambar.length > 0) {
      const totalImages = files.gambar.length;
      let completed = 0;
      onProgress?.({ current: 0, total: totalImages, stage: "photos" });

      const uploadPromises = files.gambar.map(async (uri, i) => {
        if (!uri) return "";
        if (uri.startsWith("http://") || uri.startsWith("https://")) {
          completed++;
          onProgress?.({ current: completed, total: totalImages, stage: "photos" });
          return uri;
        }
        const compressedUri = await compressImage(uri);
        const ext = compressedUri.split(".").pop()?.split("?")[0] || "webp";
        const path = `listings/${listingId}/gambar_${i}_${Date.now()}.${ext}`;
        const url = await uploadFileToStorage(compressedUri, path);
        completed++;
        onProgress?.({ current: completed, total: totalImages, stage: "photos" });
        return url;
      });

      const results = await Promise.all(uploadPromises);
      uploadedGambarUrls = results.filter(Boolean);
    }

    // Upload Documents concurrently
    onProgress?.({ current: 0, total: 1, stage: "documents" });
    const [geranUrl, icOwnerUrl, spaUrl, bilUtilityUrl] = await Promise.all([
      files.geran && !files.geran.startsWith("http")
        ? uploadFileToStorage(files.geran, `listings/${listingId}/geran_${Date.now()}.${files.geran.split(".").pop()?.split("?")[0] || "pdf"}`)
        : files.geran || "",
      files.icOwner && !files.icOwner.startsWith("http")
        ? uploadFileToStorage(files.icOwner, `listings/${listingId}/icOwner_${Date.now()}.${files.icOwner.split(".").pop()?.split("?")[0] || "pdf"}`)
        : files.icOwner || "",
      files.spa && !files.spa.startsWith("http")
        ? uploadFileToStorage(files.spa, `listings/${listingId}/spa_${Date.now()}.${files.spa.split(".").pop()?.split("?")[0] || "pdf"}`)
        : files.spa || "",
      files.bilUtility && !files.bilUtility.startsWith("http")
        ? uploadFileToStorage(files.bilUtility, `listings/${listingId}/bilUtility_${Date.now()}.${files.bilUtility.split(".").pop()?.split("?")[0] || "pdf"}`)
        : files.bilUtility || "",
    ]);

    const currentUser = auth().currentUser;
    const userId = currentUser?.uid || "";
    const authorName = currentUser ? (currentUser.displayName || currentUser.email || "") : "";

    const payload: PropertyListing = {
      id: listingId,
      agentId,
      status: (listingData.status as any) || "Aktif",
      tajuk: listingData.tajuk || "",
      description: listingData.description || "",
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

    await Promise.all([
      docRef.set(payload),
      firestore()
        .collection(PUBLIC_LISTINGS_COLLECTION)
        .doc(listingId)
        .set(toPublicListingPayload(payload)),
    ]);
    return payload;
  } catch (error) {
    console.error("Error creating property listing:", error);
    throw error;
  }
}

export async function updatePropertyListing(
  listingId: string,
  listingData: Partial<PropertyListing>,
  files: ListingFiles,
  onProgress?: (progress: { current: number; total: number; stage: string }) => void
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const currentUid = getCurrentUserId();
    const existingDoc = await firestore().collection(LISTINGS_COLLECTION).doc(listingId).get();
    const existingListing = existingDoc.exists
      ? (existingDoc.data() as Partial<PropertyListing>)
      : null;
    const existingImageUrls = collectListingImageUrls(existingListing);

    // 1. Upload new/existing images concurrently
    let uploadedGambarUrls: string[] = [];
    if (files.gambar !== undefined && files.gambar.length > 0) {
      const totalImages = files.gambar.length;
      let completed = 0;
      onProgress?.({ current: 0, total: totalImages, stage: "photos" });

      const uploadPromises = files.gambar.map(async (uri, i) => {
        if (!uri) return "";
        if (uri.startsWith("http://") || uri.startsWith("https://")) {
          completed++;
          onProgress?.({ current: completed, total: totalImages, stage: "photos" });
          return uri;
        }
        const compressedUri = await compressImage(uri);
        const ext = compressedUri.split(".").pop()?.split("?")[0] || "webp";
        const path = `listings/${listingId}/gambar_${i}_${Date.now()}.${ext}`;
        const url = await uploadFileToStorage(compressedUri, path);
        completed++;
        onProgress?.({ current: completed, total: totalImages, stage: "photos" });
        return url;
      });

      const results = await Promise.all(uploadPromises);
      uploadedGambarUrls = results.filter(Boolean);
    }

    const finalGambarUrls =
      files.gambar === undefined
        ? existingImageUrls
        : (uploadedGambarUrls.length > 0 ? uploadedGambarUrls : (files.gambar.length === 0 ? [] : existingImageUrls));

    // 2. Upload documents concurrently
    onProgress?.({ current: 0, total: 1, stage: "documents" });
    const [geranUrl, icOwnerUrl, spaUrl, bilUtilityUrl] = await Promise.all([
      files.geran
        ? (files.geran.startsWith("http")
            ? files.geran
            : uploadFileToStorage(files.geran, `listings/${listingId}/geran_${Date.now()}.${files.geran.split(".").pop()?.split("?")[0] || "pdf"}`))
        : (listingData.geran || null),
      files.icOwner
        ? (files.icOwner.startsWith("http")
            ? files.icOwner
            : uploadFileToStorage(files.icOwner, `listings/${listingId}/icOwner_${Date.now()}.${files.icOwner.split(".").pop()?.split("?")[0] || "pdf"}`))
        : (listingData.icOwner || null),
      files.spa
        ? (files.spa.startsWith("http")
            ? files.spa
            : uploadFileToStorage(files.spa, `listings/${listingId}/spa_${Date.now()}.${files.spa.split(".").pop()?.split("?")[0] || "pdf"}`))
        : (listingData.spa || null),
      files.bilUtility
        ? (files.bilUtility.startsWith("http")
            ? files.bilUtility
            : uploadFileToStorage(files.bilUtility, `listings/${listingId}/bilUtility_${Date.now()}.${files.bilUtility.split(".").pop()?.split("?")[0] || "pdf"}`))
        : (listingData.bilUtility || null),
    ]);

    // 3. Update the private document and its safe public projection.
    const privateUpdate = {
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
    };
    const updatedListing = {
      ...(existingListing || {}),
      id: listingId,
      ...privateUpdate,
    } as PropertyListing;

    await Promise.all([
      firestore().collection(LISTINGS_COLLECTION).doc(listingId).update(privateUpdate),
      firestore()
        .collection(PUBLIC_LISTINGS_COLLECTION)
        .doc(listingId)
        .set(toPublicListingPayload(updatedListing)),
    ]);
  } catch (error) {
    console.error("Error updating property listing:", error);
    throw error;
  }
}

/**
 * Delete a Property Listing and dynamically clean up its orphaned storage files (images & docs)
 */
export async function deletePropertyListing(listingId: string): Promise<void> {
  try {
    const currentUid = getCurrentUserId();
    const docRef = firestore().collection(LISTINGS_COLLECTION).doc(listingId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data() as PropertyListing;
      if (data.userId !== currentUid && data.agentId !== currentUid) {
        throw new Error("Unauthorized to delete this listing.");
      }
    }

    // 1. Delete Firestore private and public records
    await Promise.all([
      docRef.delete(),
      firestore().collection(PUBLIC_LISTINGS_COLLECTION).doc(listingId).delete().catch(() => {}),
    ]);

    // 2. Dynamic Storage Cleanup: Delete all uploaded files under listings/{listingId}/
    try {
      const folderRef = storage().ref(`listings/${listingId}`);
      const fileList = await folderRef.listAll();
      await Promise.all(fileList.items.map((fileRef) => fileRef.delete().catch(() => {})));
    } catch (storageErr) {
      console.warn("Storage cleanup notice (non-fatal):", storageErr);
    }
  } catch (error) {
    console.error("Error deleting property listing:", error);
    throw error;
  }
}







