const firebaseConfig = {
  apiKey: "AIzaSyAdBYUf_RcZHPrVD1tsAiQt7q1l7lbbLp0",
  authDomain: "umiren-d6a66.firebaseapp.com",
  projectId: "umiren-d6a66",
  storageBucket: "umiren-d6a66.firebasestorage.app",
  messagingSenderId: "975924997372",
  appId: "1:975924997372:web:32da34e0a4f5efec3849f2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentRole = null;
let allCodes = [];
let allAgents = [];
let allAnnouncements = [];
let allListings = [];
let allFeedback = [];
let currentCodeFilter = "ALL";
let currentFeedbackStatusFilter = "ALL";
let lastGeneratedBatch = [];

// Real-Time Listeners Unsubscribers
let unsubCodes = null;
let unsubAgents = null;
let unsubAnnouncements = null;
let unsubListings = null;
let unsubFeedback = null;

// Toast helper
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = "show";
  setTimeout(() => { t.className = t.className.replace("show", ""); }, 3000);
}

// View switcher
function showView(viewId) {
  document.getElementById('view-login').style.display = viewId === 'view-login' ? 'block' : 'none';
  document.getElementById('view-claim').style.display = viewId === 'view-claim' ? 'block' : 'none';
  document.getElementById('view-dashboard').style.display = viewId === 'view-dashboard' ? 'block' : 'none';
}

// Section switcher with persistence
function switchDashboardSection(sectionId) {
  if (!sectionId) sectionId = 'approvals';
  if (sectionId === 'batch') {
    sectionId = 'codes';
    setTimeout(() => switchCodeGeneratorMode('batch'), 50);
  }
  localStorage.setItem('artha_admin_active_tab', sectionId);
  try { window.history.replaceState(null, '', '#' + sectionId); } catch(e) {}

  ['approvals', 'codes', 'broadcast', 'agents', 'listings', 'feedback'].forEach(s => {
    const sec = document.getElementById('section-' + s);
    const tab = document.getElementById('tab-btn-' + s);
    if (sec) sec.style.display = (s === sectionId) ? 'block' : 'none';
    if (tab) tab.classList.toggle('active', s === sectionId);
  });
}

function switchCodeGeneratorMode(mode) {
  const isBatch = mode === 'batch';
  const singleForm = document.getElementById('code-form-single');
  const batchForm = document.getElementById('code-form-batch');
  const singleBtn = document.getElementById('code-mode-btn-single');
  const batchBtn = document.getElementById('code-mode-btn-batch');
  const randomKeyBtn = document.getElementById('code-random-key-btn');

  if (singleForm) singleForm.style.display = isBatch ? 'none' : 'block';
  if (batchForm) batchForm.style.display = isBatch ? 'block' : 'none';
  if (singleBtn) singleBtn.classList.toggle('active', !isBatch);
  if (batchBtn) batchBtn.classList.toggle('active', isBatch);
  if (randomKeyBtn) randomKeyBtn.style.display = isBatch ? 'none' : 'inline-block';
}

function restoreActiveTab() {
  const hash = (window.location.hash || '').replace('#', '').toLowerCase();
  const validTabs = ['approvals', 'codes', 'broadcast', 'agents', 'listings', 'feedback'];
  let targetTab = 'approvals';
  if (hash === 'batch') {
    targetTab = 'codes';
    setTimeout(() => switchCodeGeneratorMode('batch'), 50);
  } else if (validTabs.includes(hash)) {
    targetTab = hash;
  } else {
    const saved = localStorage.getItem('artha_admin_active_tab');
    if (validTabs.includes(saved)) {
      targetTab = saved;
    }
  }
  switchDashboardSection(targetTab);
}

// Server-side Passcode Verification via Cloud Function
async function unlockWithPasscode() {
  const input = document.getElementById('passcode-input');
  const entered = input ? input.value.trim() : '';
  if (!entered) return alert("Please enter the Access Code");

  const btn = document.querySelector('#view-login .btn-primary');
  const origText = btn ? btn.textContent : 'Sign In';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verifying...';
  }

  try {
    const res = await fetch('https://verifyadminaccesscode-qmzvmlyqza-uc.a.run.app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: entered })
    });

    const data = await res.json();
    if (!res.ok || !data.sessionToken) {
      throw new Error(data.error || 'Invalid Access Code');
    }

    // Strict sessionStorage: Persists on page refresh, automatically wiped on browser/tab close
    sessionStorage.setItem('artha_admin_unlocked', 'true');
    sessionStorage.setItem('artha_admin_session_token', data.sessionToken);
    if (data.firebaseCustomToken) {
      sessionStorage.setItem('artha_admin_custom_token', data.firebaseCustomToken);
      try {
        await auth.signInWithCustomToken(data.firebaseCustomToken);
      } catch (authErr) {
        console.warn('Custom token sign-in fallback:', authErr);
        if (!auth.currentUser) {
          await auth.signInAnonymously().catch(() => {});
        }
      }
    } else if (!auth.currentUser) {
      await auth.signInAnonymously().catch(() => {});
    }
    try {
      localStorage.removeItem('artha_admin_unlocked');
      localStorage.removeItem('artha_admin_session_token');
    } catch(e) {}

    document.documentElement.classList.add('artha-unlocked');
    document.getElementById('auth-nav').style.display = 'block';
    document.getElementById('user-email-display').textContent = 'Super Admin';
    showView('view-dashboard');
    restoreActiveTab();
    startRealtimeListeners();
    showToast("✓ Signed in successfully");
  } catch (err) {
    alert("❌ " + (err.message || "Invalid Access Code. Please try again."));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

// Auto unlock on refresh if active in current browser session
if (sessionStorage.getItem('artha_admin_unlocked') === 'true') {
  document.documentElement.classList.add('artha-unlocked');
  document.getElementById('auth-nav').style.display = 'block';
  document.getElementById('user-email-display').textContent = 'Super Admin';
  showView('view-dashboard');
  restoreActiveTab();

  // Re-establish Firebase Auth THEN start listeners (auth must settle first for Firestore reads)
  const savedToken = sessionStorage.getItem('artha_admin_custom_token');
  const authReady = savedToken
    ? auth.signInWithCustomToken(savedToken).catch(() => auth.signInAnonymously().catch(() => null))
    : auth.signInAnonymously().catch(() => null);

  authReady.then(() => {
    startRealtimeListeners();
  });
}

// Google Sign-In
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      alert("Google Sign-In failed: " + err.message);
    }
  }
}

// Email/Password Sign-In
async function signInWithEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) return alert("Please enter both email and password.");

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    alert("Sign In failed: " + err.message);
  }
}

// Claim Elevation via Server-Side Check
async function claimAdminElevation() {
  const entered = document.getElementById('claim-secret-key').value.trim();
  if (!entered) return alert("Please enter the Access Code");

  try {
    const res = await fetch('https://verifyadminaccesscode-qmzvmlyqza-uc.a.run.app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: entered })
    });

    const data = await res.json();
    if (!res.ok || (!data.sessionToken && !data.token && !data.success)) {
      throw new Error(data.error || "Invalid Access Code");
    }

    if (data.sessionToken) {
      sessionStorage.setItem('artha_admin_session_token', data.sessionToken);
    }

    if (data.firebaseCustomToken && (!currentUser || currentUser.isAnonymous)) {
      await auth.signInWithCustomToken(data.firebaseCustomToken);
    } else if (currentUser) {
      await db.collection('users').doc(currentUser.uid).set({
        role: 'admin',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    currentRole = 'admin';
    sessionStorage.setItem('artha_admin_unlocked', 'true');
    document.documentElement.classList.add('artha-unlocked');
    showView('view-dashboard');
    restoreActiveTab();
    startRealtimeListeners();
    showToast("👑 Admin role granted!");
  } catch (err) {
    alert("❌ " + (err.message || "Failed to verify Access Code"));
  }
}

// Logout
function handleLogout() {
  sessionStorage.removeItem('artha_admin_unlocked');
  sessionStorage.removeItem('artha_admin_session_token');
  try {
    localStorage.removeItem('artha_admin_unlocked');
    localStorage.removeItem('artha_admin_session_token');
    localStorage.removeItem('artha_admin_active_tab');
  } catch(e) {}
  document.documentElement.classList.remove('artha-unlocked');
  auth.signOut();
  window.history.replaceState(null, '', '/admin');
  window.location.reload();
}

// Auth State Listener
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    document.getElementById('auth-nav').style.display = 'block';
    document.getElementById('user-email-display').textContent = user.displayName || user.email || 'Super Admin';

    try {
      const tokenResult = await user.getIdTokenResult().catch(() => ({ claims: {} }));
      const hasAdminClaim = tokenResult.claims.role === 'admin' || tokenResult.claims.admin === true || tokenResult.claims.isSuperAdmin === true;
      const userDoc = await db.collection('users').doc(user.uid).get().catch(() => null);
      const hasAdminDoc = userDoc && userDoc.exists && userDoc.data().role === 'admin';

      if (hasAdminClaim || hasAdminDoc || user.uid === 'super_admin_web_portal' || user.uid === 'admin_super_portal' ||
          (sessionStorage.getItem('artha_admin_unlocked') === 'true' && sessionStorage.getItem('artha_admin_session_token'))) {
        currentRole = 'admin';
        sessionStorage.setItem('artha_admin_unlocked', 'true');
        document.documentElement.classList.add('artha-unlocked');
        showView('view-dashboard');
        restoreActiveTab();
        startRealtimeListeners();
      } else {
        showView('view-claim');
      }
    } catch (err) {
      console.warn('Could not verify admin role:', err);
      showView('view-claim');
    }
  } else {
    // Check if unlocked via current browser session
    const isUnlocked = sessionStorage.getItem('artha_admin_unlocked') === 'true';
    if (isUnlocked) {
      document.documentElement.classList.add('artha-unlocked');
      document.getElementById('auth-nav').style.display = 'block';
      document.getElementById('user-email-display').textContent = 'Super Admin';
      showView('view-dashboard');
      restoreActiveTab();
      startRealtimeListeners();
      return;
    }

    document.getElementById('auth-nav').style.display = 'none';
    sessionStorage.removeItem('artha_admin_unlocked');
    sessionStorage.removeItem('artha_admin_session_token');
    document.documentElement.classList.remove('artha-unlocked');
    showView('view-login');
    stopRealtimeListeners();
  }
});

// Realtime Listeners
function startRealtimeListeners() {
  stopRealtimeListeners();

  // 1. Invite Codes
  unsubCodes = db.collection('invite_codes').onSnapshot(snapshot => {
    allCodes = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      allCodes.push(d);
    });
    allCodes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const activeCount = allCodes.filter(c => c.status === 'ACTIVE').length;
    const usedCount = allCodes.filter(c => c.status === 'USED').length;

    const activeEl = document.getElementById('stat-active-codes');
    const badgeEl = document.getElementById('badge-active-codes');
    const usedEl = document.getElementById('stat-used-codes');

    if (activeEl) activeEl.textContent = activeCount;
    if (badgeEl) badgeEl.textContent = activeCount;
    if (usedEl) usedEl.textContent = usedCount;

    renderCodesTable();
  }, err => console.error("Codes listener error:", err));

  // 2. Registered Agents & Pending Approvals
  unsubAgents = db.collection('users').onSnapshot(snapshot => {
    allAgents = [];
    snapshot.forEach(doc => {
      if (doc.id.startsWith('super_admin') || doc.id.startsWith('system_')) return;
      const d = doc.data();
      // Ignore temporary unauthenticated device sessions
      if (!d.displayName && !d.email && !d.phoneNumber && !d.registeredWithCode && !d.role) return;
      d.uid = doc.id;
      allAgents.push(d);
    });
    allAgents.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));

    const pendingList = allAgents.filter(a => a.role !== 'admin' && a.status === 'PENDING_APPROVAL');
    const registeredAgentsList = allAgents.filter(a => a.status !== 'PENDING_APPROVAL' && a.status !== 'REJECTED');

    const pendingStatEl = document.getElementById('stat-pending-count');
    const pendingBadgeEl = document.getElementById('badge-pending-approvals');
    const agentsEl = document.getElementById('stat-agents-count');
    const badgeEl = document.getElementById('badge-agents');

    if (pendingStatEl) pendingStatEl.textContent = pendingList.length;
    if (pendingBadgeEl) pendingBadgeEl.textContent = pendingList.length;
    if (agentsEl) agentsEl.textContent = registeredAgentsList.length;
    if (badgeEl) badgeEl.textContent = registeredAgentsList.length;

    renderPendingApprovalsTable();
    renderAgentsTable();
  }, err => console.error("Agents listener error:", err));

  // 3. Announcements
  unsubAnnouncements = db.collection('announcements').onSnapshot(snapshot => {
    allAnnouncements = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.docId = doc.id;
      allAnnouncements.push(d);
    });
    allAnnouncements.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const countEl = document.getElementById('stat-announcements-count');
    const badgeEl = document.getElementById('badge-announcements');
    if (countEl) countEl.textContent = allAnnouncements.length;
    if (badgeEl) badgeEl.textContent = allAnnouncements.length;

    renderAnnouncementsTable();
  }, err => console.error("Announcements listener error:", err));

  // 4. Master Listings
  unsubListings = db.collection('publicListings').onSnapshot(snapshot => {
    allListings = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      allListings.push(d);
    });
    allListings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const listingsEl = document.getElementById('stat-listings-count');
    const badgeEl = document.getElementById('badge-listings');
    if (listingsEl) listingsEl.textContent = allListings.length;
    if (badgeEl) badgeEl.textContent = allListings.length;

    renderListingsTable();
  }, err => console.error("Listings listener error:", err));

  // 5. Feedback & Bug Reports
  unsubFeedback = db.collection('feedback').onSnapshot(snapshot => {
    allFeedback = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      allFeedback.push(d);
    });

    // Safe numeric timestamp comparator
    const getMs = (val) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (val.toMillis) return val.toMillis();
      if (val.seconds) return val.seconds * 1000;
      const parsed = Date.parse(val);
      return isNaN(parsed) ? 0 : parsed;
    };
    allFeedback.sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));

    const pendingCount = allFeedback.filter(f => !f.status || f.status === 'pending').length;
    const progressCount = allFeedback.filter(f => f.status === 'in-progress').length;
    const resolvedCount = allFeedback.filter(f => f.status === 'resolved').length;

    const countEl = document.getElementById('stat-feedback-count');
    const badgeEl = document.getElementById('badge-feedback');
    const fbCountAll = document.getElementById('fb-count-all');
    const fbCountPending = document.getElementById('fb-count-pending');
    const fbCountProgress = document.getElementById('fb-count-progress');
    const fbCountResolved = document.getElementById('fb-count-resolved');

    if (countEl) countEl.textContent = allFeedback.length;
    if (badgeEl) badgeEl.textContent = pendingCount;
    if (fbCountAll) fbCountAll.textContent = allFeedback.length;
    if (fbCountPending) fbCountPending.textContent = pendingCount;
    if (fbCountProgress) fbCountProgress.textContent = progressCount;
    if (fbCountResolved) fbCountResolved.textContent = resolvedCount;

    renderFeedbackTable();
  }, err => console.error("Feedback listener error:", err));
}

function stopRealtimeListeners() {
  if (unsubCodes) { unsubCodes(); unsubCodes = null; }
  if (unsubAgents) { unsubAgents(); unsubAgents = null; }
  if (unsubAnnouncements) { unsubAnnouncements(); unsubAnnouncements = null; }
  if (unsubListings) { unsubListings(); unsubListings = null; }
  if (unsubFeedback) { unsubFeedback(); unsubFeedback = null; }
}

// Code Generator Helpers
function generateRandomCodeInput() {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const input = document.getElementById('gen-code');
  if (input) input.value = code;
}

async function handleCreateInviteCode() {
  let code = (document.getElementById('gen-code')?.value || '').trim().toUpperCase();
  const type = document.getElementById('gen-type')?.value || 'single';
  const notes = (document.getElementById('gen-notes')?.value || '').trim();

  if (!code) {
    generateRandomCodeInput();
    code = (document.getElementById('gen-code')?.value || '').trim().toUpperCase();
  }

  try {
    const isMaster = type === 'master' || type === 'team';
    const codeType = type === 'admin' ? 'ADMIN' : (isMaster ? 'TEAM' : 'AGENT');

    const docRef = db.collection('invite_codes').doc(code);
    await docRef.set({
      code: code,
      type: codeType,
      isMaster: isMaster,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      notes: notes || 'Single Invite',
      batchNotes: notes || 'Single Invite',
      createdBy: (currentUser && currentUser.email) ? currentUser.email : 'Super Admin',
      usedBy: null,
      usedByUid: null,
      usedByEmail: null,
    });

    const shareEl = document.getElementById('share-card');
    const codeText = document.getElementById('share-code-text');
    const previewText = document.getElementById('share-preview-text');

    if (codeText) codeText.textContent = code;
    if (previewText) {
      previewText.innerHTML = '🔑 Code: <strong>' + code + '</strong><br>📲 Download: https://artharen.web.app/';
    }
    if (shareEl) shareEl.style.display = 'block';

    if (document.getElementById('gen-code')) document.getElementById('gen-code').value = '';
    if (document.getElementById('gen-notes')) document.getElementById('gen-notes').value = '';

    showToast("🎉 Invite code created!");
  } catch (err) {
    alert("Failed to create code: " + err.message);
  }
}

function copyShareMessage() {
  const code = document.getElementById('share-code-text')?.textContent || '';
  if (!code) return;
  const msg = "🔑 *ARTHA AGENT INVITE CODE*\n\nYour registration code: `" + code + "`\n\n📲 *Download Artha APK:*\nhttps://artharen.web.app/\n\n*Instructions:*\n1. Install app & open\n2. Tap 'Daftar Akaun Baru'\n3. Enter your unique invite code above.";
  navigator.clipboard.writeText(msg).then(() => {
    showToast("📋 Copied WhatsApp invite!");
  });
}

function openWhatsAppShare() {
  const code = document.getElementById('share-code-text')?.textContent || '';
  if (!code) return;
  const msg = "🔑 *ARTHA AGENT INVITE CODE*\n\nYour registration code: `" + code + "`\n\n📲 *Download Artha APK:*\nhttps://artharen.web.app/";
  window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg), '_blank');
}

function setCodesFilter(status, btn) {
  currentCodeFilter = status;
  const tabBtns = document.querySelectorAll('#section-codes .tabs-row .tab-btn');
  tabBtns.forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCodesTable();
}

function renderCodesTable() {
  const tbody = document.getElementById('codes-table-body');
  if (!tbody) return;

  let filtered = allCodes;
  if (currentCodeFilter !== 'ALL') {
    filtered = filtered.filter(c => c.status === currentCodeFilter);
  }

  const q = (document.getElementById('filter-code-input')?.value || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(c => (c.code && c.code.toLowerCase().includes(q)) || (c.batchNotes && c.batchNotes.toLowerCase().includes(q)) || (c.notes && c.notes.toLowerCase().includes(q)));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 24px;">No invite codes matching this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const date = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-';
    const statusBadge = c.status === 'ACTIVE'
      ? '<span class="badge badge-active">🟢 Active</span>'
      : c.status === 'USED'
      ? '<span class="badge badge-used">🔵 Used</span>'
      : '<span class="badge badge-revoked">⛔ Revoked</span>';

    const isTeam = c.isMaster || c.type === 'TEAM' || c.type === 'MASTER' || c.type === 'master';
    const typeBadge = c.type === 'ADMIN'
      ? '<span class="badge badge-admin">👑 Admin</span>'
      : isTeam
      ? '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #C084FC; font-weight: 700; border: 1px solid rgba(168, 85, 247, 0.3);">👥 Team (Multi-Use)</span>'
      : '<span class="badge badge-used">Agent</span>';

    const claimedBy = c.usedByName
      ? (c.usedByName + (c.usedBy ? '<br><span style="font-size: 11px; color: var(--text-dim);">' + c.usedBy + '</span>' : ''))
      : (c.usedBy || c.usedByEmail || (c.usedByUid ? 'User (' + c.usedByUid.substring(0,6) + '...)' : '-'));

    return '<tr>' +
      '<td><span class="code-pill" onclick="copySingleCode(\'' + c.code + '\')">' + c.code + '</span></td>' +
      '<td>' + typeBadge + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td style="color: var(--text-muted);">' + date + '</td>' +
      '<td style="color: var(--text-muted);">' + claimedBy + '</td>' +
      '<td style="color: var(--text-muted);">' + (c.batchNotes || c.notes || '-') + '</td>' +
      '<td style="text-align: right;">' +
        '<div class="action-btn-group">' +
          '<button class="btn-icon-action" onclick="copySingleCode(\'' + c.code + '\')">📋 Copy</button>' +
          (c.status === 'ACTIVE' ? '<button class="btn-warning-action" style="padding: 4px 8px; font-size: 11px; background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; cursor: pointer;" onclick="handleRevokeCode(\'' + c.id + '\', \'' + c.code + '\')">Revoke</button>' : '') +
          '<button class="btn-danger-action" style="padding: 4px 8px; font-size: 11px;" onclick="handleDeleteSingleCode(\'' + (c.code || c.id) + '\')" title="Delete Code Permanently">🗑️</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function copySingleCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast("📋 Copied: " + code);
  }).catch(() => {
    prompt("Copy code:", code);
  });
}

async function handleRevokeCode(id, code) {
  const targetCode = code || id;
  if (!confirm("Revoke invite code '" + targetCode + "'?\n\nAgents will no longer be able to register with this code.")) return;
  try {
    await db.collection('invite_codes').doc(targetCode).update({ status: 'REVOKED' });
    showToast("Code '" + targetCode + "' revoked.");
  } catch (err) {
    alert("Failed to revoke: " + err.message);
  }
}

async function handleDeleteSingleCode(code) {
  if (!confirm("Permanently delete invite code '" + code + "' from Firestore?")) return;
  try {
    await db.collection('invite_codes').doc(code).delete();
    showToast("🗑️ Code '" + code + "' deleted permanently.");
  } catch (err) {
    alert("Failed to delete: " + err.message);
  }
}

async function purgeClaimedCodes() {
  if (!confirm("Clean all USED and REVOKED codes from database?")) return;
  const toDelete = allCodes.filter(c => c.status === 'USED' || c.status === 'REVOKED');
  if (toDelete.length === 0) return alert("No used or revoked codes to clean.");
  const batch = db.batch();
  toDelete.forEach(c => batch.delete(db.collection('invite_codes').doc(c.code || c.id)));
  await batch.commit();
  showToast("Cleaned " + toDelete.length + " codes.");
}

// Batch Code Generator
async function handleBatchGenerateCodes() {
  const prefix = (document.getElementById('batch-prefix')?.value || '').trim().toUpperCase();
  const count = parseInt(document.getElementById('batch-count')?.value || '10');
  const notes = (document.getElementById('batch-notes')?.value || '').trim() || 'Batch Intake';

  const generated = [];
  const batch = db.batch();

  for (let i = 0; i < count; i++) {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = prefix ? (prefix + randomSuffix) : randomSuffix;
    const ref = db.collection('invite_codes').doc(code);
    batch.set(ref, {
      code: code,
      type: 'AGENT',
      isMaster: false,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      batchNotes: notes,
      notes: notes,
      createdBy: (currentUser && currentUser.email) ? currentUser.email : 'Super Admin',
      usedBy: null,
      usedByUid: null,
      usedByEmail: null,
    });
    generated.push(code);
  }

  try {
    await batch.commit();
    lastGeneratedBatch = generated;
    const sumEl = document.getElementById('batch-summary-text');
    if (sumEl) sumEl.textContent = count + ' codes generated for "' + notes + '"';

    const pillContainer = document.getElementById('batch-pills-container');
    if (pillContainer) {
      pillContainer.innerHTML = generated.map(c => '<span class="code-pill" onclick="copySingleCode(\'' + c + '\')">' + c + '</span>').join('');
    }

    const card = document.getElementById('batch-output-card');
    if (card) card.style.display = 'block';

    showToast("🎲 Batch created: " + count + " codes!");
  } catch (err) {
    alert("Failed to generate batch: " + err.message);
  }
}

function copyBatchWhatsAppList() {
  if (!lastGeneratedBatch || lastGeneratedBatch.length === 0) return;
  const notes = (document.getElementById('batch-notes')?.value || '').trim() || 'Agent Intake';
  let msg = "*🔑 ARTHA AGENT INVITE CODES (" + notes + ")*\n\n";
  lastGeneratedBatch.forEach((c, idx) => {
    msg += (idx + 1) + ". `" + c + "`\n";
  });
  msg += "\n📲 *Download Artha APK:*\nhttps://artharen.web.app/\n\n*Instructions:*\n1. Install app & open\n2. Tap 'Daftar Akaun Baru'\n3. Enter your unique invite code above.";

  navigator.clipboard.writeText(msg).then(() => {
    showToast("📋 WhatsApp list copied to clipboard!");
  }).catch(() => {
    prompt("Copy list:", msg);
  });
}

function downloadBatchCSV() {
  if (!lastGeneratedBatch || lastGeneratedBatch.length === 0) return;
  const notes = (document.getElementById('batch-notes')?.value || '').trim() || 'Batch';
  let csvContent = "data:text/csv;charset=utf-8,Invite Code,Type,Status,Cohort,Created Date\n";
  const now = new Date().toLocaleDateString();
  lastGeneratedBatch.forEach(c => {
    csvContent += '"' + c + '","AGENT","ACTIVE","' + notes + '","' + now + '"\n';
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "artha_invite_codes_" + Date.now() + ".csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📥 CSV downloaded!");
}

// Broadcast Announcement
async function handleBroadcastAnnouncement() {
  const title = (document.getElementById('ann-title')?.value || '').trim();
  const type = document.getElementById('ann-type')?.value || 'GENERAL';
  const message = (document.getElementById('ann-message')?.value || '').trim();

  const titleEN = (document.getElementById('ann-title-en')?.value || title).trim();
  const titleBM = (document.getElementById('ann-title-bm')?.value || title).trim();
  const messageEN = (document.getElementById('ann-message-en')?.value || message).trim();
  const messageBM = (document.getElementById('ann-message-bm')?.value || message).trim();

  const finalTitle = titleEN || titleBM;
  const finalMsg = messageEN || messageBM;

  if (!finalTitle || !finalMsg) {
    return alert("Please enter announcement title and message details.");
  }

  try {
    const annId = "ann_" + Date.now();
    const newAnn = {
      id: annId,
      title: finalTitle,
      titleEN: titleEN || finalTitle,
      titleBM: titleBM || finalTitle,
      type: type,
      message: finalMsg,
      messageEN: messageEN || finalMsg,
      messageBM: messageBM || finalMsg,
      sentBy: (currentUser && currentUser.email) ? currentUser.email : 'Super Admin',
      createdAt: new Date().toISOString(),
    };

    await db.collection('announcements').doc(annId).set(newAnn);

    try {
      const pushUrl = "https://sendbroadcastpush-qmzvmlyqza-uc.a.run.app";
      const token = sessionStorage.getItem('artha_admin_session_token');
      if (token) {
        await fetch(pushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            titleEN: newAnn.titleEN,
            titleBM: newAnn.titleBM,
            messageEN: newAnn.messageEN,
            messageBM: newAnn.messageBM,
            type: type,
            sessionToken: token
          }),
        });
      }
    } catch (pushErr) {
      console.warn("[Broadcast] FCM push error:", pushErr);
    }

    if (document.getElementById('ann-title')) document.getElementById('ann-title').value = '';
    if (document.getElementById('ann-message')) document.getElementById('ann-message').value = '';
    if (document.getElementById('ann-title-en')) document.getElementById('ann-title-en').value = '';
    if (document.getElementById('ann-title-bm')) document.getElementById('ann-title-bm').value = '';
    if (document.getElementById('ann-message-en')) document.getElementById('ann-message-en').value = '';
    if (document.getElementById('ann-message-bm')) document.getElementById('ann-message-bm').value = '';

    showToast("🚀 Announcement broadcasted!");
  } catch (err) {
    alert("Failed to broadcast: " + err.message);
  }
}

function renderAnnouncementsTable() {
  const tbody = document.getElementById('announcements-table-body');
  if (!tbody) return;
  if (allAnnouncements.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 24px;">No announcements logged yet.</td></tr>';
    return;
  }

  tbody.innerHTML = allAnnouncements.map(ann => {
    const typeBadge = (ann.type || '').toUpperCase() === 'URGENT'
      ? '<span class="badge badge-revoked">🚨 Urgent</span>'
      : (ann.type || '').toUpperCase() === 'LISTING_ALERT'
      ? '<span class="badge badge-used">💼 Listing</span>'
      : (ann.type || '').toUpperCase() === 'COMMISSION'
      ? '<span class="badge badge-admin">🏆 Incentive</span>'
      : '<span class="badge badge-active">📢 General</span>';

    const sentDate = ann.createdAt ? new Date(ann.createdAt).toLocaleString() : '-';
    const docKey = ann.docId || ann.id || '';

    return '<tr>' +
      '<td><strong>' + (ann.title || ann.titleEN || 'Untitled') + '</strong></td>' +
      '<td>' + typeBadge + '</td>' +
      '<td style="color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + (ann.message || ann.messageEN || '') + '</td>' +
      '<td style="color: var(--text-muted);">' + sentDate + '</td>' +
      '<td style="color: var(--text-muted);">' + (ann.sentBy || 'Admin') + '</td>' +
      '<td style="text-align: right;">' +
        '<button class="btn-danger-action" title="Delete Announcement" onclick="handleDeleteAnnouncement(\'' + docKey + '\')">🗑️</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function handleDeleteAnnouncement(docId) {
  if (!confirm("Delete this broadcast announcement?")) return;
  try {
    const token = await getAdminApiAuthToken();
    const res = await fetch("https://admindeleteannouncement-qmzvmlyqza-uc.a.run.app", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? ('Bearer ' + token) : ''
      },
      body: JSON.stringify({ announcementId: docId, sessionToken: token })
    });
    if (!res.ok) {
      await db.collection('announcements').doc(docId).delete();
    }
    showToast("Announcement deleted.");
  } catch (err) {
    try {
      await db.collection('announcements').doc(docId).delete();
      showToast("Announcement deleted.");
    } catch (e) {
      alert("Failed to delete announcement: " + err.message);
    }
  }
}

// Pending Agent Approvals Desk
function renderPendingApprovalsTable() {
  const tbody = document.getElementById('pending-table-body');
  if (!tbody) return;
  const search = (document.getElementById('filter-pending-input')?.value || '').trim().toLowerCase();

  let pendingList = allAgents.filter(a => a.role !== 'admin' && a.status === 'PENDING_APPROVAL');
  if (search) {
    pendingList = pendingList.filter(a =>
      (a.displayName && a.displayName.toLowerCase().includes(search)) ||
      (a.email && a.email.toLowerCase().includes(search)) ||
      (a.registeredWithCode && a.registeredWithCode.toLowerCase().includes(search)) ||
      (a.requestNotes && a.requestNotes.toLowerCase().includes(search))
    );
  }

  if (pendingList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 32px;">🎉 <strong>All caught up!</strong> No pending agent registrations at this moment.</td></tr>';
    return;
  }

  tbody.innerHTML = pendingList.map(a => {
    const appliedDate = a.createdAt ? new Date(a.createdAt).toLocaleString() : (a.updatedAt ? new Date(a.updatedAt).toLocaleString() : '-');
    const initials = (a.displayName || 'A').split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase();

    const isDirect = !a.registeredWithCode || a.registeredWithCode === 'DIRECT_REQUEST';
    const methodBadge = isDirect
      ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; font-weight: 700;">📝 Direct Request</span>'
      : '<span class="code-pill" onclick="copySingleCode(\'' + a.registeredWithCode + '\')">' + a.registeredWithCode + '</span>';

    const notesText = a.requestNotes || (isDirect ? 'Direct Application' : 'Registered with invite code');

    return '<tr>' +
      '<td>' +
        '<div style="display: flex; align-items: center; gap: 10px;">' +
          '<div style="width: 34px; height: 34px; border-radius: 50%; background: rgba(245, 158, 11, 0.2); color: #F59E0B; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; border: 1px solid rgba(245, 158, 11, 0.35); flex-shrink: 0;">' + initials + '</div>' +
          '<div>' +
            '<div style="font-weight: 700; color: var(--text-main); font-size: 13.5px;">' + (a.displayName || 'Agent Applicant') + '</div>' +
            '<div style="font-size: 11px; color: var(--text-dim);">' + (a.phoneNumber || a.phone || '') + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td style="color: var(--text-muted);">' + (a.email || '-') + '</td>' +
      '<td style="color: var(--text-muted); font-size: 12px;">' + appliedDate + '</td>' +
      '<td>' + methodBadge + '</td>' +
      '<td style="color: var(--text-muted); font-size: 12px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + notesText + '</td>' +
      '<td style="text-align: right;">' +
        '<div class="action-btn-group">' +
          '<button class="btn-primary" style="padding: 6px 14px; font-size: 12px; background: #10B981; border-color: #10B981; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);" onclick="approveAgentWeb(\'' + a.uid + '\')">✅ Approve</button>' +
          '<button class="btn-danger-action" style="padding: 6px 12px;" onclick="rejectAgentWeb(\'' + a.uid + '\', \'' + (a.displayName || a.email || 'this agent') + '\')">❌ Reject</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function getAdminApiAuthToken() {
  let token = sessionStorage.getItem('artha_admin_session_token');
  if (!token && auth.currentUser) {
    token = await auth.currentUser.getIdToken().catch(() => null);
  }
  return token;
}

async function callAdminManageUser(action, uid, extra = {}) {
  const token = await getAdminApiAuthToken();
  const url = "https://adminmanageuser-qmzvmlyqza-uc.a.run.app";
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? ('Bearer ' + token) : ''
    },
    body: JSON.stringify({ action, uid, sessionToken: token, ...extra })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `Failed to ${action} user`);
  }
  return res.json();
}

async function rejectAgentWeb(uid, name) {
  if (!confirm("Are you sure you want to REJECT application for '" + name + "'?")) return;
  try {
    await callAdminManageUser('reject', uid);
    showToast("Application rejected.");
  } catch (err) {
    try {
      await db.collection('users').doc(uid).set({
        status: 'REJECTED',
        approved: false,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast("Application rejected.");
    } catch (e) {
      alert("Failed to reject application: " + err.message);
    }
  }
}

// Registered Agents
function renderAgentsTable() {
  const tbody = document.getElementById('agents-table-body');
  if (!tbody) return;
  const search = (document.getElementById('filter-agents-input')?.value || '').trim().toLowerCase();

  let filtered = allAgents.filter(a => a.status !== 'PENDING_APPROVAL' && a.status !== 'REJECTED');
  if (search) {
    filtered = filtered.filter(a =>
      (a.displayName && a.displayName.toLowerCase().includes(search)) ||
      (a.email && a.email.toLowerCase().includes(search))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 24px;">No agents found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const joinDate = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-';
    const codeUsed = a.registeredWithCode 
      ? '<span class="code-pill" onclick="copySingleCode(\'' + a.registeredWithCode + '\')">' + a.registeredWithCode + '</span>' 
      : '<span class="badge" style="background: rgba(148, 163, 184, 0.12); color: #94A3B8; font-weight: 600;">🏛️ Legacy</span>';
    const roleBadge = a.role === 'admin'
      ? '<span class="badge badge-admin">👑 Admin</span>'
      : '<span class="badge badge-used">Agent</span>';

    const isPending = a.role !== 'admin' && a.status === 'PENDING_APPROVAL';
    const isRejected = a.status === 'REJECTED';
    const isSuspended = a.status === 'SUSPENDED';
    const statusBadge = isPending
      ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; font-weight: 700;">⏳ Pending Approval</span>'
      : (isRejected
      ? '<span class="badge badge-revoked">❌ Rejected</span>'
      : (isSuspended
      ? '<span class="badge badge-suspended">⛔ Suspended</span>'
      : '<span class="badge badge-active">🟢 Active</span>'));

    const isSelf = currentUser && currentUser.uid === a.uid;

    return '<tr>' +
      '<td><strong>' + (a.displayName || 'Unnamed') + '</strong></td>' +
      '<td style="color: var(--text-muted);">' + (a.email || '-') + '</td>' +
      '<td style="color: var(--text-muted);">' + joinDate + '</td>' +
      '<td>' + codeUsed + '</td>' +
      '<td>' + roleBadge + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td style="text-align: right;">' +
        '<div class="action-btn-group">' +
          (!isSelf ? 
            (isPending ? '<button class="btn-icon-action" style="color: var(--success); font-weight: 700;" onclick="approveAgentWeb(\'' + a.uid + '\')">✅ Approve</button>' : '') +
            '<button class="btn-icon-action" onclick="toggleAgentRole(\'' + a.uid + '\', \'' + (a.role || 'agent') + '\')">' + (a.role === 'admin' ? 'Set as Agent' : '👑 Make Admin') + '</button>' +
            '<button class="btn-icon-action" style="color: ' + (isSuspended ? 'var(--success)' : 'var(--warning)') + ';" onclick="toggleAgentStatus(\'' + a.uid + '\', \'' + (a.status || 'ACTIVE') + '\')">' + (isSuspended ? '🟢 Activate' : '⛔ Suspend') + '</button>' +
            '<button class="btn-danger-action" title="Delete Agent Account" onclick="handleDeleteAgent(\'' + a.uid + '\', \'' + (a.email || a.displayName || 'this agent') + '\')">🗑️</button>'
            : '<span style="font-size: 11px; color: var(--text-dim); padding-right: 8px;">(You)</span>') +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function approveAgentWeb(uid) {
  try {
    await callAdminManageUser('approve', uid);
    showToast("Agent approved successfully! 🎉");
  } catch (err) {
    try {
      const now = new Date().toISOString();
      await db.collection('users').doc(uid).set({
        status: 'ACTIVE',
        approved: true,
        approvedAt: now,
        updatedAt: now
      }, { merge: true });
      showToast("Agent approved successfully! 🎉");
    } catch (e) {
      alert("Failed to approve agent: " + err.message);
    }
  }
}

async function toggleAgentRole(uid, currentRole) {
  const newRole = currentRole === 'admin' ? 'agent' : 'admin';
  try {
    await callAdminManageUser('updateRole', uid, { role: newRole });
    showToast("Agent role updated to " + newRole);
  } catch (err) {
    try {
      await db.collection('users').doc(uid).update({ role: newRole });
      showToast("Agent role updated to " + newRole);
    } catch (e) {
      alert("Failed to update role: " + err.message);
    }
  }
}

async function toggleAgentStatus(uid, currentStatus) {
  const newStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
  const action = newStatus === 'SUSPENDED' ? 'suspend' : 'activate';
  try {
    await callAdminManageUser(action, uid);
    showToast("Agent account " + (newStatus === 'SUSPENDED' ? 'suspended' : 'activated'));
  } catch (err) {
    try {
      await db.collection('users').doc(uid).update({ status: newStatus });
      showToast("Agent account " + (newStatus === 'SUSPENDED' ? 'suspended' : 'activated'));
    } catch (e) {
      alert("Failed to update status: " + err.message);
    }
  }
}

async function handleDeleteAgent(uid, identifier) {
  if (!confirm("Are you sure you want to PERMANENTLY DELETE agent '" + identifier + "'?\n\nThis will remove their profile record AND Firebase Auth login account.")) return;
  try {
    await callAdminManageUser('delete', uid);
    showToast("Agent '" + identifier + "' deleted successfully");
  } catch (err) {
    try {
      await db.collection('users').doc(uid).delete();
      showToast("Agent '" + identifier + "' deleted from Firestore.");
    } catch (e) {
      alert("Failed to delete agent: " + err.message);
    }
  }
}

// Master Listings Helpers & Resolvers
function resolveAgent(l) {
  let name = '';
  let phone = '';
  let email = '';

  const uid = l.userId || l.agentId;
  if (uid && Array.isArray(allAgents)) {
    const matched = allAgents.find(a => a.uid === uid || a.id === uid);
    if (matched) {
      name = matched.displayName || matched.name || '';
      phone = matched.phoneNumber || matched.phone || matched.tel || '';
      email = matched.email || '';
    }
  }

  // Fallback to listing author/creator fields
  if (!name) name = l.authorName || l.userName || l.agentName || l.namaEjen || l.namaOwner || 'Agent';
  if (!phone) phone = l.agentPhone || l.telEjen || l.telOwner || l.phone || l.contact || '';
  if (!email) email = l.agentEmail || '';

  if (!phone && (l.description || l.tajuk)) {
    const text = (l.description || '') + ' ' + (l.tajuk || '');
    const m = text.match(/(?:01[0-9]-?[0-9]{7,8}|601[0-9]-?[0-9]{7,8})/);
    if (m) phone = m[0];
  }

  const externalSource = (l.agentName && l.agentName !== name) ? l.agentName : (l.namaOwner && l.namaOwner !== name ? l.namaOwner : '');

  return {
    name: name || 'Agent',
    phone: phone.replace(/[^0-9]/g, ''),
    rawPhone: phone,
    email: email || '-',
    externalSource: externalSource
  };
}

function extractCleanTitle(l) {
  const full = (l.tajuk || l.description || 'Property Listing').trim();
  const firstLine = full.split('\n')[0].trim();
  if (firstLine.length < 5 && full.length > 5) {
    return full.substring(0, 80);
  }
  return firstLine.substring(0, 90);
}

function getPrimaryImage(l) {
  if (l.imageUrl && typeof l.imageUrl === 'string') return l.imageUrl;
  if (Array.isArray(l.images) && l.images[0]) return l.images[0];
  if (Array.isArray(l.gambar) && l.gambar[0]) return l.gambar[0];
  return null;
}

function getAllImages(l) {
  const list = [];
  if (l.imageUrl && typeof l.imageUrl === 'string') list.push(l.imageUrl);
  if (Array.isArray(l.images)) {
    l.images.forEach(img => { if (img && !list.includes(img)) list.push(img); });
  }
  if (Array.isArray(l.gambar)) {
    l.gambar.forEach(img => { if (img && !list.includes(img)) list.push(img); });
  }
  return list;
}

async function handleQuickStatusChange(listingId, newStatus) {
  try {
    const now = new Date().toISOString();
    let updated = false;

    // 1. Try server-side admin endpoint (bypasses rules using Admin SDK)
    try {
      const token = sessionStorage.getItem('artha_admin_session_token');
      if (token) {
        const res = await fetch('https://us-central1-umiren-d6a66.cloudfunctions.net/adminUpdateListingStatus', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ listingId, status: newStatus, sessionToken: token })
        });
        if (res.ok) {
          updated = true;
        }
      }
    } catch(fetchErr) {
      console.warn("Direct function endpoint warning, attempting client SDK:", fetchErr);
    }

    // 2. Client SDK update (if server endpoint unavailable or as complementary sync)
    if (!updated) {
      await db.collection('publicListings').doc(listingId).update({ status: newStatus, updatedAt: now });
      try {
        await db.collection('listings').doc(listingId).update({ status: newStatus, updatedAt: now });
      } catch(e) {}
    }

    showToast("Listing status updated to " + newStatus);
  } catch (err) {
    alert("Failed to update status: " + err.message);
  }
}

let currentModalListing = null;

function openListingModal(listingId) {
  const l = allListings.find(item => item.id === listingId);
  if (!l) return;
  currentModalListing = l;

  const agent = resolveAgent(l);
  const cleanTitle = extractCleanTitle(l);
  const priceFmt = l.harga ? 'RM ' + Number(l.harga).toLocaleString() : 'Negotiable';
  const estMonthly = l.harga ? 'Est. RM ' + Math.round(Number(l.harga) * 0.0045).toLocaleString() + ' / mo (30 yrs @ 4%)' : '';
  const images = getAllImages(l);

  document.getElementById('modal-listing-title').textContent = cleanTitle;
  document.getElementById('modal-listing-price').textContent = priceFmt;
  document.getElementById('modal-listing-loan').textContent = estMonthly;
  document.getElementById('modal-listing-type').textContent = l.jenis || l.jenisHartanah || l.propertyType || 'Property';

  const statusEl = document.getElementById('modal-listing-status');
  statusEl.textContent = l.status || 'Aktif';
  statusEl.className = 'badge ' + (l.status === 'Sold' ? 'badge-revoked' : l.status === 'Booking' ? 'badge-admin' : 'badge-active');

  const addr = [l.alamat, l.daerah, l.negeri].filter(Boolean).join(', ') || l.lokasi || 'Address on request';
  document.getElementById('modal-listing-address').innerHTML = '📍 ' + addr;

  const specs = [];
  if (l.bilikTidur) specs.push('🛏️ ' + l.bilikTidur + ' Bedrooms');
  if (l.bilikAir) specs.push('🚿 ' + l.bilikAir + ' Bathrooms');
  if (l.keluasan) specs.push('📐 ' + l.keluasan + ' sqft');
  if (l.pegangan) specs.push('📜 ' + l.pegangan);
  if (l.lot) specs.push('🏷️ ' + l.lot);
  document.getElementById('modal-specs-pills').innerHTML = specs.map(s => '<span class="spec-pill">' + s + '</span>').join('');

  document.getElementById('modal-agent-name').textContent = agent.name + (agent.externalSource ? ' (Source: ' + agent.externalSource + ')' : '');
  document.getElementById('modal-agent-email').textContent = agent.email + (agent.rawPhone ? ' • ' + agent.rawPhone : '');

  const waBtnContainer = document.getElementById('modal-agent-contact-btn');
  if (agent.phone) {
    const formattedPhone = agent.phone.startsWith('6') ? agent.phone : ('6' + agent.phone);
    const waUrl = 'https://wa.me/' + formattedPhone + '?text=' + encodeURIComponent('Halo ' + agent.name + ', saya nak inquiry tentang listing: ' + cleanTitle);
    waBtnContainer.innerHTML = '<a href="' + waUrl + '" target="_blank" class="btn-whatsapp">💬 WhatsApp Agent</a>';
  } else {
    waBtnContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-dim);">No Phone Listed</span>';
  }

  const galleryEl = document.getElementById('modal-gallery');
  if (images.length > 0) {
    galleryEl.style.display = 'flex';
    galleryEl.innerHTML = images.map(img => '<img src="' + img + '" style="width: 120px; height: 90px; border-radius: 10px; object-fit: cover; border: 1px solid var(--border-subtle); flex-shrink: 0; cursor: pointer;" onclick="window.open(\'' + img + '\', \'_blank\')" />').join('');
  } else {
    galleryEl.style.display = 'none';
  }

  document.getElementById('modal-copywriting-text').value = l.description || l.keterangan || l.tajuk || '';
  document.getElementById('listing-details-modal').classList.add('active');
}

function closeListingModal() {
  document.getElementById('listing-details-modal').classList.remove('active');
  currentModalListing = null;
}

function copyModalCopywriting(btnEl) {
  const text = document.getElementById('modal-copywriting-text')?.value;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 Copywriting copied!");
    if (btnEl) {
      const orig = btnEl.innerHTML;
      btnEl.innerHTML = "✅ Copied!";
      btnEl.style.background = "#059669";
      btnEl.style.color = "#FFF";
      setTimeout(() => {
        btnEl.innerHTML = orig;
        btnEl.style.background = "";
        btnEl.style.color = "";
      }, 2000);
    }
  });
}

// Master Listings Table Render
function renderListingsTable() {
  const tbody = document.getElementById('listings-table-body');
  if (!tbody) return;

  const search = (document.getElementById('filter-listing-input')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('filter-listing-status')?.value || 'ALL';

  let filtered = allListings;

  if (statusFilter !== 'ALL') {
    filtered = filtered.filter(l => (l.status || 'Aktif') === statusFilter);
  }

  if (search) {
    filtered = filtered.filter(l => {
      const title = (l.tajuk || l.description || '').toLowerCase();
      const loc = (l.alamat || l.daerah || l.negeri || l.lokasi || '').toLowerCase();
      const agent = (l.agentName || l.authorName || l.userName || '').toLowerCase();
      return title.includes(search) || loc.includes(search) || agent.includes(search);
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 24px;">No listings found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(l => {
    const priceFmt = l.harga ? 'RM ' + Number(l.harga).toLocaleString() : '-';
    const loc = [l.daerah, l.negeri].filter(Boolean).join(', ') || l.lokasi || '-';
    const pType = l.jenis || l.jenisHartanah || l.propertyType || 'Residential';
    const agent = resolveAgent(l);
    const cleanTitle = extractCleanTitle(l);
    const thumb = getPrimaryImage(l);

    const thumbHtml = thumb
      ? '<img src="' + thumb + '" class="listing-thumb" onclick="openListingModal(\'' + l.id + '\')" />'
      : '<div class="listing-thumb-fallback" onclick="openListingModal(\'' + l.id + '\')">🏡</div>';

    const specs = [];
    if (l.bilikTidur) specs.push('🛏️ ' + l.bilikTidur);
    if (l.bilikAir) specs.push('🚿 ' + l.bilikAir);
    if (l.keluasan) specs.push('📐 ' + l.keluasan + ' sqft');
    if (l.pegangan) specs.push(l.pegangan);

    const specsHtml = specs.length > 0
      ? '<div class="listing-specs">' + specs.map(s => '<span class="spec-pill">' + s + '</span>').join('') + '</div>'
      : '';

    const currentStatus = l.status || 'Aktif';

    const waBtn = agent.phone
      ? '<a href="https://wa.me/' + (agent.phone.startsWith('6') ? agent.phone : '6' + agent.phone) + '?text=' + encodeURIComponent('Halo ' + agent.name + ', saya berminat dengan listing: ' + cleanTitle) + '" target="_blank" class="btn-whatsapp">💬 WhatsApp</a>'
      : '<button class="btn-icon-action" onclick="openListingModal(\'' + l.id + '\')">👁️ View</button>';

    return '<tr>' +
      '<td>' +
        '<div class="listing-cell-main">' +
          thumbHtml +
          '<div class="listing-info">' +
            '<div class="listing-title" onclick="openListingModal(\'' + l.id + '\')">' + cleanTitle + '</div>' +
            specsHtml +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td style="color: #FDA4AF; font-weight: 800; font-size: 14px;">' + priceFmt + '</td>' +
      '<td style="color: var(--text-muted); font-size: 12px;">' + loc + '</td>' +
      '<td><span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #93C5FD;">' + pType + '</span></td>' +
      '<td>' +
        '<div style="font-weight: 700; color: var(--text-main);">' + agent.name + '</div>' +
        (agent.externalSource ? '<div style="font-size: 10px; color: #93C5FD; font-weight: 600;">(Source: ' + agent.externalSource + ')</div>' : '') +
        (agent.rawPhone ? '<div style="font-size: 11px; color: var(--text-dim);">' + agent.rawPhone + '</div>' : '') +
      '</td>' +
      '<td>' +
        '<select class="status-select" onchange="handleQuickStatusChange(\'' + l.id + '\', this.value)">' +
          '<option value="Aktif"' + (currentStatus === 'Aktif' ? ' selected' : '') + '>🟢 Aktif</option>' +
          '<option value="Booking"' + (currentStatus === 'Booking' ? ' selected' : '') + '>🟡 Booking</option>' +
          '<option value="Sold"' + (currentStatus === 'Sold' ? ' selected' : '') + '>🔴 Sold</option>' +
        '</select>' +
      '</td>' +
      '<td style="text-align: right;">' +
        '<div class="action-btn-group">' +
          waBtn +
          '<button class="btn-icon-action" onclick="openListingModal(\'' + l.id + '\')" title="View Full Details">👁️</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

// ==========================================
// SECTION 6: FEEDBACK & BUG DESK FUNCTIONS
// ==========================================

function setFeedbackStatusFilter(status, btn) {
  currentFeedbackStatusFilter = status;
  document.querySelectorAll('#section-feedback .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderFeedbackTable();
}

function renderFeedbackTable() {
  const tbody = document.getElementById('feedback-table-body');
  if (!tbody) return;

  const search = (document.getElementById('filter-feedback-input')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('filter-feedback-type')?.value || 'ALL';

  let filtered = allFeedback.filter(item => {
    // Status filter
    if (currentFeedbackStatusFilter === 'pending') {
      if (item.status && item.status !== 'pending') return false;
    } else if (currentFeedbackStatusFilter === 'in-progress') {
      if (item.status !== 'in-progress') return false;
    } else if (currentFeedbackStatusFilter === 'resolved') {
      if (item.status !== 'resolved' && item.status !== 'closed') return false;
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      if (item.type !== categoryFilter) return false;
    }

    // Search filter
    if (search) {
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const name = (item.userName || '').toLowerCase();
      const email = (item.userEmail || '').toLowerCase();
      const dev = (item.deviceModel || '').toLowerCase();
      return title.includes(search) || desc.includes(search) || name.includes(search) || email.includes(search) || dev.includes(search);
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 28px;">No feedback or bug tickets match the current filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const isBug = item.type === 'Bug';
    const isFeature = item.type === 'Feature';
    const isPerf = item.type === 'Performance';
    const typeColor = isBug ? '#EF4444' : (isFeature ? '#F59E0B' : (isPerf ? '#8B5CF6' : '#EC4899'));
    const typeLabel = isBug ? '🐛 Bug' : (isFeature ? '💡 Feature' : (isPerf ? '⚡ Performance' : '⭐ General'));

    const sev = item.severity || '';
    const sevColor = sev === 'Critical' ? '#EF4444' : (sev === 'High' ? '#F97316' : (sev === 'Medium' ? '#F59E0B' : '#3B82F6'));
    const sevBadge = sev
      ? '<span class="badge" style="background: ' + sevColor + '20; color: ' + sevColor + '; margin-top: 4px; display: inline-block;">' + sev.toUpperCase() + '</span>'
      : '';

    const agentPhone = item.userPhone || '';
    const waBtn = agentPhone
      ? '<button class="btn-whatsapp" style="padding: 4px 8px; font-size: 11px;" onclick="openWhatsAppAgent(\'' + agentPhone + '\', \'' + (item.userName || 'Agent').replace(/'/g, "\\'") + '\', \'' + (item.title || 'Feedback').replace(/'/g, "\\'") + '\')">💬 WA</button>'
      : '';

    const deviceStr = (item.deviceModel || '-') + ' (' + (item.osVersion || item.platform || 'Android') + ')';
    const versionStr = (item.appVersion ? (item.appVersion.startsWith('v') ? item.appVersion : 'v' + item.appVersion) : 'v1.5.2') + ' (b' + (item.buildNumber || '57') + ')';

    // Steps to reproduce
    let stepsHtml = '';
    if (item.stepsToReproduce && item.stepsToReproduce.length > 0) {
      stepsHtml = '<div style="margin-top: 6px; font-size: 11px; background: var(--bg-canvas); padding: 8px; border-radius: 8px; border: 1px solid var(--border-subtle);"><strong style="color: #FDA4AF;">Steps:</strong><ol style="margin-left: 16px; margin-top: 4px;">' +
        item.stepsToReproduce.map(s => '<li>' + s + '</li>').join('') +
        '</ol></div>';
    }

    if (item.expectedBehavior) {
      stepsHtml += '<div style="font-size: 11px; color: #10B981; margin-top: 4px;"><strong>Expected:</strong> ' + item.expectedBehavior + '</div>';
    }
    if (item.actualBehavior) {
      stepsHtml += '<div style="font-size: 11px; color: #EF4444; margin-top: 2px;"><strong>Actual:</strong> ' + item.actualBehavior + '</div>';
    }

    // Screenshot thumbnail
    const screenshotHtml = item.screenshotUrl
      ? '<div style="margin-top: 8px;"><img src="' + item.screenshotUrl + '" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle);" onclick="openFeedbackScreenshot(\'' + item.screenshotUrl + '\')" title="Click to enlarge screenshot" /></div>'
      : '';

    const currentStatus = item.status || 'pending';
    const adminReply = item.adminResponse || '';

    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' }) : '-';

    const ratingHtml = ((item.type === 'General' || item.type === 'rating') && item.rating)
      ? '<div style="font-size: 11px; color: #F59E0B; margin-top: 4px; font-weight: 700;">⭐ Rating: ' + item.rating + '/5</div>'
      : '';

    return '<tr id="fb-row-' + item.id + '">' +
      '<td>' +
        '<div style="font-weight: 800; color: ' + typeColor + '; font-size: 12px;">' + typeLabel + '</div>' +
        sevBadge +
        '<div style="font-size: 10px; color: var(--text-dim); margin-top: 4px;">' + dateStr + '</div>' +
      '</td>' +
      '<td>' +
        '<div style="font-weight: 700; color: var(--text-main); font-size: 13px;">' + (item.userName || 'Agent') + '</div>' +
        '<div style="font-size: 11px; color: var(--text-muted);">' + (item.userEmail || '-') + '</div>' +
        (agentPhone ? '<div style="margin-top: 4px;">' + waBtn + '</div>' : '') +
      '</td>' +
      '<td style="max-width: 280px;">' +
        '<div style="font-weight: 800; color: var(--text-main); font-size: 13px; margin-bottom: 4px;">' + (item.title || '(No Title)') + '</div>' +
        '<div style="font-size: 12px; color: var(--text-muted); line-height: 1.4; white-space: pre-wrap;">' + (item.description || '-') + '</div>' +
        ratingHtml +
      '</td>' +
      '<td>' +
        '<div style="font-size: 11px; color: var(--text-main); font-weight: 600;">' + deviceStr + '</div>' +
        '<div style="font-size: 10px; color: var(--text-dim);">' + versionStr + '</div>' +
      '</td>' +
      '<td style="max-width: 220px;">' +
        stepsHtml +
        screenshotHtml +
      '</td>' +
      '<td style="min-width: 220px;">' +
        '<div style="display: flex; gap: 6px; align-items: center; margin-bottom: 6px;">' +
          '<select class="status-select" style="padding: 4px 8px;" onchange="changeFeedbackStatus(\'' + item.id + '\', this.value)">' +
            '<option value="pending"' + (currentStatus === 'pending' ? ' selected' : '') + '>⏳ Pending</option>' +
            '<option value="in-progress"' + (currentStatus === 'in-progress' ? ' selected' : '') + '>🔄 In Progress</option>' +
            '<option value="resolved"' + (currentStatus === 'resolved' ? ' selected' : '') + '>✅ Resolved</option>' +
            '<option value="closed"' + (currentStatus === 'closed' ? ' selected' : '') + '>⛔ Closed</option>' +
          '</select>' +
        '</div>' +
        '<textarea id="reply-input-' + item.id + '" class="input-control" rows="2" style="font-size: 11px; padding: 6px 8px; width: 100%;" placeholder="Admin reply to agent...">' + adminReply + '</textarea>' +
        '<button class="btn-primary" style="padding: 4px 10px; font-size: 11px; margin-top: 4px; width: 100%; justify-content: center;" onclick="saveFeedbackReply(\'' + item.id + '\')">💾 Save & Send Reply</button>' +
      '</td>' +
      '<td style="text-align: right;">' +
        '<button class="btn-danger-action" onclick="deleteFeedbackDoc(\'' + item.id + '\')" title="Delete Ticket">🗑️</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function changeFeedbackStatus(feedbackId, newStatus) {
  try {
    const replyInput = document.getElementById('reply-input-' + feedbackId);
    const replyText = replyInput ? replyInput.value.trim() : '';

    const updateData = {
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    if (replyText) updateData.adminResponse = replyText;

    await db.collection('feedback').doc(feedbackId).update(updateData);
    showToast("✓ Status updated to " + newStatus);
  } catch (err) {
    alert("Failed to update status: " + err.message);
  }
}

async function saveFeedbackReply(feedbackId) {
  try {
    const replyInput = document.getElementById('reply-input-' + feedbackId);
    const replyText = replyInput ? replyInput.value.trim() : '';

    await db.collection('feedback').doc(feedbackId).update({
      adminResponse: replyText,
      updatedAt: new Date().toISOString()
    });
    showToast("✓ Admin reply saved and synced to agent!");
  } catch (err) {
    alert("Failed to save reply: " + err.message);
  }
}

async function deleteFeedbackDoc(feedbackId) {
  if (!confirm("Are you sure you want to permanently delete this feedback ticket from Firestore?")) return;
  try {
    await db.collection('feedback').doc(feedbackId).delete();
    showToast("🗑️ Ticket deleted successfully");
  } catch (err) {
    alert("Failed to delete ticket: " + err.message);
  }
}

function openFeedbackScreenshot(url) {
  const modal = document.getElementById('feedback-screenshot-modal');
  const img = document.getElementById('modal-screenshot-img');
  if (modal && img) {
    img.src = url;
    modal.classList.add('active');
  }
}

function closeFeedbackScreenshotModal() {
  const modal = document.getElementById('feedback-screenshot-modal');
  if (modal) modal.classList.remove('active');
}

function openWhatsAppAgent(phone, agentName, ticketTitle) {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '6' + cleanPhone : (cleanPhone.startsWith('6') ? cleanPhone : '60' + cleanPhone);
  const greeting = "Salam " + agentName + ", regarding your ticket in Artha (\"" + ticketTitle + "\"): ";
  window.open("https://wa.me/" + formattedPhone + "?text=" + encodeURIComponent(greeting), "_blank");
}

// Global UX Event Listeners
window.addEventListener('hashchange', restoreActiveTab);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeListingModal();
    closeFeedbackScreenshotModal();
  }
});

