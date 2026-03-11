/* ================= FIREBASE IMPORTS ================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
const storage = getStorage(app);

/* ================= ADMIN SYSTEM ================= */

const ADMIN_EMAILS = ["admin@test.com"];
const isAdmin = () => ADMIN_EMAILS.includes(currentUser?.email);

/* ================= STATE ================= */

let currentUser;
let currentBoard;
let currentThread;
let unsubMessages = null;
let allBoards = []; // for search filtering

/* ================= ELEMENT HELPERS ================= */

const screens = [
  "loginScreen",
  "registerScreen",
  "userboardScreen",
  "profileScreen",
  "boardScreen",
  "threadScreen",
  "messageScreen",
  "notifScreen",
  "adminScreen"
];

function show(id) {
  screens.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.add("hidden");
  });

  const target = document.getElementById(id);
  if (target) target.classList.remove("hidden");

  const topBar = document.getElementById("topBar");
  // Hide the old top bar on login, register, AND userboard (userboard has its own nav)
  // Always hide the old topBar — all screens have their own navbar
  topBar.classList.add("hidden");
}

/* ================= USERBOARD HELPERS ================= */

function setGreeting() {
  const hour = new Date().getHours();
  let greeting = "Good morning 👋";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon 👋";
  else if (hour >= 17) greeting = "Good evening 👋";
  const el = document.getElementById("ubGreeting");
  if (el) el.textContent = greeting;
}

function populateUserboardUser(user) {
  // Sidebar user info
  document.getElementById("ubSideEmail").textContent = user.email;

  // Try to get username from Firestore
  getDocs(query(collection(db, "users"), where("uid", "==", user.uid))).then(snap => {
    if (!snap.empty) {
      const uname = snap.docs[0].data().username || user.email.split("@")[0];
      document.getElementById("ubSideUsername").textContent = uname;
    } else {
      document.getElementById("ubSideUsername").textContent = user.email.split("@")[0];
    }
  });

  // Show admin button if admin
  if (isAdmin()) {
    const adminBtn = document.getElementById("ubGoAdmin");
    if (adminBtn) adminBtn.classList.remove("hidden");
  }
}

function loadUserboardStats() {
  // Count boards
  getDocs(collection(db, "boards")).then(s => {
    document.getElementById("ubStatBoards").textContent = s.size;
  });
  // Count threads
  getDocs(collection(db, "threads")).then(s => {
    document.getElementById("ubStatThreads").textContent = s.size;
  });
  // Count messages
  getDocs(collection(db, "messages")).then(s => {
    document.getElementById("ubStatMessages").textContent = s.size;
  });
  // Count users
  getDocs(collection(db, "users")).then(s => {
    document.getElementById("ubStatUsers").textContent = s.size;
  });
}

function loadUserboardBoards(filter = "all") {
  const grid = document.getElementById("ubBoardsGrid");
  onSnapshot(collection(db, "boards"), (snap) => {
    // Cache all boards for search
    allBoards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBoardGrid(allBoards, filter, grid);
  });
}

function renderBoardGrid(boards, filter, grid) {
  grid = grid || document.getElementById("ubBoardsGrid");
  grid.innerHTML = "";
  let filtered = boards;
  if (filter && filter !== "all") {
    filtered = boards.filter(b => (b.name || "").toLowerCase().includes(filter));
  }
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="ub-empty">No boards found.</div>';
    return;
  }
  filtered.forEach(b => {
    const card = document.createElement("div");
    card.className = "ub-board-card";
    card.innerHTML = `
      <div class="ub-board-icon">📋</div>
      <div class="ub-board-name">${b.name}</div>
      <div class="ub-board-meta">by ${b.createBy || "unknown"}</div>
    `;
    card.onclick = () => {
      currentBoard = b.id;
      show("threadScreen");
      loadThreads();
      document.getElementById("boardTitle").textContent = b.name;
    };
    grid.appendChild(card);
  });
}

function showDropdown(boards) {
  const searchDropdown = document.getElementById("ubSearchDropdown");
  const query = document.getElementById("ubSearchInput").value.trim().toLowerCase();
  searchDropdown.innerHTML = "";

  const filtered = query
    ? boards.filter(b => (b.name || "").toLowerCase().includes(query))
    : boards;

  if (filtered.length === 0) {
    searchDropdown.innerHTML = `<div class="ub-search-no-result">No boards found.</div>`;
  } else {
    filtered.forEach(b => {
      const item = document.createElement("div");
      item.className = "ub-search-item";
      const highlighted = b.name.replace(
        new RegExp(query || "x^", "gi"),
        m => `<strong>${m}</strong>`
      );
      item.innerHTML = `
        <span class="ub-search-item-icon">📋</span>
        <span class="ub-search-item-text">${query ? highlighted : b.name}</span>
        <span class="ub-search-item-meta">${b.createBy || "unknown"}</span>
      `;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        currentBoard = b.id;
        document.getElementById("boardTitle").textContent = b.name;
        show("threadScreen");
        loadThreads();
        document.getElementById("ubSearchInput").value = "";
        document.getElementById("ubSearchClear").textContent = "🔍";
        searchDropdown.classList.add("hidden");
      });
      searchDropdown.appendChild(item);
    });
  }
  searchDropdown.classList.remove("hidden");
}

function filterBoards(query) {
  // Show search results panel
  const grid = document.getElementById("ubBoardsGrid");
  if (!query) {
    renderBoardGrid(allBoards, "all", grid);
    return;
  }
  const results = allBoards.filter(b =>
    (b.name || "").toLowerCase().includes(query)
  );
  grid.innerHTML = "";
  if (results.length === 0) {
    grid.innerHTML = `<div class="ub-empty">No boards matching "<strong>${query}</strong>"</div>`;
    return;
  }
  results.forEach(b => {
    const card = document.createElement("div");
    card.className = "ub-board-card";
    // Highlight matching text
    const highlighted = b.name.replace(
      new RegExp(query, "gi"),
      m => `<mark style="background:#c6e8e2;border-radius:3px;padding:0 2px;">${m}</mark>`
    );
    card.innerHTML = `
      <div class="ub-board-icon">📋</div>
      <div class="ub-board-name">${highlighted}</div>
      <div class="ub-board-meta">by ${b.createBy || "unknown"}</div>
    `;
    card.onclick = () => {
      currentBoard = b.id;
      show("threadScreen");
      loadThreads();
      document.getElementById("boardTitle").textContent = b.name;
    };
    grid.appendChild(card);
  });
}

function initUserboard(user) {
  setGreeting();
  populateUserboardUser(user);
  loadUserboardStats();
  loadUserboardBoards();
  // Load saved icon
  getDocs(query(collection(db, "users"), where("uid", "==", user.uid))).then(snap => {
    if (!snap.empty) {
      const icon = snap.docs[0].data().profileIcon || "default";
      applyIcon(icon);
    }
  });
}

/* ================= AUTH ================= */

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("topBar").classList.add("hidden");
    show("loginScreen");

    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        // ✅ Go to userboard after login
        show("userboardScreen");
        initUserboard(user);
        loadBoards();
        loadNotifications();
      } else {
        currentUser = null;
        show("loginScreen");
      }
    });

    // Buttons
    const loginBtn = document.getElementById("loginBtn");
    const registerBtn = document.getElementById("registerBtn");
    const backToLoginBtn = document.getElementById("backToLoginBtn");
    const goRegisterBtn = document.getElementById("goRegisterBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const adminConsoleBtn = document.getElementById("adminConsoleBtn");

    // Inputs
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const registerEmail = document.getElementById("registerEmail");
    const registerPassword = document.getElementById("registerPassword");
    const registerUsername = document.getElementById("registerUsername");

    // LOGIN
    loginBtn.addEventListener("click", async () => {
        try {
            await signInWithEmailAndPassword(auth, email.value, password.value);
            // onAuthStateChanged handles the redirect to userboardScreen
        } catch (e) {
            alert(e.message);
        }
    });

    // REGISTER
    registerBtn.addEventListener("click", async () => {
        try {
            const userCred = await createUserWithEmailAndPassword(
                auth,
                registerEmail.value,
                registerPassword.value
            );
            await addDoc(collection(db, "users"), {
                uid: userCred.user.uid,
                email: registerEmail.value,
                username: registerUsername.value
            });
            alert("Account created successfully!");
            show("loginScreen");
        } catch (e) {
            alert(e.message);
        }
    });

    // BOARDS (legacy)
    const createBoardBtn = document.getElementById("createBoardBtn");
    const newBoardInput = document.getElementById("newBoardInput");

    createBoardBtn.addEventListener("click", async () => {
      if (!newBoardInput.value.trim()) return;
      const boardName = newBoardInput.value.trim();
      await addDoc(collection(db, "boards"), {
        name: boardName,
        createBy: currentUser.email,
        createdAt: serverTimestamp()
      });
      await addDoc(collection(db, "notifications"), {
        type: "new_board",
        message: `📋 New board created: "${boardName}" by ${currentUser.email}`,
        createdBy: currentUser.email,
        createdAt: serverTimestamp(),
        readBy: [currentUser.uid]
      });
      newBoardInput.value = "";
    });

    // THREADS
    const createThreadBtn = document.getElementById("createThreadBtn");
    const newThreadInput = document.getElementById("newThreadInput");

    createThreadBtn.addEventListener("click", async () => {
      if (!newThreadInput.value.trim()) return;
      await addDoc(collection(db, "threads"), {
        board: currentBoard,
        name: newThreadInput.value
      });
      newThreadInput.value = "";
    });

    // MESSAGES
    const sendBtn = document.getElementById("sendBtn");
    const messageInput = document.getElementById("messageInput");
    const msgAttachBtn = document.getElementById("msgAttachBtn");
    const msgImageFile = document.getElementById("msgImageFile");
    const msgImagePreview = document.getElementById("msgImagePreview");
    const msgImageThumb = document.getElementById("msgImageThumb");
    const msgRemoveImg = document.getElementById("msgRemoveImg");
    let msgSelectedImage = null;

    msgAttachBtn.addEventListener("click", () => msgImageFile.click());

    msgImageFile.addEventListener("change", () => {
      const file = msgImageFile.files[0];
      if (!file) return;
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(isVideo ? "Video must be under 100MB" : "Image must be under 10MB");
        return;
      }
      msgSelectedImage = file;
      const url = URL.createObjectURL(file);
      // Show preview
      msgImagePreview.innerHTML = "";
      if (isVideo) {
        const vid = document.createElement("video");
        vid.src = url;
        vid.controls = true;
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

    // Keep old remove button working too
    if (msgRemoveImg) {
      msgRemoveImg.addEventListener("click", () => {
        msgSelectedImage = null;
        msgImageThumb.src = "";
        msgImagePreview.classList.add("hidden");
        msgImageFile.value = "";
      });
    }



    sendBtn.addEventListener("click", async () => {
      const text = messageInput.value.trim();
      if (!text && !msgSelectedImage) return;

      let mediaURL = null;
      let mediaType = null;
      if (msgSelectedImage) {
        sendBtn.textContent = "⏳";
        sendBtn.disabled = true;
        const isVideo = msgSelectedImage.type.startsWith("video/");
        mediaType = isVideo ? "video" : "image";
        const folder = isVideo ? "videos" : "images";
        const storageRef = ref(storage, `messages/${folder}/${currentThread}/${Date.now()}_${msgSelectedImage.name}`);
        const snapshot = await uploadBytes(storageRef, msgSelectedImage);
        mediaURL = await getDownloadURL(snapshot.ref);
        sendBtn.textContent = "Send";
        sendBtn.disabled = false;
      }

      await addDoc(collection(db, "messages"), {
        thread: currentThread,
        author: currentUser.email,
        text: text || "",
        image: mediaType === "image" ? mediaURL : null,
        video: mediaType === "video" ? mediaURL : null,
        time: serverTimestamp()
      });
      // Notify others who posted in this thread
      const threadSnap = await getDocs(query(collection(db, "messages"), where("thread", "==", currentThread)));
      const otherAuthors = [...new Set(threadSnap.docs.map(d => d.data().author).filter(a => a !== currentUser.email))];
      if (otherAuthors.length > 0) {
        const threadTitle = document.getElementById("threadTitle").textContent;
        await addDoc(collection(db, "notifications"), {
          type: "new_reply",
          message: `💬 ${currentUser.email} replied in "${threadTitle}"`,
          thread: currentThread,
          threadTitle: threadTitle,
          createdBy: currentUser.email,
          forUsers: otherAuthors,
          createdAt: serverTimestamp(),
          readBy: [currentUser.uid]
        });
      }

      messageInput.value = "";
      msgSelectedImage = null;
      msgImagePreview.innerHTML = "";
      msgImagePreview.classList.add("hidden");
      msgImageFile.value = "";
    });

    // Also send on Enter (Shift+Enter for newline)
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    // NAVIGATION
    const backBoards = document.getElementById("backBoards");
    const backThreads = document.getElementById("backThreads");
    const homeBtn = document.getElementById("homeBtn");
    const notifBtn = document.getElementById("notifBtn");
    const backHome = document.getElementById("backHome");

    backBoards.addEventListener("click", () => show("userboardScreen"));
    document.getElementById("backFromBoards").addEventListener("click", () => show("userboardScreen"));
    backThreads.addEventListener("click", () => show("threadScreen"));
    homeBtn.addEventListener("click", () => show("userboardScreen"));     // ← goes to userboard
    notifBtn.addEventListener("click", () => show("notifScreen"));
    backHome.addEventListener("click", () => show("userboardScreen"));    // ← goes to userboard
    backToLoginBtn.addEventListener("click", () => show("loginScreen"));
    goRegisterBtn.addEventListener("click", () => show("registerScreen"));
    logoutBtn.addEventListener("click", () => signOut(auth));
    adminConsoleBtn.addEventListener("click", () => {
        window.open("https://console.firebase.google.com/", "_blank");
    });

    // SEARCH BAR
    const searchInput = document.getElementById("ubSearchInput");
    const searchClear = document.getElementById("ubSearchClear");
    const searchDropdown = document.getElementById("ubSearchDropdown");
    let dropdownOpen = false;

    function openDropdown() {
      const query = searchInput.value.trim().toLowerCase();
      const results = query
        ? allBoards.filter(b => (b.name || "").toLowerCase().includes(query))
        : allBoards;

      searchDropdown.innerHTML = "";
      if (results.length === 0) {
        searchDropdown.innerHTML = `<div class="ub-search-no-result">No boards found${query ? ` for "<strong>${query}</strong>"` : ""}.</div>`;
      } else {
        results.forEach(b => {
          const item = document.createElement("div");
          item.className = "ub-search-item";
          const highlighted = query
            ? b.name.replace(new RegExp(query, "gi"), m => `<strong>${m}</strong>`)
            : b.name;
          item.innerHTML = `
            <span class="ub-search-item-icon">📋</span>
            <span class="ub-search-item-text">${highlighted}</span>
            <span class="ub-search-item-meta">${b.createBy || "unknown"}</span>
          `;
          item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            currentBoard = b.id;
            document.getElementById("boardTitle").textContent = b.name;
            show("threadScreen");
            loadThreads();
            searchInput.value = "";
            searchClear.textContent = "🔍";
            closeDropdown();
          });
          searchDropdown.appendChild(item);
        });
      }
      searchDropdown.classList.remove("hidden");
      dropdownOpen = true;
    }

    function closeDropdown() {
      searchDropdown.classList.add("hidden");
      dropdownOpen = false;
    }

    // Open on focus
    searchInput.addEventListener("focus", () => openDropdown());

    // Filter as user types
    searchInput.addEventListener("input", () => {
      searchClear.textContent = searchInput.value.trim() ? "✕" : "🔍";
      openDropdown();
    });

    // Icon click: toggle or clear
    searchClear.addEventListener("mousedown", (e) => {
      e.preventDefault(); // prevent input blur
      if (searchInput.value.trim()) {
        // Clear the input
        searchInput.value = "";
        searchClear.textContent = "🔍";
        searchInput.focus();
        openDropdown();
      } else if (dropdownOpen) {
        // Close dropdown
        closeDropdown();
      } else {
        // Open dropdown
        searchInput.focus();
        openDropdown();
      }
    });

    // Close when clicking outside all search elements
    document.addEventListener("mousedown", (e) => {
      if (
        !searchInput.contains(e.target) &&
        !searchDropdown.contains(e.target) &&
        !searchClear.contains(e.target)
      ) {
        closeDropdown();
      }
    });

    // USERBOARD NAVIGATION
    document.getElementById("ubLogoutBtn").addEventListener("click", () => signOut(auth));
    document.getElementById("ubNotifBtn").addEventListener("click", () => show("notifScreen"));
    document.getElementById("ubGoBoards").addEventListener("click", () => show("boardScreen"));
    document.getElementById("ubGoCategories").addEventListener("click", () => show("boardScreen"));
    document.getElementById("ubGoProfile").addEventListener("click", () => {
      show("profileScreen");
      loadProfile();
    });
    document.getElementById("ubGoAdmin").addEventListener("click", () => show("adminScreen"));
    document.getElementById("backFromProfile").addEventListener("click", () => show("userboardScreen"));
    document.getElementById("ubViewAllBoards").addEventListener("click", () => show("boardScreen"));

    // Create board from dashboard
    document.getElementById("ubCreateBoardBtn").addEventListener("click", async () => {
      const input = document.getElementById("ubNewBoardInput");
      if (!input.value.trim()) return;
      const boardName = input.value.trim();
      await addDoc(collection(db, "boards"), {
        name: boardName,
        createBy: currentUser.email,
        createdAt: serverTimestamp()
      });
      // Notify all users about new board
      await addDoc(collection(db, "notifications"), {
        type: "new_board",
        message: `📋 New board created: "${boardName}" by ${currentUser.email}`,
        createdBy: currentUser.email,
        createdAt: serverTimestamp(),
        readBy: [currentUser.uid]  // creator doesn't need to see their own notif
      });
      input.value = "";
    });
});

/* ================= Functions ================= */

function loadBoards() {
    const boardList = document.getElementById("boardList");
    onSnapshot(collection(db, "boards"), (snap) => {
      boardList.innerHTML = "";
      snap.forEach(d => {
        const div = document.createElement("div");
        div.className = "item";
        div.textContent = d.data().name;
        div.onclick = () => {
          currentBoard = d.id;
          document.getElementById("boardTitle").textContent = d.data().name;
          show("threadScreen");
          loadThreads();
        };
        boardList.appendChild(div);
      });
    });
  }

function loadThreads() {
    const threadList = document.getElementById("threadList");
    onSnapshot(query(collection(db, "threads"), where("board", "==", currentBoard)), (snap) => {
      threadList.innerHTML = "";
      if (snap.empty) {
        threadList.innerHTML = '<div class="sp-thread-empty">No threads yet. Create the first one!</div>';
        return;
      }
      snap.forEach((d, i) => {
        const data = d.data();
        const colors = ["#1A5849","#2F645F","#3d8a80","#4a9e92","#1e6b5e"];
        const color = colors[i % colors.length];
        const initials = data.name.slice(0,2).toUpperCase();
        const div = document.createElement("div");
        div.className = "sp-thread-card";
        div.innerHTML = `
          <div class="sp-thread-avatar" style="background:${color}">${initials}</div>
          <div class="sp-thread-info">
            <div class="sp-thread-name">${data.name}</div>
            <div class="sp-thread-meta">Click to view messages</div>
          </div>
          <div class="sp-thread-arrow">›</div>
        `;
        div.onclick = () => {
          currentThread = d.id;
          document.getElementById("threadTitle").textContent = data.name;
          show("messageScreen");
          loadMessages();
        };
        threadList.appendChild(div);
      });
    });
  }

function applyIcon(icon) {
  const iconMap = {
    default: { emoji: "👤", class: "gradient-default" },
    fire:    { emoji: "🔥", class: "gradient-fire" },
    star:    { emoji: "⭐", class: "gradient-star" },
    bolt:    { emoji: "⚡", class: "gradient-bolt" }
  };
  const ic = iconMap[icon] || iconMap["default"];

  // Profile page avatar
  const av = document.getElementById("profileAvatarCircle");
  if (av) { av.textContent = ic.emoji; av.className = "profile-avatar-circle " + ic.class; }

  // Sidebar avatar
  const sideAv = document.getElementById("ubSideAvatar");
  if (sideAv) {
    sideAv.style.display = "none";
    let sideIcon = document.getElementById("ubSideIconCircle");
    if (!sideIcon) {
      sideIcon = document.createElement("div");
      sideIcon.id = "ubSideIconCircle";
      sideIcon.className = "ub-side-icon-circle";
      sideAv.parentNode.insertBefore(sideIcon, sideAv);
    }
    sideIcon.textContent = ic.emoji;
    sideIcon.className = "ub-side-icon-circle " + ic.class;
  }

  // Navbar avatar
  const navAv = document.getElementById("ubAvatar");
  if (navAv) {
    navAv.style.display = "none";
    let navIcon = document.getElementById("ubNavIconCircle");
    if (!navIcon) {
      navIcon = document.createElement("div");
      navIcon.id = "ubNavIconCircle";
      navIcon.className = "ub-nav-icon-circle";
      navAv.parentNode.insertBefore(navIcon, navAv);
    }
    navIcon.textContent = ic.emoji;
    navIcon.className = "ub-nav-icon-circle " + ic.class;
  }
}

function loadProfile() {
  const user = currentUser;
  document.getElementById("profileEmail").textContent = user.email;

  // Set avatar initials
  const initials = user.email.slice(0, 2).toUpperCase();
  document.getElementById("profileAvatarCircle").textContent = initials;

  const iconMap = {
    default: { emoji: "👤", class: "gradient-default" },
    fire:    { emoji: "🔥", class: "gradient-fire" },
    star:    { emoji: "⭐", class: "gradient-star" },
    bolt:    { emoji: "⚡", class: "gradient-bolt" }
  };

  let selectedIcon = "default";

  // Icon picker click
  document.querySelectorAll(".profile-icon-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".profile-icon-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedIcon = opt.dataset.icon;
      applyIcon(selectedIcon);
    });
  });

  // Load from Firestore
  getDocs(query(collection(db, "users"), where("uid", "==", user.uid))).then(snap => {
    let userData = {};
    if (!snap.empty) userData = snap.docs[0].data();

    const username = userData.username || user.email.split("@")[0];
    document.getElementById("profileUsername").textContent = username;
    document.getElementById("profileUsernameInput").value = username;
    document.getElementById("profileBioInput").value = userData.bio || "";

    // Restore saved icon
    selectedIcon = userData.profileIcon || "default";
    document.querySelectorAll(".profile-icon-option").forEach(o => {
      o.classList.toggle("selected", o.dataset.icon === selectedIcon);
    });
    applyIcon(selectedIcon);

    // Joined date
    const joined = snap.docs[0]?.data()?.joinedAt?.toDate?.();
    document.getElementById("profileJoined").textContent = joined
      ? `Joined: ${joined.toLocaleDateString()}`
      : `Joined: ${new Date(user.metadata.creationTime).toLocaleDateString()}`;
  });

  // Load activity stats
  getDocs(query(collection(db, "messages"), where("author", "==", user.email))).then(s => {
    document.getElementById("profileStatPosts").textContent = s.size;
  });
  getDocs(query(collection(db, "threads"), where("board", "!=", ""))).then(s => {
    // Count threads created by user (approximate — threads don't store createdBy yet)
    document.getElementById("profileStatThreads").textContent = "—";
  });
  getDocs(query(collection(db, "boards"), where("createBy", "==", user.email))).then(s => {
    document.getElementById("profileStatBoards").textContent = s.size;
  });

  // Save button
  const saveBtn = document.getElementById("profileSaveBtn");
  const saveMsg = document.getElementById("profileSaveMsg");

  // Remove old listener by cloning
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  newSaveBtn.addEventListener("click", async () => {
    const newUsername = document.getElementById("profileUsernameInput").value.trim();
    const newBio = document.getElementById("profileBioInput").value.trim();
    if (!newUsername) return;

    newSaveBtn.textContent = "Saving...";
    newSaveBtn.disabled = true;

    const snap = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
    if (!snap.empty) {
      await updateDoc(doc(db, "users", snap.docs[0].id), {
        username: newUsername,
        bio: newBio,
        profileIcon: selectedIcon
      });
    } else {
      await addDoc(collection(db, "users"), {
        uid: user.uid,
        email: user.email,
        username: newUsername,
        bio: newBio,
        profileIcon: selectedIcon
      });
    }

    // Update sidebar
    document.getElementById("ubSideUsername").textContent = newUsername;
    document.getElementById("profileUsername").textContent = newUsername;
    applyIcon(selectedIcon);

    newSaveBtn.textContent = "Save Changes";
    newSaveBtn.disabled = false;
    saveMsg.classList.remove("hidden");
    setTimeout(() => saveMsg.classList.add("hidden"), 3000);
  });
}

function loadNotifications() {
  const notifList = document.getElementById("notifList");
  notifList.innerHTML = "";

  onSnapshot(
    query(collection(db, "notifications"), orderBy("createdAt", "desc")),
    (snap) => {
      const uid = currentUser.uid;
      const email = currentUser.email;

      // Filter: show if it's a new_board (not created by me) OR a new_reply (forUsers includes me)
      const mine = snap.docs.filter(d => {
        const data = d.data();
        if (data.readBy?.includes(uid)) return false; // already read
        if (data.type === "new_board" && data.createdBy !== email) return true;
        if (data.type === "new_reply" && data.forUsers?.includes(email)) return true;
        return false;
      });

      // Update badge
      const badge = document.getElementById("ubNotifBadge");
      if (badge) {
        badge.textContent = mine.length;
        badge.style.display = mine.length > 0 ? "flex" : "none";
      }

      // Render all visible notifications (unread first)
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
        item.innerHTML = `
          <div class="notif-msg">${data.message}</div>
          <div class="notif-time">${time}</div>
        `;
        // Click to mark as read and navigate if reply
        item.addEventListener("click", async () => {
          if (!isRead) {
            await updateDoc(doc(db, "notifications", d.id), {
              readBy: [...(data.readBy || []), uid]
            });
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
    }
  );
}

function loadMessages() {
    const messageList = document.getElementById("messageList");
    onSnapshot(
      query(collection(db, "messages"), where("thread", "==", currentThread), orderBy("time")),
      (snap) => {
        messageList.innerHTML = "";
        snap.forEach(d => {
          const data = d.data();
          const div = document.createElement("div");
          div.className = "message " + (data.author === currentUser.email ? "mine" : "other");
          div.innerHTML = `
            ${data.image ? `<img class="msg-image" src="${data.image}" alt="image" onclick="window.open(this.src,'_blank')">` : ""}
            ${data.video ? `<video class="msg-video" src="${data.video}" controls></video>` : ""}
            ${data.text ? `<div>${data.text}</div>` : ""}
            <div class="small">${data.author}</div>
          `;
          messageList.appendChild(div);
        });
        messageList.scrollTop = messageList.scrollHeight;
      }
    );
  }