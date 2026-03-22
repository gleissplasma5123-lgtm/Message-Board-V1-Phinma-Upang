/* ================= FIREBASE IMPORTS ================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= FIREBASE CONFIG ================= */

const firebaseConfig = {
  apiKey: "AIzaSyClCoyx02CYXzNbTve977ApxSEPuqS1xRQ",
  authDomain: "msgb-ac31f.firebaseapp.com",
  projectId: "msgb-ac31f",
  storageBucket: "msgb-ac31f.firebasestorage.app",
  messagingSenderId: "93924308933",
  appId: "1:93924308933:web:90ea96748040e03e97bdac",
  measurementId: "G-DE9WTZ08KQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= IMAGEKIT UPLOAD ================= */

async function uploadToImageKit(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", file.name);
  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa("public_YJcnOCqlESuiLxcybkWCsh5j+Ms=:") },
    body: formData
  });
  const data = await res.json();
  if (!data.url) { console.error("ImageKit upload failed", data); return null; }
  return data.url;
}

/* ================= ADMIN ================= */

const ADMIN_EMAILS = ["admin@test.com", "monje.0105@gmail.com"];
const isAdmin = () => ADMIN_EMAILS.includes(currentUser?.email);

/* ================= STATE ================= */

let currentUser;
let currentBoard;
let currentThread;
let allBoards = [];
let _saveThreadId = null;
let _saveThreadName = null;

/* ================= USER ICON CACHE ================= */

const userIconCache = {};

const iconMap = {
  default: { emoji: "👤", gradientClass: "gradient-default" },
  fire:    { emoji: "🔥", gradientClass: "gradient-fire" },
  star:    { emoji: "⭐", gradientClass: "gradient-star" },
  bolt:    { emoji: "⚡", gradientClass: "gradient-bolt" }
};

async function getUserIcon(email) {
  if (userIconCache[email]) return userIconCache[email];
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  const icon = !snap.empty ? (snap.docs[0].data().profileIcon || "default") : "default";
  const result = iconMap[icon] || iconMap["default"];
  userIconCache[email] = result;
  return result;
}

/* ================= SCREENS ================= */

const screens = [
  "loginScreen","registerScreen","userboardScreen","profileScreen",
  "threadScreen","messageScreen","notifScreen","adminScreen","collectionsScreen"
];

let previousScreen = "userboardScreen";

function show(id) {
  const current = sessionStorage.getItem("currentScreen");
  if (current && current !== id) {
    previousScreen = current;
    sessionStorage.setItem("previousScreen", current);
  }
  screens.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.add("hidden");
  });
  const target = document.getElementById(id);
  if (target) target.classList.remove("hidden");
  sessionStorage.setItem("currentScreen", id);
  if (currentBoard) sessionStorage.setItem("currentBoard", currentBoard);
  if (currentThread) sessionStorage.setItem("currentThread", currentThread);
  const boardTitleEl = document.getElementById("boardTitle");
  if (boardTitleEl) sessionStorage.setItem("boardTitle", boardTitleEl.textContent);
  const threadTitleEl = document.getElementById("threadTitle");
  if (threadTitleEl) sessionStorage.setItem("threadTitle", threadTitleEl.textContent);
}

function goBack() {
  const prev = sessionStorage.getItem("previousScreen") || "userboardScreen";
  show(prev);
  if (prev === "threadScreen" && currentBoard) loadThreads();
  else if (prev === "messageScreen" && currentThread) loadMessages();
  else if (prev === "profileScreen") loadProfile();
  else if (prev === "collectionsScreen") loadCollectionsScreen();
  else if (prev === "notifScreen") loadNotifications();
  else if (prev === "adminScreen") initAdminPanel();
}

/* ================= USERBOARD ================= */

function setGreeting() {
  const hour = new Date().getHours();
  let greeting = "Good morning 👋";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon 👋";
  else if (hour >= 17) greeting = "Good evening 👋";
  const el = document.getElementById("ubGreeting");
  if (el) el.textContent = greeting;
}

function populateUserboardUser(user) {
  getDocs(query(collection(db, "users"), where("uid", "==", user.uid))).then(snap => {
    let uname = user.email.split("@")[0];
    if (!snap.empty) uname = snap.docs[0].data().username || uname;
    const hiText = document.getElementById("ubHiText");
    if (hiText) hiText.textContent = "Hi, " + uname + "!";
    const sideUsername = document.getElementById("ubSideUsername");
    if (sideUsername) sideUsername.textContent = uname;
    const sideAvatar = document.getElementById("ubSideAvatar");
    if (sideAvatar) {
      sideAvatar.textContent = "👤";
      sideAvatar.className = "ub-user-card-avatar-circle gradient-default";
    }
  });
  if (isAdmin()) {
    const adminBtn = document.getElementById("ubGoAdmin");
    if (adminBtn) adminBtn.classList.remove("hidden");
    const collectionsBtn = document.getElementById("ubGoCategories");
    if (collectionsBtn) collectionsBtn.classList.add("hidden");
  }
}

function loadUserboardBoards() {
  const grid = document.getElementById("ubBoardsGrid");
  onSnapshot(query(collection(db, "boards"), orderBy("createdAt", "desc")), (snap) => {
    allBoards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    grid.innerHTML = "";
    if (allBoards.length === 0) {
      grid.innerHTML = '<div class="ub-empty">No boards found.</div>';
      return;
    }
    allBoards.forEach(b => {
      const card = document.createElement("div");
      card.className = "ub-board-card";
      card.style.position = "relative";
      card.innerHTML = `
        ${!isAdmin() ? `<button class="ub-board-report-btn" title="Report this board" style="position:absolute;top:8px;right:8px;width:24px!important;height:24px!important;padding:0!important;margin:0!important;border-radius:50%!important;border:none!important;background:rgba(0,0,0,0.06)!important;color:#aaa!important;font-size:13px!important;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">⋮</button>` : ""}
        <div class="ub-board-icon">📋</div>
        <div class="ub-board-name">${b.name}</div>
        <div class="ub-board-meta">by ${b.createBy || "unknown"}</div>
      `;
      if (!isAdmin()) {
        card.querySelector(".ub-board-report-btn")?.addEventListener("click", (e) => {
          e.stopPropagation();
          openBoardReportModal(b.id, b.name);
        });
      }
      card.onclick = (e) => {
        if (e.target.closest(".ub-board-report-btn")) return;
        currentBoard = b.id;
        document.getElementById("boardTitle").textContent = b.name;
        show("threadScreen");
        loadThreads();
      };
      grid.appendChild(card);
    });
  });
}

function initUserboard(user) {
  setGreeting();
  populateUserboardUser(user);
  loadUserboardBoards();
  loadSavedThreads();
  getDocs(query(collection(db, "users"), where("uid", "==", user.uid))).then(snap => {
    if (!snap.empty) applyIcon(snap.docs[0].data().profileIcon || "default");
  });
}

/* ================= COLLECTIONS ================= */

function openSaveCollectionModal(threadId, threadName) {
  _saveThreadId = threadId;
  _saveThreadName = threadName;
  document.getElementById("newCollectionInput").value = "";
  document.getElementById("saveCollectionModal").classList.remove("hidden");
  loadCollectionList();
}

async function loadCollectionList() {
  const list = document.getElementById("collectionList");
  list.innerHTML = '<div style="color:#bbb;font-size:13px;text-align:center;padding:8px;">Loading...</div>';
  const alreadySavedSnap = await getDocs(query(
    collection(db, "savedThreads"),
    where("threadId", "==", _saveThreadId),
    where("uid", "==", currentUser.uid)
  ));
  const alreadySavedIn = !alreadySavedSnap.empty ? alreadySavedSnap.docs[0].data().collection : null;
  list.innerHTML = "";
  if (alreadySavedIn) {
    const removeBox = document.createElement("div");
    removeBox.style.cssText = "background:#fff5f5;border:1.5px solid #ffd0d0;border-radius:12px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;gap:12px;";
    removeBox.innerHTML = `
      <span style="font-size:20px;">🔖</span>
      <div style="flex:1;"><div style="font-size:13px;font-weight:600;color:#555;">Currently saved in <strong style="color:#1A5849;">${alreadySavedIn}</strong></div></div>
      <button id="removeSaveBtn" style="width:auto!important;height:34px;padding:0 14px!important;border-radius:999px!important;border:none!important;background:#e53e3e!important;color:white!important;font-size:13px!important;font-weight:600;cursor:pointer;margin:0!important;flex-shrink:0;">Remove</button>
    `;
    list.appendChild(removeBox);
    document.getElementById("removeSaveBtn").addEventListener("click", () => unsaveThread());
  }
  const snap = await getDocs(query(collection(db, "savedCollections"), where("uid", "==", currentUser.uid)));
  if (snap.empty && !alreadySavedIn) {
    list.innerHTML += '<div style="color:#bbb;font-size:13px;text-align:center;padding:8px;">No collections yet. Create one below!</div>';
    return;
  }
  const cols = {};
  snap.forEach(d => {
    const name = d.data().name;
    if (!cols[name]) cols[name] = new Set();
    cols[name].add(d.data().threadId);
  });
  if (Object.keys(cols).length > 0) {
    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;";
    label.textContent = alreadySavedIn ? "Move to another collection:" : "Save to:";
    list.appendChild(label);
  }
  Object.entries(cols).forEach(([name, threadSet]) => {
    const isCurrentCollection = name === alreadySavedIn;
    const btn = document.createElement("button");
    btn.className = "collection-item";
    btn.innerHTML = `
      <span class="collection-item-icon">${isCurrentCollection ? "✅" : "📁"}</span>
      <span style="flex:1;text-align:left;">${name}</span>
      <span class="collection-item-count">${threadSet.size} saved</span>
    `;
    btn.addEventListener("click", () => { if (!isCurrentCollection) saveToCollection(name); });
    if (isCurrentCollection) btn.style.cursor = "default";
    list.appendChild(btn);
  });
}

async function unsaveThread() {
  const existing = await getDocs(query(collection(db, "savedThreads"), where("threadId", "==", _saveThreadId), where("uid", "==", currentUser.uid)));
  existing.forEach(async d => await deleteDoc(doc(db, "savedThreads", d.id)));
  const existingCol = await getDocs(query(collection(db, "savedCollections"), where("threadId", "==", _saveThreadId), where("uid", "==", currentUser.uid)));
  existingCol.forEach(async d => await deleteDoc(doc(db, "savedCollections", d.id)));
  document.getElementById("saveCollectionModal").classList.add("hidden");
  const btn = document.querySelector(`.th-save-btn[data-id="${_saveThreadId}"]`);
  if (btn) btn.classList.remove("saved");
  showToast("🗑️ Removed from saved threads.");
}

async function saveToCollection(collectionName) {
  const existing = await getDocs(query(collection(db, "savedThreads"), where("threadId", "==", _saveThreadId), where("uid", "==", currentUser.uid)));
  existing.forEach(async d => await deleteDoc(doc(db, "savedThreads", d.id)));
  const existingCol = await getDocs(query(collection(db, "savedCollections"), where("threadId", "==", _saveThreadId), where("uid", "==", currentUser.uid)));
  existingCol.forEach(async d => await deleteDoc(doc(db, "savedCollections", d.id)));
  await addDoc(collection(db, "savedThreads"), {
    threadId: _saveThreadId, threadName: _saveThreadName, boardId: currentBoard,
    uid: currentUser.uid, collection: collectionName, savedAt: serverTimestamp()
  });
  await addDoc(collection(db, "savedCollections"), {
    uid: currentUser.uid, name: collectionName, threadId: _saveThreadId, savedAt: serverTimestamp()
  });
  document.getElementById("saveCollectionModal").classList.add("hidden");
  const btn = document.querySelector(`.th-save-btn[data-id="${_saveThreadId}"]`);
  if (btn) btn.classList.add("saved");
  showToast(`✅ Saved to "${collectionName}"!`);
}

function showToast(message) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.style.cssText = "position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:#1A5849;color:white;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transition:all 0.3s ease;pointer-events:none;white-space:nowrap;box-shadow:0 4px 20px rgba(26,88,73,0.4);";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
  }, 2800);
}

async function openBoardReportModal(boardId, boardName) {
  const existing = await getDocs(query(
    collection(db, "reports"),
    where("boardId", "==", boardId),
    where("reportedBy", "==", currentUser.email),
    where("type", "==", "board")
  ));
  if (!existing.empty) { showToast("⚠️ You already reported this board."); return; }
  let modal = document.getElementById("boardReportModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "boardReportModal";
    modal.className = "ct-overlay";
    modal.innerHTML = `
      <div class="ct-modal" style="max-width:420px;">
        <div class="ct-modal-header">
          <span class="ct-modal-title">⚠️ Report Board</span>
          <button class="ct-close-btn" id="closeBoardReportModal">✕</button>
        </div>
        <p style="font-size:13px;color:#888;margin-bottom:16px;">Why are you reporting this board? We'll review it and take action if needed.</p>
        <div id="boardReportReasons" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
          ${["Spam","Inappropriate Content","Harassment","Misinformation","Other"].map(r => `
            <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;border:1.5px solid #e8f0ef;cursor:pointer;background:#fafafa;">
              <input type="radio" name="boardReportReason" value="${r}" style="width:16px;height:16px;margin:0;accent-color:#1A5849;">
              <span style="font-size:14px;color:#222;">${r}</span>
            </label>
          `).join("")}
        </div>
        <button id="submitBoardReportBtn" class="ct-submit-btn" style="width:100%!important;">Submit Report</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("closeBoardReportModal").addEventListener("click", () => modal.classList.add("hidden"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
  }
  modal.querySelectorAll("input[name='boardReportReason']").forEach(r => r.checked = false);
  modal.classList.remove("hidden");
  const submitBtn = document.getElementById("submitBoardReportBtn");
  const newBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newBtn, submitBtn);
  newBtn.addEventListener("click", async () => {
    const selected = modal.querySelector("input[name='boardReportReason']:checked");
    if (!selected) { showToast("⚠️ Please select a reason."); return; }
    newBtn.textContent = "Submitting...";
    newBtn.disabled = true;
    try {
      await addDoc(collection(db, "reports"), {
        type: "board", boardId, boardName,
        reportedBy: currentUser.email, reason: selected.value,
        status: "pending", reportedAt: serverTimestamp()
      });
      modal.classList.add("hidden");
      showToast("✅ Board reported. Thank you for your feedback.");
    } catch (e) { showToast("❌ Failed to submit report. Try again."); }
    newBtn.textContent = "Submit Report";
    newBtn.disabled = false;
  });
}

/* ================= AUTH ================= */

window.addEventListener("DOMContentLoaded", () => {
  screens.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.add("hidden");
  });

  onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById("appLoader");
    if (loader) loader.style.display = "none";
    if (user) {
      await user.reload();
      const freshUser = auth.currentUser;
      if (!freshUser.emailVerified) { show("loginScreen"); return; }
      currentUser = freshUser;
      const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", freshUser.uid)));
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        if (!userDoc.data().emailVerified) {
          await updateDoc(doc(db, "users", userDoc.id), { emailVerified: true });
        }
      }
      const savedScreen = sessionStorage.getItem("currentScreen");
      const savedBoard = sessionStorage.getItem("currentBoard");
      const savedThread = sessionStorage.getItem("currentThread");
      const savedBoardTitle = sessionStorage.getItem("boardTitle");
      const savedThreadTitle = sessionStorage.getItem("threadTitle");
      initUserboard(user);
      loadNotifications();
      const storedPrev = sessionStorage.getItem("previousScreen");
      if (storedPrev) previousScreen = storedPrev;
      if (savedScreen && savedScreen !== "loginScreen" && savedScreen !== "registerScreen") {
        if (savedBoard) {
          currentBoard = savedBoard;
          const boardTitleEl = document.getElementById("boardTitle");
          if (boardTitleEl && savedBoardTitle) boardTitleEl.textContent = savedBoardTitle;
        }
        if (savedThread) {
          currentThread = savedThread;
          const threadTitleEl = document.getElementById("threadTitle");
          if (threadTitleEl && savedThreadTitle) threadTitleEl.textContent = savedThreadTitle;
        }
        show(savedScreen);
        if (savedScreen === "threadScreen" && savedBoard) loadThreads();
        else if (savedScreen === "messageScreen" && savedThread) loadMessages();
        else if (savedScreen === "profileScreen") loadProfile();
        else if (savedScreen === "collectionsScreen") loadCollectionsScreen();
        else if (savedScreen === "adminScreen") initAdminPanel();
      } else {
        show("userboardScreen");
      }
    } else {
      currentUser = null;
      sessionStorage.clear();
      show("loginScreen");
    }
  });

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const backToLoginBtn = document.getElementById("backToLoginBtn");
  const goRegisterBtn = document.getElementById("goRegisterBtn");
  const otpSection = document.getElementById("otpSection");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const registerEmail = document.getElementById("registerEmail");
  const registerPassword = document.getElementById("registerPassword");
  const registerUsername = document.getElementById("registerUsername");

  /* ======= LOGIN ======= */
  loginBtn?.addEventListener("click", async () => {
    const emailVal = email.value.trim();
    const passVal = password.value.trim();
    if (!emailVal || !passVal) { alert("Please enter your email and password."); return; }
    loginBtn.textContent = "Logging in...";
    loginBtn.disabled = true;
    try {
      const userCred = await signInWithEmailAndPassword(auth, emailVal, passVal);
      await userCred.user.reload();
      const freshUser = auth.currentUser;
      if (!freshUser.emailVerified) {
        await signOut(auth);
        loginBtn.textContent = "Log In";
        loginBtn.disabled = false;
        alert("❌ Your email is not verified yet. Please check your inbox.");
        return;
      }
      const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", freshUser.uid)));
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        if (!userDoc.data().emailVerified) {
          await updateDoc(doc(db, "users", userDoc.id), { emailVerified: true });
        }
      }
      loginBtn.textContent = "Log In";
      loginBtn.disabled = false;
    } catch (e) {
      loginBtn.textContent = "Log In";
      loginBtn.disabled = false;
      alert(e.message);
    }
  });

  /* ======= REGISTER ======= */
  registerBtn?.addEventListener("click", async () => {
    const emailVal = registerEmail.value.trim();
    const passVal = registerPassword.value.trim();
    const userVal = registerUsername.value.trim();
    if (!emailVal || !passVal || !userVal) { alert("Please fill in all fields."); return; }
    if (passVal.length < 6) { alert("Password must be at least 6 characters."); return; }
    registerBtn.textContent = "Creating account...";
    registerBtn.disabled = true;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, emailVal, passVal);
      await sendEmailVerification(userCred.user);
      await addDoc(collection(db, "users"), {
        uid: userCred.user.uid, email: emailVal, username: userVal,
        emailVerified: false, joinedAt: serverTimestamp()
      });
      await signOut(auth);
      registerBtn.textContent = "Register";
      registerBtn.disabled = false;
      otpSection.classList.remove("hidden");
      otpSection.innerHTML = `
        <div class="otp-success-box">
          <div class="otp-icon">📧</div>
          <div class="otp-title">Verification Email Sent!</div>
          <div class="otp-desc">We sent a verification link to:<br><strong>${emailVal}</strong><br><br>Please check your inbox and click the link to activate your account.</div>
          <button id="goToLoginAfterVerify" class="reg-btn" style="margin-top:12px;">Go to Login →</button>
          <button id="resendVerifyBtn" class="resend-btn">Didn't receive it? Resend email</button>
        </div>
      `;
      document.getElementById("goToLoginAfterVerify").addEventListener("click", () => {
        otpSection.classList.add("hidden");
        otpSection.innerHTML = "";
        registerEmail.value = "";
        registerPassword.value = "";
        registerUsername.value = "";
        show("loginScreen");
      });
      document.getElementById("resendVerifyBtn").addEventListener("click", async () => {
        try {
          const tempCred = await signInWithEmailAndPassword(auth, emailVal, passVal);
          await sendEmailVerification(tempCred.user);
          await signOut(auth);
          alert("✅ Verification email resent!");
        } catch (err) { alert("Could not resend: " + err.message); }
      });
    } catch (e) {
      registerBtn.textContent = "Register";
      registerBtn.disabled = false;
      otpSection.classList.add("hidden");
      otpSection.innerHTML = "";
      alert(e.message);
    }
  });

  /* ======= THREAD MODAL ======= */
  const createThreadBtn = document.getElementById("createThreadBtn");
  const newThreadInput = document.getElementById("newThreadInput");
  const openCreateThread = document.getElementById("openCreateThread");
  const closeCreateThread = document.getElementById("closeCreateThread");
  const createThreadModal = document.getElementById("createThreadModal");

  document.getElementById("closePostOptions")?.addEventListener("click", () => {
    document.getElementById("postOptionsModal").classList.add("hidden");
  });
  document.getElementById("postOptionsModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("postOptionsModal")) {
      document.getElementById("postOptionsModal").classList.add("hidden");
    }
  });

  document.getElementById("reportThreadBtn")?.addEventListener("click", async () => {
    const threadId = document.getElementById("postOptionsModal").dataset.threadId;
    const threadName = document.getElementById("postOptionsModal").dataset.threadName || "Unknown Thread";
    if (!threadId) return;
    document.getElementById("postOptionsModal").classList.add("hidden");
    const existingReport = await getDocs(query(
      collection(db, "reports"),
      where("threadId", "==", threadId),
      where("reportedBy", "==", currentUser.email),
      where("type", "==", "thread")
    ));
    if (!existingReport.empty) { showToast("⚠️ You already reported this thread."); return; }
    let reportModal = document.getElementById("reportModal");
    if (!reportModal) {
      reportModal = document.createElement("div");
      reportModal.id = "reportModal";
      reportModal.className = "ct-overlay";
      reportModal.innerHTML = `
        <div class="ct-modal" style="max-width:420px;">
          <div class="ct-modal-header">
            <span class="ct-modal-title">⚠️ Report Thread</span>
            <button class="ct-close-btn" id="closeReportModal">✕</button>
          </div>
          <p style="font-size:13px;color:#888;margin-bottom:16px;">Why are you reporting this thread? We'll review it and take action if needed.</p>
          <div id="reportReasons" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
            ${["Spam","Inappropriate Content","Harassment","Misinformation","Other"].map(r => `
              <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;border:1.5px solid #e8f0ef;cursor:pointer;background:#fafafa;">
                <input type="radio" name="reportReason" value="${r}" style="width:16px;height:16px;margin:0;accent-color:#1A5849;">
                <span style="font-size:14px;color:#222;">${r}</span>
              </label>
            `).join("")}
          </div>
          <button id="submitReportBtn" class="ct-submit-btn" style="width:100%!important;">Submit Report</button>
        </div>
      `;
      document.body.appendChild(reportModal);
      document.getElementById("closeReportModal").addEventListener("click", () => reportModal.classList.add("hidden"));
      reportModal.addEventListener("click", (e) => { if (e.target === reportModal) reportModal.classList.add("hidden"); });
    }
    reportModal.querySelectorAll("input[name='reportReason']").forEach(r => r.checked = false);
    reportModal.classList.remove("hidden");
    const submitBtn = document.getElementById("submitReportBtn");
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
    newSubmitBtn.addEventListener("click", async () => {
      const selected = reportModal.querySelector("input[name='reportReason']:checked");
      if (!selected) { showToast("⚠️ Please select a reason."); return; }
      newSubmitBtn.textContent = "Submitting...";
      newSubmitBtn.disabled = true;
      try {
        await addDoc(collection(db, "reports"), {
          type: "thread", threadId, threadName, boardId: currentBoard,
          reportedBy: currentUser.email, reason: selected.value,
          status: "pending", reportedAt: serverTimestamp()
        });
        reportModal.classList.add("hidden");
        showToast("✅ Thread reported. Thank you for your feedback.");
      } catch (e) { showToast("❌ Failed to submit report. Try again."); }
      newSubmitBtn.textContent = "Submit Report";
      newSubmitBtn.disabled = false;
    });
  });

  let ctSelectedPhoto = null;
  document.getElementById("ctPhotoBtn")?.addEventListener("click", () => document.getElementById("ctPhotoInput").click());
  document.getElementById("ctPhotoInput")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    ctSelectedPhoto = file;
    document.getElementById("ctPhotoThumb").src = URL.createObjectURL(file);
    document.getElementById("ctPhotoPreview").style.display = "block";
  });
  document.getElementById("ctPhotoRemove")?.addEventListener("click", () => {
    ctSelectedPhoto = null;
    document.getElementById("ctPhotoInput").value = "";
    document.getElementById("ctPhotoThumb").src = "";
    document.getElementById("ctPhotoPreview").style.display = "none";
  });

  openCreateThread?.addEventListener("click", () => {
    createThreadModal.classList.remove("hidden");
    getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid))).then(snap => {
      const uname = !snap.empty ? (snap.docs[0].data().username || currentUser.email.split("@")[0]) : currentUser.email.split("@")[0];
      const profileIcon = !snap.empty ? (snap.docs[0].data().profileIcon || "default") : "default";
      const ic = iconMap[profileIcon] || iconMap["default"];
      const ctUserName = document.getElementById("ctUserName");
      const ctUserAvatar = document.getElementById("ctUserAvatar");
      const thCreateAvatar = document.getElementById("thCreateAvatar");
      if (ctUserName) ctUserName.textContent = uname;
      if (ctUserAvatar) { ctUserAvatar.textContent = ic.emoji; ctUserAvatar.className = "ct-user-avatar " + ic.gradientClass; }
      if (thCreateAvatar) { thCreateAvatar.textContent = ic.emoji; thCreateAvatar.className = "th-create-avatar " + ic.gradientClass; }
    });
  });

  closeCreateThread?.addEventListener("click", () => {
    createThreadModal.classList.add("hidden");
    if (newThreadInput) newThreadInput.value = "";
    const content = document.getElementById("newThreadContent");
    if (content) content.value = "";
  });

  createThreadBtn?.addEventListener("click", async () => {
    if (!newThreadInput.value.trim()) { alert("Please enter a thread title."); return; }
    createThreadBtn.textContent = "Posting...";
    createThreadBtn.disabled = true;
    let photoURL = null;
    if (ctSelectedPhoto) photoURL = await uploadToImageKit(ctSelectedPhoto);
    await addDoc(collection(db, "threads"), {
      board: currentBoard, name: newThreadInput.value.trim(),
      content: document.getElementById("newThreadContent")?.value.trim() || "",
      image: photoURL || null, createdBy: currentUser.email, createdAt: serverTimestamp()
    });
    createThreadBtn.textContent = "Post";
    createThreadBtn.disabled = false;
    createThreadModal.classList.add("hidden");
    newThreadInput.value = "";
    const content = document.getElementById("newThreadContent");
    if (content) content.value = "";
    ctSelectedPhoto = null;
    document.getElementById("ctPhotoInput").value = "";
    document.getElementById("ctPhotoThumb").src = "";
    document.getElementById("ctPhotoPreview").style.display = "none";
  });

  /* ======= MESSAGES ======= */
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");
  const msgAttachBtn = document.getElementById("msgAttachBtn");
  const msgImageFile = document.getElementById("msgImageFile");
  const msgImagePreview = document.getElementById("msgImagePreview");
  let msgSelectedImage = null;

  msgAttachBtn?.addEventListener("click", () => msgImageFile?.click());
  msgImageFile?.addEventListener("change", () => {
    const file = msgImageFile.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) { alert(isVideo ? "Video must be under 100MB" : "Image must be under 10MB"); return; }
    msgSelectedImage = file;
    const attachLabel = document.getElementById("msgAttachLabel");
    if (attachLabel) attachLabel.textContent = file.name;
    const url = URL.createObjectURL(file);
    msgImagePreview.innerHTML = "";
    if (isVideo) {
      const vid = document.createElement("video");
      vid.src = url; vid.controls = true;
      vid.style.cssText = "max-width:200px;max-height:120px;border-radius:10px;display:block;";
      msgImagePreview.appendChild(vid);
    } else {
      const img = document.createElement("img");
      img.src = url;
      img.style.cssText = "max-width:200px;max-height:120px;object-fit:cover;border-radius:10px;display:block;";
      msgImagePreview.appendChild(img);
    }
    const removeBtn = document.createElement("button");
    removeBtn.className = "sp-msg-remove-img";
    removeBtn.textContent = "✕";
    removeBtn.onclick = () => {
      msgSelectedImage = null;
      msgImagePreview.innerHTML = "";
      msgImagePreview.classList.add("hidden");
      msgImageFile.value = "";
    };
    msgImagePreview.appendChild(removeBtn);
    msgImagePreview.classList.remove("hidden");
  });

  sendBtn?.addEventListener("click", async () => {
    const text = messageInput.value.trim();
    if (!text && !msgSelectedImage) return;
    let mediaURL = null;
    let mediaType = null;
    if (msgSelectedImage) {
      sendBtn.textContent = "⏳";
      sendBtn.disabled = true;
      const isVideo = msgSelectedImage.type.startsWith("video/");
      mediaType = isVideo ? "video" : "image";
      mediaURL = await uploadToImageKit(msgSelectedImage);
      sendBtn.textContent = "Send Reply ➤";
      sendBtn.disabled = false;
    }
    await addDoc(collection(db, "messages"), {
      thread: currentThread, author: currentUser.email, text: text || "",
      image: mediaType === "image" ? mediaURL : null,
      video: mediaType === "video" ? mediaURL : null,
      time: serverTimestamp()
    });
    const threadSnap = await getDocs(query(collection(db, "messages"), where("thread", "==", currentThread)));
    const otherAuthors = [...new Set(threadSnap.docs.map(d => d.data().author).filter(a => a !== currentUser.email))];
    if (otherAuthors.length > 0) {
      const threadTitle = document.getElementById("threadTitle").textContent;
      await addDoc(collection(db, "notifications"), {
        type: "new_reply", message: `💬 ${currentUser.email} replied in "${threadTitle}"`,
        thread: currentThread, threadTitle, createdBy: currentUser.email,
        forUsers: otherAuthors, createdAt: serverTimestamp(), readBy: [currentUser.uid]
      });
    }
    messageInput.value = "";
    msgSelectedImage = null;
    msgImagePreview.innerHTML = "";
    msgImagePreview.classList.add("hidden");
    msgImageFile.value = "";
  });

  messageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
  });

  /* ======= NAVIGATION ======= */
  document.getElementById("backBoards")?.addEventListener("click", () => show("userboardScreen"));
  document.getElementById("backThreads")?.addEventListener("click", () => show("threadScreen"));
  document.getElementById("backHome")?.addEventListener("click", () => goBack());
  document.getElementById("backFromAdmin")?.addEventListener("click", () => show("userboardScreen"));
  backToLoginBtn?.addEventListener("click", () => { otpSection.classList.add("hidden"); otpSection.innerHTML = ""; show("loginScreen"); });
  goRegisterBtn?.addEventListener("click", () => show("registerScreen"));

  /* ======= LOGOUT ======= */
  document.getElementById("ubLogoutBtn")?.addEventListener("click", async () => await signOut(auth));

  /* ======= SEARCH ======= */
  const searchInput = document.getElementById("ubSearchInput");
  const searchClear = document.getElementById("ubSearchClear");
  const searchDropdown = document.getElementById("ubSearchDropdown");
  let dropdownOpen = false;

  const openDropdown = () => {
    if (!searchInput || !searchDropdown) return;
    const q = searchInput.value.trim().toLowerCase();
    const results = q ? allBoards.filter(b => (b.name || "").toLowerCase().includes(q)) : allBoards;
    searchDropdown.innerHTML = "";
    if (results.length === 0) {
      searchDropdown.innerHTML = `<div class="ub-search-no-result">No boards found.</div>`;
    } else {
      results.forEach(b => {
        const item = document.createElement("div");
        item.className = "ub-search-item";
        const highlighted = q ? b.name.replace(new RegExp(q, "gi"), m => `<strong>${m}</strong>`) : b.name;
        item.innerHTML = `<span class="ub-search-item-icon">📋</span><span class="ub-search-item-text">${highlighted}</span><span class="ub-search-item-meta">${b.createBy || "unknown"}</span>`;
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          currentBoard = b.id;
          document.getElementById("boardTitle").textContent = b.name;
          show("threadScreen");
          loadThreads();
          searchInput.value = "";
          if (searchClear) searchClear.textContent = "🔍";
          closeDropdown();
        });
        searchDropdown.appendChild(item);
      });
    }
    searchDropdown.classList.remove("hidden");
    dropdownOpen = true;
  };

  const closeDropdown = () => {
    if (!searchDropdown) return;
    searchDropdown.classList.add("hidden");
    dropdownOpen = false;
  };

  searchInput?.addEventListener("focus", () => openDropdown());
  searchInput?.addEventListener("input", () => {
    if (searchClear) searchClear.textContent = searchInput.value.trim() ? "✕" : "🔍";
    openDropdown();
  });
  searchClear?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (searchInput.value.trim()) {
      searchInput.value = "";
      searchClear.textContent = "🔍";
      searchInput.focus();
      openDropdown();
    } else if (dropdownOpen) {
      closeDropdown();
    } else {
      searchInput.focus();
      openDropdown();
    }
  });
  document.addEventListener("mousedown", (e) => {
    if (searchInput && searchDropdown && searchClear &&
      !searchInput.contains(e.target) && !searchDropdown.contains(e.target) && !searchClear.contains(e.target)) {
      closeDropdown();
    }
  });

  /* ======= USERBOARD NAV ======= */
  document.getElementById("ubNotifBtn2")?.addEventListener("click", () => show("notifScreen"));
  document.getElementById("ubProfileBtn2")?.addEventListener("click", () => { show("profileScreen"); loadProfile(); });
  document.getElementById("ubNotifBtn")?.addEventListener("click", () => show("notifScreen"));
  document.getElementById("ubGoBoards")?.addEventListener("click", () => show("userboardScreen"));
  document.getElementById("ubGoCategories")?.addEventListener("click", () => { show("collectionsScreen"); loadCollectionsScreen(); });
  document.getElementById("ubGoProfile")?.addEventListener("click", () => { show("profileScreen"); loadProfile(); });
  document.getElementById("ubGoAdmin")?.addEventListener("click", () => { show("adminScreen"); initAdminPanel(); });
  document.getElementById("backFromCollections")?.addEventListener("click", () => goBack());
  document.getElementById("colGoBoards")?.addEventListener("click", () => show("userboardScreen"));
  document.getElementById("colGoProfile")?.addEventListener("click", () => { show("profileScreen"); loadProfile(); });
  document.getElementById("colNotifBtn")?.addEventListener("click", () => show("notifScreen"));
  document.getElementById("colLogoutBtn")?.addEventListener("click", async () => await signOut(auth));
  document.getElementById("colGoAdmin")?.addEventListener("click", () => { show("adminScreen"); initAdminPanel(); });

  const colSearch = document.getElementById("colSearchInput");
  colSearch?.addEventListener("input", () => {
    const q = colSearch.value.trim().toLowerCase();
    const container = document.getElementById("collectionsContainer");
    if (!container) return;
    container.querySelectorAll(".ub-board-list-item").forEach(item => {
      const name = item.querySelector(".ub-board-list-name")?.textContent.toLowerCase() || "";
      const col = item.querySelector(".ub-board-list-meta")?.textContent.toLowerCase() || "";
      item.style.display = (!q || name.includes(q) || col.includes(q)) ? "" : "none";
    });
  });
  document.getElementById("backFromProfile")?.addEventListener("click", () => goBack());
  document.getElementById("ubViewAllBoards")?.addEventListener("click", () => show("userboardScreen"));

  document.getElementById("ubCreateBoardBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("ubNewBoardInput");
    if (!input.value.trim()) return;
    const boardName = input.value.trim();
    await addDoc(collection(db, "boards"), { name: boardName, createBy: currentUser.email, createdAt: serverTimestamp() });
    await addDoc(collection(db, "notifications"), {
      type: "new_board", message: `📋 New board created: "${boardName}" by ${currentUser.email}`,
      createdBy: currentUser.email, createdAt: serverTimestamp(), readBy: [currentUser.uid]
    });
    input.value = "";
  });

  /* ======= SAVE COLLECTION MODAL ======= */
  document.getElementById("closeSaveCollection")?.addEventListener("click", () => {
    document.getElementById("saveCollectionModal").classList.add("hidden");
  });
  document.getElementById("saveCollectionModal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("saveCollectionModal")) {
      document.getElementById("saveCollectionModal").classList.add("hidden");
    }
  });
  document.getElementById("createCollectionSaveBtn")?.addEventListener("click", async () => {
    const name = document.getElementById("newCollectionInput").value.trim();
    if (!name) { showToast("⚠️ Please enter a collection name."); return; }
    await saveToCollection(name);
  });
});

/* ================= FUNCTIONS ================= */

function loadSavedThreads() {
  const container = document.getElementById("ubSavedThreads");
  if (!container || !currentUser) return;
  onSnapshot(query(collection(db, "savedThreads"), where("uid", "==", currentUser.uid)), (snap) => {
    container.innerHTML = "";
    if (snap.empty) {
      container.innerHTML = `
        <div class="ub-saved-empty">
          <div class="ub-saved-empty-icon">🔖</div>
          <div class="ub-saved-empty-text">No saved threads yet</div>
          <div class="ub-saved-empty-sub">Bookmark threads to save them to a collection</div>
        </div>`;
      return;
    }
    const groups = {};
    snap.forEach(d => {
      const data = d.data();
      const col = data.collection || "Favorites";
      if (!groups[col]) groups[col] = [];
      groups[col].push({ id: d.id, ...data });
    });
    Object.entries(groups).forEach(([colName, threads]) => {
      const header = document.createElement("div");
      header.style.cssText = "font-size:12px;font-weight:700;color:#1A5849;text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;padding-left:4px;display:flex;align-items:center;gap:6px;";
      header.innerHTML = `<span>📁</span> ${colName} <span style="color:#bbb;font-weight:400;">(${threads.length})</span>`;
      container.appendChild(header);
      threads.forEach(data => {
        const item = document.createElement("div");
        item.className = "ub-board-list-item";
        item.innerHTML = `
          <div class="ub-board-list-icon" style="background:#e8f3f1;"><span style="font-size:20px;">🔖</span></div>
          <div class="ub-board-list-info">
            <div class="ub-board-list-name">${data.threadName}</div>
            <div class="ub-board-list-meta">${colName}</div>
          </div>
          <span class="ub-board-list-arrow">›</span>
        `;
        item.onclick = () => {
          currentBoard = data.boardId;
          currentThread = data.threadId;
          document.getElementById("threadTitle").textContent = data.threadName;
          show("messageScreen");
          loadMessages();
        };
        container.appendChild(item);
      });
    });
  });
}

function timeAgoStr(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function loadThreads() {
  const threadList = document.getElementById("threadList");
  threadList.className = "th-post-list";
  const thBoardsList = document.getElementById("thBoardsList");
  if (thBoardsList) {
    getDocs(query(collection(db, "boards"), orderBy("createdAt", "desc"))).then(snap => {
      thBoardsList.innerHTML = "";
      snap.forEach(d => {
        const data = d.data();
        const btn = document.createElement("button");
        btn.className = "ub-side-btn" + (d.id === currentBoard ? " active" : "");
        btn.innerHTML = `<span class="ub-side-icon">📋</span> ${data.name}`;
        btn.addEventListener("click", () => {
          currentBoard = d.id;
          document.getElementById("boardTitle").textContent = data.name;
          thBoardsList.querySelectorAll(".ub-side-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          loadThreads();
        });
        thBoardsList.appendChild(btn);
      });
    });
  }
  if (currentUser) {
    getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid))).then(snap => {
      const profileIcon = !snap.empty ? (snap.docs[0].data().profileIcon || "default") : "default";
      const ic = iconMap[profileIcon] || iconMap["default"];
      const thCreateAvatar = document.getElementById("thCreateAvatar");
      if (thCreateAvatar) { thCreateAvatar.textContent = ic.emoji; thCreateAvatar.className = "th-create-avatar " + ic.gradientClass; }
    });
  }
  onSnapshot(query(collection(db, "threads"), where("board", "==", currentBoard)), (snap) => {
    threadList.innerHTML = "";
    if (snap.empty) {
      threadList.innerHTML = '<div class="sp-empty-state">No threads yet. Create the first one!</div>';
      return;
    }
    snap.docs.forEach(async (d) => {
      const data = d.data();
      if (data.archived === true) return;
      const timeAgo = data.createdAt?.toDate ? timeAgoStr(data.createdAt.toDate()) : "Just now";
      const ic = await getUserIcon(data.createdBy || "");
      const div = document.createElement("div");
      div.className = "th-post-card";
      div.innerHTML = `
        <div class="th-post-header">
          <div class="th-post-avatar ${ic.gradientClass}">${ic.emoji}</div>
          <div class="th-post-meta">
            <div class="th-post-title">${data.name}</div>
            <div class="th-post-sub">by ${data.createdBy || "unknown"} • ${timeAgo}</div>
          </div>
          ${!isAdmin() ? `<button class="th-post-menu">⋮</button>` : ""}
        </div>
        ${data.content ? `<div class="th-post-content">${data.content}</div>` : ""}
        ${data.image ? `<img class="th-post-image" src="${data.image}" alt="post image" onclick="window.open(this.src,'_blank')">` : ""}
        <div class="th-post-actions">
          <button class="th-post-action-btn th-like-btn" data-id="${d.id}">
            <span class="th-action-icon">🤍</span>
            <span class="th-like-count" id="likes-${d.id}">0</span>
          </button>
          <button class="th-post-action-btn th-comment-btn" data-id="${d.id}">
            <span class="th-action-icon">💬</span> Comments
          </button>
          <button class="th-post-action-btn th-save-btn" data-id="${d.id}" style="margin-left:auto;">
            <span class="th-action-icon">🔖</span>
          </button>
        </div>
      `;
      if (!isAdmin()) {
        div.querySelector(".th-post-menu")?.addEventListener("click", (e) => {
          e.stopPropagation();
          const modal = document.getElementById("postOptionsModal");
          modal.classList.remove("hidden");
          modal.dataset.threadId = d.id;
          modal.dataset.threadName = data.name;
          const reportBtn = document.getElementById("reportThreadBtn");
          if (reportBtn) reportBtn.style.display = "flex";
        });
      }
      div.querySelector(".th-comment-btn").addEventListener("click", () => {
        currentThread = d.id;
        document.getElementById("threadTitle").textContent = data.name;
        show("messageScreen");
        loadMessages();
      });
      const likeBtn = div.querySelector(".th-like-btn");
      const likeCountEl = div.querySelector(`#likes-${d.id}`);
      let liked = false;
      getDocs(query(collection(db, "likes"), where("threadId", "==", d.id))).then(likeSnap => {
        likeCountEl.textContent = likeSnap.size;
        liked = likeSnap.docs.some(l => l.data().uid === currentUser.uid);
        likeBtn.querySelector(".th-action-icon").textContent = liked ? "❤️" : "🤍";
      });
      likeBtn.addEventListener("click", async () => {
        if (liked) {
          const likeSnap = await getDocs(query(collection(db, "likes"), where("threadId", "==", d.id), where("uid", "==", currentUser.uid)));
          likeSnap.forEach(async l => await deleteDoc(doc(db, "likes", l.id)));
          liked = false;
          likeBtn.querySelector(".th-action-icon").textContent = "🤍";
          likeCountEl.textContent = parseInt(likeCountEl.textContent) - 1;
        } else {
          await addDoc(collection(db, "likes"), { threadId: d.id, uid: currentUser.uid });
          liked = true;
          likeBtn.querySelector(".th-action-icon").textContent = "❤️";
          likeCountEl.textContent = parseInt(likeCountEl.textContent) + 1;
        }
      });
      const bookmarkBtn = div.querySelector(".th-save-btn");
      getDocs(query(collection(db, "savedThreads"), where("threadId", "==", d.id), where("uid", "==", currentUser.uid))).then(snapCheck => {
        if (bookmarkBtn) {
          bookmarkBtn.classList.toggle("saved", !snapCheck.empty);
          bookmarkBtn.title = !snapCheck.empty ? "Saved! Click to change collection" : "Save to collection";
        }
      });
      bookmarkBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSaveCollectionModal(d.id, data.name);
      });
      threadList.appendChild(div);
    });
  });
}

function applyIcon(icon, updateSidebar = true) {
  const localIconMap = {
    default: { emoji: "👤", class: "gradient-default" },
    fire:    { emoji: "🔥", class: "gradient-fire" },
    star:    { emoji: "⭐", class: "gradient-star" },
    bolt:    { emoji: "⚡", class: "gradient-bolt" }
  };
  const ic = localIconMap[icon] || localIconMap["default"];
  const av = document.getElementById("profileAvatarCircle");
  if (av) { av.textContent = ic.emoji; av.className = "profile-avatar-circle " + ic.class; }
  if (updateSidebar) {
    const sideIcon = document.getElementById("ubSideAvatar");
    if (sideIcon) { sideIcon.textContent = ic.emoji; sideIcon.className = "ub-user-card-avatar-circle " + ic.class; }
  }
}

function loadProfile() {
  const user = currentUser;
  document.getElementById("profileEmail").textContent = user.email;
  const profileAv = document.getElementById("profileAvatarCircle");
  if (profileAv) { profileAv.textContent = "👤"; profileAv.className = "profile-avatar-circle gradient-default"; }
  let selectedIcon = "default";
  document.querySelectorAll(".profile-icon-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".profile-icon-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedIcon = opt.dataset.icon;
      applyIcon(selectedIcon, false);
    });
  });
  getDocs(query(collection(db, "users"), where("uid", "==", user.uid))).then(snap => {
    let userData = {};
    if (!snap.empty) userData = snap.docs[0].data();
    const username = userData.username || user.email.split("@")[0];
    document.getElementById("profileUsername").textContent = username;
    document.getElementById("profileUsernameInput").value = username;
    document.getElementById("profileBioInput").value = userData.bio || "";
    selectedIcon = userData.profileIcon || "default";
    document.querySelectorAll(".profile-icon-option").forEach(o => {
      o.classList.toggle("selected", o.dataset.icon === selectedIcon);
    });
    applyIcon(selectedIcon, true);
    const joined = snap.docs[0]?.data()?.joinedAt?.toDate?.();
    document.getElementById("profileJoined").textContent = joined
      ? `Joined: ${joined.toLocaleDateString()}`
      : `Joined: ${new Date(user.metadata.creationTime).toLocaleDateString()}`;
  });
  getDocs(query(collection(db, "messages"), where("author", "==", user.email))).then(s => {
    document.getElementById("profileStatPosts").textContent = s.size;
  });
  getDocs(query(collection(db, "threads"), where("createdBy", "==", user.email))).then(s => {
    document.getElementById("profileStatThreads").textContent = s.size;
  });
  getDocs(query(collection(db, "boards"), where("createBy", "==", user.email))).then(s => {
    document.getElementById("profileStatBoards").textContent = s.size;
  });
  const saveBtn = document.getElementById("profileSaveBtn");
  const saveMsg = document.getElementById("profileSaveMsg");
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener("click", async () => {
    const newUsername = document.getElementById("profileUsernameInput").value.trim()
      || document.getElementById("profileUsername").textContent.trim();
    const newBio = document.getElementById("profileBioInput").value.trim();
    if (!newUsername) { alert("Username cannot be empty."); return; }
    newSaveBtn.textContent = "Saving...";
    newSaveBtn.disabled = true;
    try {
      const snap = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
      if (!snap.empty) {
        await updateDoc(doc(db, "users", snap.docs[0].id), { username: newUsername, bio: newBio, profileIcon: selectedIcon });
      } else {
        await addDoc(collection(db, "users"), { uid: user.uid, email: user.email, username: newUsername, bio: newBio, profileIcon: selectedIcon });
      }
      document.getElementById("ubSideUsername").textContent = newUsername;
      document.getElementById("profileUsername").textContent = newUsername;
      applyIcon(selectedIcon, true);
      newSaveBtn.textContent = "Save Changes";
      newSaveBtn.disabled = false;
      saveMsg.classList.remove("hidden");
      setTimeout(() => saveMsg.classList.add("hidden"), 3000);
    } catch (e) {
      alert("Error saving: " + e.message);
      newSaveBtn.textContent = "Save Changes";
      newSaveBtn.disabled = false;
    }
  });
}

function loadNotifications() {
  const notifList = document.getElementById("notifList");
  if (!notifList) return;
  onSnapshot(query(collection(db, "notifications"), orderBy("createdAt", "desc")), (snap) => {
    const uid = currentUser.uid;
    const email = currentUser.email;
    const mine = snap.docs.filter(d => {
      const data = d.data();
      if (data.readBy?.includes(uid)) return false;
      if (data.type === "new_board" && data.createdBy !== email) return true;
      if (data.type === "new_reply" && data.forUsers?.includes(email)) return true;
      return false;
    });
    const badge = document.getElementById("ubNotifBadge");
    const badge2 = document.getElementById("ubNotifBadge2");
    if (badge) { badge.textContent = mine.length; badge.style.display = mine.length > 0 ? "flex" : "none"; }
    if (badge2) { badge2.textContent = mine.length; badge2.style.display = mine.length > 0 ? "flex" : "none"; }
    const visible = snap.docs.filter(d => {
      const data = d.data();
      if (data.type === "new_board" && data.createdBy !== email) return true;
      if (data.type === "new_reply" && data.forUsers?.includes(email)) return true;
      return false;
    });
    notifList.innerHTML = "";
    if (visible.length === 0) {
      notifList.innerHTML = '<div class="sp-empty-state">No notifications yet.</div>';
      return;
    }
    visible.forEach(d => {
      const data = d.data();
      const isRead = data.readBy?.includes(uid);
      const item = document.createElement("div");
      item.className = `notif-item ${isRead ? "notif-read" : "notif-unread"}`;
      const time = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : "";
      item.innerHTML = `<div class="notif-msg">${data.message}</div><div class="notif-time">${time}</div>`;
      item.addEventListener("click", async () => {
        if (!isRead) {
          await updateDoc(doc(db, "notifications", d.id), { readBy: [...(data.readBy || []), uid] });
        }
        if (data.type === "new_reply" && data.thread) {
          currentThread = data.thread;
          document.getElementById("threadTitle").textContent = data.threadTitle || "Thread";
          show("messageScreen");
          loadMessages();
        }
      });
      notifList.appendChild(item);
    });
  });
}

function loadMessages() {
  const messageList = document.getElementById("messageList");
  const msgSideThreadInfo = document.getElementById("msgSideThreadInfo");
  const msgSideBoardName = document.getElementById("msgSideBoardName");
  getDocs(query(collection(db, "threads"))).then(async snap => {
    const threadDoc = snap.docs.find(d => d.id === currentThread);
    if (threadDoc && msgSideThreadInfo) {
      const td = threadDoc.data();
      const ic = await getUserIcon(td.createdBy || "");
      const timeAgo = td.createdAt?.toDate ? timeAgoStr(td.createdAt.toDate()) : "Just now";
      msgSideThreadInfo.innerHTML = `
        <div class="msg-side-avatar ${ic.gradientClass}">${ic.emoji}</div>
        <div class="msg-side-thread-title">${td.name}</div>
        <div class="msg-side-thread-by">by ${td.createdBy || "unknown"}</div>
        <div class="msg-side-thread-time">🕐 ${timeAgo}</div>
        ${td.content ? `<div class="msg-side-thread-content">${td.content}</div>` : ""}
        ${td.image ? `<img src="${td.image}" style="width:100%;border-radius:8px;margin-top:10px;object-fit:cover;max-height:140px;">` : ""}
      `;
    }
  });
  if (currentBoard && msgSideBoardName) {
    getDocs(query(collection(db, "boards"))).then(snap => {
      const boardDoc = snap.docs.find(d => d.id === currentBoard);
      if (boardDoc) msgSideBoardName.textContent = boardDoc.data().name;
    });
  }
  onSnapshot(query(collection(db, "messages"), where("thread", "==", currentThread), orderBy("time")), (snap) => {
    messageList.innerHTML = "";
    if (snap.empty) {
      messageList.innerHTML = '<div class="msg-no-replies">No replies yet. Be the first!</div>';
      return;
    }
    snap.forEach(async d => {
      const data = d.data();
      const ic = await getUserIcon(data.author);
      const time = data.time?.toDate ? data.time.toDate().toLocaleString() : "";
      const isMe = data.author === currentUser.email;
      const div = document.createElement("div");
      div.className = "msg-reply-card-item" + (isMe ? " msg-reply-me" : "");
      div.innerHTML = `
        <div class="msg-reply-item-header">
          <div class="msg-reply-avatar ${ic.gradientClass}">${ic.emoji}</div>
          <div>
            <div class="msg-reply-author">${data.author}</div>
            <div class="msg-reply-time">${time}</div>
          </div>
        </div>
        ${data.image ? `<img src="${data.image}" class="msg-reply-image" onclick="window.open(this.src,'_blank')">` : ""}
        ${data.video ? `<video src="${data.video}" class="msg-reply-image" controls></video>` : ""}
        ${data.text ? `<div class="msg-reply-text">${data.text}</div>` : ""}
      `;
      messageList.appendChild(div);
    });
    messageList.scrollTop = messageList.scrollHeight;
  });
}

function loadCollectionsScreen() {
  const container = document.getElementById("collectionsContainer");
  if (!container || !currentUser) return;
  getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid))).then(snap => {
    const uname = !snap.empty ? (snap.docs[0].data().username || currentUser.email.split("@")[0]) : currentUser.email.split("@")[0];
    const profileIcon = !snap.empty ? (snap.docs[0].data().profileIcon || "default") : "default";
    const localIconMap = {
      default: { emoji: "👤", class: "gradient-default" },
      fire:    { emoji: "🔥", class: "gradient-fire" },
      star:    { emoji: "⭐", class: "gradient-star" },
      bolt:    { emoji: "⚡", class: "gradient-bolt" }
    };
    const ic = localIconMap[profileIcon] || localIconMap["default"];
    const colHiText = document.getElementById("colHiText");
    const colSideUsername = document.getElementById("colSideUsername");
    const colSideAvatar = document.getElementById("colSideAvatar");
    if (colHiText) colHiText.textContent = "Hi, " + uname + "!";
    if (colSideUsername) colSideUsername.textContent = uname;
    if (colSideAvatar) { colSideAvatar.textContent = ic.emoji; colSideAvatar.className = "ub-user-card-avatar-circle " + ic.class; }
    const colAdminBtn = document.getElementById("colGoAdmin");
    if (colAdminBtn && isAdmin()) colAdminBtn.classList.remove("hidden");
  });
  const colBadge = document.getElementById("colNotifBadge");
  const mainBadge = document.getElementById("ubNotifBadge");
  if (colBadge && mainBadge) { colBadge.textContent = mainBadge.textContent; colBadge.style.display = mainBadge.style.display; }
  container.innerHTML = '<div style="color:#bbb;font-size:14px;text-align:center;padding:40px;">Loading...</div>';
  onSnapshot(query(collection(db, "savedThreads"), where("uid", "==", currentUser.uid)), (snap) => {
    container.innerHTML = "";
    if (snap.empty) {
      container.innerHTML = `
        <div class="ub-saved-empty">
          <div class="ub-saved-empty-icon">🔖</div>
          <div class="ub-saved-empty-text">No saved threads yet</div>
          <div class="ub-saved-empty-sub">Bookmark threads to save them to a collection</div>
        </div>`;
      return;
    }
    const groups = {};
    snap.forEach(d => {
      const data = d.data();
      const col = data.collection || "Favorites";
      if (!groups[col]) groups[col] = [];
      groups[col].push({ id: d.id, ...data });
    });
    Object.entries(groups).forEach(([colName, threads]) => {
      const header = document.createElement("div");
      header.style.cssText = "font-size:12px;font-weight:700;color:#1A5849;text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px;padding-left:4px;display:flex;align-items:center;gap:6px;";
      header.innerHTML = `<span>📁</span> ${colName} <span style="color:#bbb;font-weight:400;">(${threads.length})</span>`;
      container.appendChild(header);
      threads.forEach(data => {
        const item = document.createElement("div");
        item.className = "ub-board-list-item";
        item.innerHTML = `
          <div class="ub-board-list-icon" style="background:#e8f3f1;"><span style="font-size:20px;">🔖</span></div>
          <div class="ub-board-list-info">
            <div class="ub-board-list-name">${data.threadName}</div>
            <div class="ub-board-list-meta">${colName}</div>
          </div>
          <span class="ub-board-list-arrow">›</span>
        `;
        item.onclick = () => {
          currentBoard = data.boardId;
          currentThread = data.threadId;
          document.getElementById("threadTitle").textContent = data.threadName;
          show("messageScreen");
          loadMessages();
        };
        container.appendChild(item);
      });
    });
  });
}

/* ================= ADMIN PANEL ================= */

function showAdminPanel(panelId) {
  const panels = ["adminPanelStats", "adminPanelUsers", "adminPanelModeration"];
  panels.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.style.display = p === panelId ? "block" : "none";
  });
  document.querySelectorAll(".ub-side-btn[id^='adminView'], #adminModerationBtn, #adminManageUsersBtn").forEach(b => b.classList.remove("active"));
  const btnMap = {
    adminPanelStats:      "adminViewStatsBtn",
    adminPanelUsers:      "adminManageUsersBtn",
    adminPanelModeration: "adminModerationBtn"
  };
  const activeBtn = document.getElementById(btnMap[panelId]);
  if (activeBtn) activeBtn.classList.add("active");
}

function loadAdminStats() {
  const grid = document.getElementById("adminStatsGrid");
  if (!grid) return;
  grid.innerHTML = '<div style="color:#bbb;font-size:13px;text-align:center;padding:20px;grid-column:1/-1;">Loading...</div>';
  Promise.all([
    getDocs(collection(db, "boards")),
    getDocs(collection(db, "threads")),
    getDocs(collection(db, "messages")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "likes")),
    getDocs(collection(db, "savedThreads")),
    getDocs(query(collection(db, "reports"), where("status", "==", "pending")))
  ]).then(([boards, threads, messages, users, likes, saved, reports]) => {
    const stats = [
      { icon: "📋", label: "Total Boards",    value: boards.size },
      { icon: "💬", label: "Total Threads",   value: threads.size },
      { icon: "✉️",  label: "Total Replies",   value: messages.size },
      { icon: "👥", label: "Total Users",     value: users.size },
      { icon: "❤️", label: "Total Likes",     value: likes.size },
      { icon: "🔖", label: "Saved Threads",   value: saved.size },
      { icon: "⚠️", label: "Pending Reports", value: reports.size }
    ];
    grid.innerHTML = "";
    stats.forEach(s => {
      const card = document.createElement("div");
      card.className = "profile-stat-card";
      card.style.cssText = "padding:24px 16px;";
      card.innerHTML = `
        <div style="font-size:28px;margin-bottom:6px;">${s.icon}</div>
        <div class="profile-stat-num">${s.value}</div>
        <div class="profile-stat-label">${s.label}</div>
      `;
      grid.appendChild(card);
    });
  });
}

function loadAdminUsers() {
  const list = document.getElementById("adminUsersList");
  if (!list) return;
  list.innerHTML = '<div style="color:#bbb;font-size:13px;text-align:center;padding:20px;">Loading...</div>';
  getDocs(query(collection(db, "users"), orderBy("joinedAt", "desc"))).then(snap => {
    list.innerHTML = "";
    if (snap.empty) {
      list.innerHTML = '<div style="color:#aaa;text-align:center;padding:40px;background:white;border-radius:14px;">No users found.</div>';
      return;
    }
    snap.forEach(d => {
      const data = d.data();
      const date = data.joinedAt?.toDate ? data.joinedAt.toDate().toLocaleDateString() : "—";
      const profileIcon = data.profileIcon || "default";
      const ic = iconMap[profileIcon] || iconMap["default"];
      const row = document.createElement("div");
      row.className = "admin-list-row";
      row.innerHTML = `
        <div class="ub-user-card-avatar-circle ${ic.gradientClass}" style="width:40px;height:40px;font-size:18px;flex-shrink:0;">${ic.emoji}</div>
        <div class="admin-row-info">
          <div class="admin-row-name">${data.username || "—"}</div>
          <div class="admin-row-meta">${data.email || "—"} • Joined ${date}</div>
        </div>
      `;
      list.appendChild(row);
    });
  });
}

function switchModerationTab(tab) {
  ["modTabBoards","modTabThreads"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const target = document.getElementById("modTab" + tab);
  if (target) target.style.display = "block";
  document.querySelectorAll(".mod-tab-btn").forEach(b => {
    b.style.background = "transparent";
    b.style.color = "#666";
    b.style.borderBottom = "3px solid transparent";
  });
  const activeBtn = document.getElementById("modBtn" + tab);
  if (activeBtn) {
    activeBtn.style.background = "transparent";
    activeBtn.style.color = "#1A5849";
    activeBtn.style.borderBottom = "3px solid #1A5849";
  }
}

function loadModerationPanel() {
  const container = document.getElementById("adminPanelModeration");
  if (!container) return;
  container.innerHTML = `
    <div class="ub-banner" style="margin-bottom:24px;">
      <div class="ub-banner-text">
        <div class="ub-banner-greeting">🛡️ Content Review</div>
        <div class="ub-banner-sub">Manage boards and threads</div>
      </div>
      <div class="ub-banner-art">⚖️</div>
    </div>
    <div style="display:flex;gap:0;background:white;border-radius:12px;padding:4px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.07);overflow:hidden;">
      <button id="modBtnBoards" class="mod-tab-btn" style="flex:1;height:42px;border:none;border-bottom:3px solid #1A5849;background:transparent;color:#1A5849;font-size:14px;font-weight:600;cursor:pointer;border-radius:8px;margin:0;padding:0;">📋 Boards</button>
      <button id="modBtnThreads" class="mod-tab-btn" style="flex:1;height:42px;border:none;border-bottom:3px solid transparent;background:transparent;color:#666;font-size:14px;font-weight:600;cursor:pointer;border-radius:8px;margin:0;padding:0;">💬 Threads</button>
    </div>
    <div id="modTabBoards" style="display:block;">
      <div id="modBoardsList" style="display:flex;flex-direction:column;gap:10px;"></div>
    </div>
    <div id="modTabThreads" style="display:none;">
      <div id="modThreadsList" style="display:flex;flex-direction:column;gap:10px;"></div>
    </div>
  `;
  document.getElementById("modBtnBoards").addEventListener("click", () => { switchModerationTab("Boards"); loadModBoards(); });
  document.getElementById("modBtnThreads").addEventListener("click", () => { switchModerationTab("Threads"); loadModThreads(); });
  loadModBoards();
}

function loadModBoards() {
  const list = document.getElementById("modBoardsList");
  if (!list) return;
  list.innerHTML = '<div style="color:#bbb;font-size:13px;text-align:center;padding:20px;">Loading...</div>';
  getDocs(query(collection(db, "boards"), orderBy("createdAt", "desc"))).then(async snap => {
    list.innerHTML = "";
    if (snap.empty) { list.innerHTML = '<div style="color:#aaa;text-align:center;padding:40px;background:white;border-radius:14px;">No boards found.</div>'; return; }
    const reportsSnap = await getDocs(query(collection(db, "reports"), where("type", "==", "board"), where("status", "==", "pending")));
    const reportedBoards = {};
    reportsSnap.forEach(r => {
      const d = r.data();
      if (!reportedBoards[d.boardId]) reportedBoards[d.boardId] = [];
      reportedBoards[d.boardId].push({ id: r.id, ...d });
    });
    const allBoards = snap.docs.map(d => ({ docId: d.id, ...d.data(), _reports: reportedBoards[d.id] || [] }));
    allBoards.sort((a, b) => (b._reports.length > 0 ? 1 : 0) - (a._reports.length > 0 ? 1 : 0));
    const hasReported = allBoards.some(b => b._reports.length > 0);
    if (hasReported) {
      const label = document.createElement("div");
      label.style.cssText = "font-size:11px;font-weight:700;color:#e53e3e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;padding-left:4px;";
      label.innerHTML = "🚨 Reported";
      list.appendChild(label);
    }
    let passedReported = false;
    allBoards.forEach(data => {
      const reports = data._reports;
      const isReported = reports.length > 0;
      if (!isReported && hasReported && !passedReported) {
        passedReported = true;
        const divider = document.createElement("div");
        divider.style.cssText = "font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;padding-left:4px;";
        divider.textContent = "All Boards";
        list.appendChild(divider);
      }
      const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : "—";
      const row = document.createElement("div");
      row.className = "admin-list-row";
      row.innerHTML = `
        <div class="admin-row-icon" style="background:${isReported ? "#fff0f0" : "#e8f3f1"};">${isReported ? "🚨" : "📋"}</div>
        <div class="admin-row-info">
          <div class="admin-row-name">${data.name}
            ${isReported ? `<span style="font-size:11px;background:#fee2e2;color:#e53e3e;border-radius:999px;padding:2px 8px;font-weight:600;margin-left:6px;">🚨 Reported (${reports.length})</span>` : ""}
          </div>
          <div class="admin-row-meta">by ${data.createBy || "unknown"} • ${date}</div>
          ${isReported ? `<div style="font-size:11px;color:#e53e3e;margin-top:4px;">Reason: <strong>${reports[0].reason}</strong> • by ${reports[0].reportedBy}</div>` : ""}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;align-items:center;">
          ${isReported ? `<button class="mod-dismiss-board-btn" style="width:auto!important;height:36px!important;padding:0 14px!important;border-radius:999px!important;border:none!important;background:#e8f3f1!important;color:#1A5849!important;font-size:13px!important;font-weight:600;cursor:pointer;margin:0!important;">✓ Dismiss</button>` : ""}
          <button class="mod-delete-board-btn" style="width:auto!important;height:36px!important;padding:0 16px!important;border-radius:999px!important;border:none!important;background:#fff0f0!important;color:#e53e3e!important;font-size:13px!important;font-weight:600;cursor:pointer;margin:0!important;">🗑 Delete</button>
        </div>
      `;
      row.querySelector(".mod-dismiss-board-btn")?.addEventListener("click", async () => {
        for (const r of reports) await updateDoc(doc(db, "reports", r.id), { status: "resolved" });
        showToast("✓ Report dismissed."); loadModBoards();
      });
      row.querySelector(".mod-delete-board-btn").addEventListener("click", async () => {
        if (!confirm(`Delete board "${data.name}"? All threads, replies, likes, saves and notifications inside it will also be permanently deleted.`)) return;
        // Get all threads in this board
        const threadsSnap = await getDocs(query(collection(db, "threads"), where("board", "==", data.docId)));
        for (const t of threadsSnap.docs) {
          const threadId = t.id;
          // Delete all replies
          const msgsSnap = await getDocs(query(collection(db, "messages"), where("thread", "==", threadId)));
          msgsSnap.forEach(async m => await deleteDoc(doc(db, "messages", m.id)));
          // Delete all likes
          const likesSnap = await getDocs(query(collection(db, "likes"), where("threadId", "==", threadId)));
          likesSnap.forEach(async l => await deleteDoc(doc(db, "likes", l.id)));
          // Delete all saved references
          const savedSnap = await getDocs(query(collection(db, "savedThreads"), where("threadId", "==", threadId)));
          savedSnap.forEach(async s => await deleteDoc(doc(db, "savedThreads", s.id)));
          // Delete all saved collection references
          const savedColSnap = await getDocs(query(collection(db, "savedCollections"), where("threadId", "==", threadId)));
          savedColSnap.forEach(async s => await deleteDoc(doc(db, "savedCollections", s.id)));
          // Delete all notifications
          const notifSnap = await getDocs(query(collection(db, "notifications"), where("thread", "==", threadId)));
          notifSnap.forEach(async n => await deleteDoc(doc(db, "notifications", n.id)));
          // Delete the thread itself
          await deleteDoc(doc(db, "threads", threadId));
        }
        // Resolve all reports for this board
        for (const r of reports) await updateDoc(doc(db, "reports", r.id), { status: "resolved" });
        // Delete the board itself
        await deleteDoc(doc(db, "boards", data.docId));
        showToast("🗑️ Board and all related data deleted."); loadModBoards();
      });
      list.appendChild(row);
    });
  });
}

function loadModThreads() {
  const list = document.getElementById("modThreadsList");
  if (!list) return;
  list.innerHTML = '<div style="color:#bbb;font-size:13px;text-align:center;padding:20px;">Loading...</div>';
  getDocs(query(collection(db, "threads"), orderBy("createdAt", "desc"))).then(async snap => {
    list.innerHTML = "";
    if (snap.empty) { list.innerHTML = '<div style="color:#aaa;text-align:center;padding:40px;background:white;border-radius:14px;">No threads found.</div>'; return; }
    const boardsSnap = await getDocs(collection(db, "boards"));
    const boardMap = {};
    boardsSnap.forEach(b => { boardMap[b.id] = b.data().name; });
    const reportsSnap = await getDocs(query(collection(db, "reports"), where("type", "==", "thread"), where("status", "==", "pending")));
    const reportedThreads = {};
    reportsSnap.forEach(r => {
      const d = r.data();
      if (!reportedThreads[d.threadId]) reportedThreads[d.threadId] = [];
      reportedThreads[d.threadId].push({ id: r.id, ...d });
    });
    const allThreads = snap.docs.map(d => ({ docId: d.id, ...d.data(), _reports: reportedThreads[d.id] || [] }));
    allThreads.sort((a, b) => {
      const aScore = a._reports.length > 0 ? 2 : a.archived ? 0 : 1;
      const bScore = b._reports.length > 0 ? 2 : b.archived ? 0 : 1;
      return bScore - aScore;
    });
    const hasReported = allThreads.some(t => t._reports.length > 0);
    let shownReportedLabel = false;
    let shownAllLabel = false;
    allThreads.forEach(data => {
      const reports = data._reports;
      const isReported = reports.length > 0;
      const isArchived = data.archived === true;
      const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : "—";
      const boardName = boardMap[data.board] || "Unknown Board";
      if (isReported && !shownReportedLabel) {
        shownReportedLabel = true;
        const label = document.createElement("div");
        label.style.cssText = "font-size:11px;font-weight:700;color:#e53e3e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;padding-left:4px;";
        label.innerHTML = "🚨 Reported";
        list.appendChild(label);
      }
      if (!isReported && !shownAllLabel && hasReported) {
        shownAllLabel = true;
        const divider = document.createElement("div");
        divider.style.cssText = "font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;padding-left:4px;";
        divider.textContent = "All Threads";
        list.appendChild(divider);
      }
      const row = document.createElement("div");
      row.className = "admin-list-row";
      row.innerHTML = `
        <div class="admin-row-icon" style="background:${isReported ? "#fff0f0" : "#e8f3f1"};">${isArchived ? "📦" : isReported ? "🚨" : "💬"}</div>
        <div class="admin-row-info">
          <div class="admin-row-name">${data.name}
            ${isReported && !isArchived ? `<span style="font-size:11px;background:#fee2e2;color:#e53e3e;border-radius:999px;padding:2px 8px;font-weight:600;margin-left:6px;">🚨 Reported (${reports.length})</span>` : ""}
            ${isArchived ? '<span style="font-size:11px;background:#fff8e1;color:#f59e0b;border-radius:999px;padding:2px 8px;font-weight:600;margin-left:6px;">Archived</span>' : ""}
            ${!isArchived && !isReported ? '<span style="font-size:11px;background:#e8f3f1;color:#1A5849;border-radius:999px;padding:2px 8px;font-weight:600;margin-left:6px;">Active</span>' : ""}
          </div>
          <div class="admin-row-meta">by ${data.createdBy || "unknown"} • ${date} • <span style="color:#1A5849;font-weight:600;">📋 ${boardName}</span></div>
          ${isReported && !isArchived ? `<div style="font-size:11px;color:#e53e3e;margin-top:4px;">Reason: <strong>${reports[0].reason}</strong> • by ${reports[0].reportedBy}</div>` : ""}
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0;align-items:center;">
          ${isArchived
            ? `<button class="mod-restore-btn" style="width:auto!important;height:36px!important;padding:0 14px!important;border-radius:999px!important;border:none!important;background:#fff8e1!important;color:#b45309!important;font-size:13px!important;font-weight:600;cursor:pointer;margin:0!important;">↩ Restore</button>
               <button class="mod-delete-thread-btn" style="width:auto!important;height:36px!important;padding:0 14px!important;border-radius:999px!important;border:none!important;background:#fff0f0!important;color:#e53e3e!important;font-size:13px!important;font-weight:600;cursor:pointer;margin:0!important;">🗑 Delete</button>`
            : `${isReported ? `<button class="mod-dismiss-thread-btn" style="width:auto!important;height:36px!important;padding:0 14px!important;border-radius:999px!important;border:none!important;background:#e8f3f1!important;color:#1A5849!important;font-size:13px!important;font-weight:600;cursor:pointer;margin:0!important;">✓ Dismiss</button>` : ""}
               <button class="mod-archive-btn" style="width:auto!important;height:36px!important;padding:0 14px!important;border-radius:999px!important;border:none!important;background:#fff8e1!important;color:#b45309!important;font-size:13px!important;font-weight:600;cursor:pointer;margin:0!important;">📦 Archive</button>
               ${isReported ? `<button class="mod-delete-thread-btn" style="width:auto!important;height:36px!important;padding:0 14px!important;border-radius:999px!important;border:none!important;background:#fff0f0!important;color:#e53e3e!important;font-size:13px!important;font-weight:600;cursor:pointer;margin:0!important;">🗑 Delete</button>` : ""}`
          }
        </div>
      `;
      row.querySelector(".mod-dismiss-thread-btn")?.addEventListener("click", async () => {
        for (const r of reports) await updateDoc(doc(db, "reports", r.id), { status: "resolved" });
        showToast("✓ Report dismissed."); loadModThreads();
      });
      row.querySelector(".mod-archive-btn")?.addEventListener("click", async () => {
        if (!confirm(`Archive "${data.name}"?`)) return;
        await updateDoc(doc(db, "threads", data.docId), { archived: true });
        for (const r of reports) await updateDoc(doc(db, "reports", r.id), { status: "resolved" });
        showToast("📦 Thread archived."); loadModThreads();
      });
      row.querySelector(".mod-delete-thread-btn")?.addEventListener("click", async () => {
        if (!confirm(`Delete "${data.name}"? All replies, likes, saves and notifications will also be permanently deleted.`)) return;
        // Delete all replies
        const msgsSnap = await getDocs(query(collection(db, "messages"), where("thread", "==", data.docId)));
        msgsSnap.forEach(async m => await deleteDoc(doc(db, "messages", m.id)));
        // Delete all likes
        const likesSnap = await getDocs(query(collection(db, "likes"), where("threadId", "==", data.docId)));
        likesSnap.forEach(async l => await deleteDoc(doc(db, "likes", l.id)));
        // Delete all saved references
        const savedSnap = await getDocs(query(collection(db, "savedThreads"), where("threadId", "==", data.docId)));
        savedSnap.forEach(async s => await deleteDoc(doc(db, "savedThreads", s.id)));
        // Delete all saved collection references
        const savedColSnap = await getDocs(query(collection(db, "savedCollections"), where("threadId", "==", data.docId)));
        savedColSnap.forEach(async s => await deleteDoc(doc(db, "savedCollections", s.id)));
        // Delete all notifications about this thread
        const notifSnap = await getDocs(query(collection(db, "notifications"), where("thread", "==", data.docId)));
        notifSnap.forEach(async n => await deleteDoc(doc(db, "notifications", n.id)));
        // Resolve all reports
        for (const r of reports) await updateDoc(doc(db, "reports", r.id), { status: "resolved" });
        // Delete the thread itself
        await deleteDoc(doc(db, "threads", data.docId));
        showToast("🗑️ Thread and all related data deleted."); loadModThreads();
      });
      row.querySelector(".mod-restore-btn")?.addEventListener("click", async () => {
        await updateDoc(doc(db, "threads", data.docId), { archived: false });
        showToast("✅ Thread restored."); loadModThreads();
      });
      list.appendChild(row);
    });
  });
}

let _adminInitialized = false;

function initAdminPanel() {
  getDocs(query(collection(db, "users"), where("uid", "==", currentUser.uid))).then(snap => {
    const uname = !snap.empty ? (snap.docs[0].data().username || currentUser.email.split("@")[0]) : currentUser.email.split("@")[0];
    const profileIcon = !snap.empty ? (snap.docs[0].data().profileIcon || "default") : "default";
    const ic = iconMap[profileIcon] || iconMap["default"];
    const adminHiText = document.getElementById("adminHiText");
    const adminSideUsername = document.getElementById("adminSideUsername");
    const adminSideAvatar = document.getElementById("adminSideAvatar");
    if (adminHiText) adminHiText.textContent = "Hi, " + uname + "!";
    if (adminSideUsername) adminSideUsername.textContent = uname;
    if (adminSideAvatar) {
      adminSideAvatar.textContent = ic.emoji;
      adminSideAvatar.className = "ub-user-card-avatar-circle " + ic.gradientClass;
    }
  });
  const mainBadge = document.getElementById("ubNotifBadge");
  const adminBadge = document.getElementById("adminNotifBadge");
  if (adminBadge && mainBadge) {
    adminBadge.textContent = mainBadge.textContent;
    adminBadge.style.display = mainBadge.style.display;
  }
  showAdminPanel("adminPanelStats");
  loadAdminStats();
  if (_adminInitialized) return;
  _adminInitialized = true;
  document.getElementById("adminViewStatsBtn")?.addEventListener("click", () => { showAdminPanel("adminPanelStats"); loadAdminStats(); });
  document.getElementById("adminManageUsersBtn")?.addEventListener("click", () => { showAdminPanel("adminPanelUsers"); loadAdminUsers(); });
  document.getElementById("adminModerationBtn")?.addEventListener("click", () => { showAdminPanel("adminPanelModeration"); loadModerationPanel(); });
  document.getElementById("adminGoBoards")?.addEventListener("click", () => show("userboardScreen"));
  document.getElementById("adminGoProfile")?.addEventListener("click", () => { show("profileScreen"); loadProfile(); });
  document.getElementById("adminNotifBtn")?.addEventListener("click", () => show("notifScreen"));
}