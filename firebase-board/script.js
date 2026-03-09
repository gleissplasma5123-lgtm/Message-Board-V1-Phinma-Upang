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

/* ================= ADMIN SYSTEM ================= */

const ADMIN_EMAILS = ["admin@test.com"];
const isAdmin = () => ADMIN_EMAILS.includes(currentUser?.email);

/* ================= STATE ================= */

let currentUser;
let currentBoard;
let currentThread;
let unsubMessages = null;

/* ================= ELEMENT HELPERS ================= */

const screens = [
  "loginScreen",
  "registerScreen",
  "userboardScreen",   // ← NEW
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
    grid.innerHTML = "";
    if (snap.empty) {
      grid.innerHTML = '<div class="ub-empty-msg">No boards yet. Be the first to create one!</div>';
      return;
    }
    let docs = snap.docs;
    if (filter !== "all") {
      docs = docs.filter(d => (d.data().name || "").toLowerCase().includes(filter));
    }
    if (docs.length === 0) {
      grid.innerHTML = '<div class="ub-empty-msg">No boards in this category.</div>';
      return;
    }
    docs.forEach(d => {
      const card = document.createElement("div");
      card.className = "ub-board-card";
      card.innerHTML = `
        <div class="ub-board-icon">📋</div>
        <div class="ub-board-name">${d.data().name}</div>
        <div class="ub-board-meta">by ${d.data().createBy || "unknown"}</div>
      `;
      card.onclick = () => {
        currentBoard = d.id;
        show("threadScreen");
        loadThreads();
        document.getElementById("boardTitle").textContent = d.data().name;
      };
      grid.appendChild(card);
    });
  });
}

function initUserboard(user) {
  setGreeting();
  populateUserboardUser(user);
  loadUserboardStats();
  loadUserboardBoards();
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
        loadBoards(); // keep boards loaded in background for thread navigation
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
      await addDoc(collection(db, "boards"), {
        name: newBoardInput.value,
        createBy: currentUser.email,
        createdAt: serverTimestamp()
      });
      newBoardInput.value = "";
    });

    // USERBOARD: Create board from dashboard
    document.getElementById("ubCreateBoardBtn").addEventListener("click", async () => {
      const input = document.getElementById("ubNewBoardInput");
      if (!input.value.trim()) return;
      await addDoc(collection(db, "boards"), {
        name: input.value,
        createBy: currentUser.email,
        createdAt: serverTimestamp()
      });
      input.value = "";
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

    sendBtn.addEventListener("click", async () => {
      if (!messageInput.value.trim()) return;
      await addDoc(collection(db, "messages"), {
        thread: currentThread,
        author: currentUser.email,
        text: messageInput.value,
        time: serverTimestamp()
      });
      messageInput.value = "";
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

    // USERBOARD NAVIGATION
    document.getElementById("ubLogoutBtn").addEventListener("click", () => signOut(auth));
    document.getElementById("ubNotifBtn").addEventListener("click", () => show("notifScreen"));
    document.getElementById("ubGoBoards").addEventListener("click", () => show("boardScreen"));
    document.getElementById("ubGoCategories").addEventListener("click", () => show("boardScreen"));
    document.getElementById("ubGoProfile").addEventListener("click", () => alert("Profile page coming soon!"));
    document.getElementById("ubGoAdmin").addEventListener("click", () => show("adminScreen"));
    document.getElementById("ubViewAllBoards").addEventListener("click", () => show("boardScreen"));

    // Create board from dashboard
    document.getElementById("ubCreateBoardBtn").addEventListener("click", async () => {
      const input = document.getElementById("ubNewBoardInput");
      if (!input.value.trim()) return;
      await addDoc(collection(db, "boards"), {
        name: input.value,
        createBy: currentUser.email,
        createdAt: serverTimestamp()
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
          div.innerHTML = `<div>${data.text}</div><div class="small">${data.author}</div>`;
          messageList.appendChild(div);
        });
        messageList.scrollTop = messageList.scrollHeight;
      }
    );
  }