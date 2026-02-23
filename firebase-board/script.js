/* ================= FIREBASE IMPORTS ================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
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

const ADMIN_EMAILS = ["admin@test.com"]; // CHANGABLE
const isAdmin = () => ADMIN_EMAILS.includes(currentUser?.email);

/* ================= STATE ================= */

let currentUser;
let currentBoard;
let currentThread;
let unsubMessages = null;

/* ================= ELEMENT HELPERS ================= */

const screens = [
  "loginScreen",
  "boardScreen",
  "threadScreen",
  "messageScreen",
  "notifScreen"
];

const show = (id) => {
  screens.forEach(s =>
    document.getElementById(s).classList.add("hidden")
  );

  document.getElementById(id).classList.remove("hidden");

  if (id === "loginScreen") {
    topBar.classList.add("hidden");
  }
};

/* ================= AUTH ================= */

loginBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
  } catch (e) {
    alert(e.message);
  }
};

logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (!user) {
    topBar.classList.add("hidden");
    return show("loginScreen");
  }

  currentUser = user;

  userInfo.textContent = `Logged in as ${user.email}`;
  topBar.classList.remove("hidden");

  if (isAdmin()) {
    adminConsoleBtn.classList.remove("hidden");
  }

  loadBoards();
  show("boardScreen");
});

/* ================= BOARDS ================= */

createBoardBtn.onclick = async () => {
  if (!newBoardInput.value.trim()) return;

  await addDoc(collection(db,"boards"), {
    name: newBoardInput.value,
    createdBy: currentUser.email,
    createdAt: serverTimestamp()
  });

  newBoardInput.value = "";
};

function loadBoards() {
  const q = query(collection(db,"boards"), orderBy("createdAt"));

  onSnapshot(q, snap => {
    boardList.innerHTML = "";

    snap.forEach(d => {
      const data = d.data();

      const div = document.createElement("div");
      div.className = "item";
      div.textContent = data.name;

      div.onclick = () => openBoard(d.id, data.name);

      if (isAdmin()) {
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.style.width = "auto";

        del.onclick = async (e) => {
          e.stopPropagation();
          await deleteDoc(doc(db,"boards",d.id));
        };

        div.appendChild(del);
      }

      boardList.appendChild(div);
    });
  });
}

function openBoard(id, name) {
  currentBoard = id;
  boardTitle.textContent = name;
  loadThreads();
  show("threadScreen");
}

/* ================= THREADS ================= */

function loadThreads() {
  const q = query(
    collection(db,"threads"),
    where("board","==",currentBoard)
  );

  onSnapshot(q, snap => {
    threadList.innerHTML = "";

    snap.forEach(d => {
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = d.data().name;

      div.onclick = () => openThread(d.id, d.data().name);

      if (isAdmin()) {
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.style.width = "auto";

        del.onclick = async (e) => {
          e.stopPropagation();
          await deleteDoc(doc(db,"threads",d.id));
        };

        div.appendChild(del);
      }

      threadList.appendChild(div);
    });
  });
}

createThreadBtn.onclick = async () => {
  if (!newThreadInput.value.trim()) return;

  await addDoc(collection(db,"threads"), {
    board: currentBoard,
    name: newThreadInput.value
  });

  newThreadInput.value = "";
};

/* ================= MESSAGES ================= */

function openThread(id, name) {
  currentThread = id;
  threadTitle.textContent = name;
  show("messageScreen");

  if (unsubMessages) unsubMessages();

  const q = query(
    collection(db,"messages"),
    where("thread","==",currentThread),
    orderBy("time","asc")
  );

  unsubMessages = onSnapshot(q, snap => {
    messageList.innerHTML = "";

    snap.forEach(d => {
      const m = d.data();

      const div = document.createElement("div");
      div.className =
        `message ${m.author===currentUser.email?"mine":"other"}`;

      div.innerHTML = `
        <strong>${m.author}</strong><br>
        ${m.text ? `<p>${m.text}</p>` : ""}
      `;

      if (isAdmin()) {
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.style.width = "auto";

        del.onclick = async () => {
          await deleteDoc(doc(db,"messages",d.id));
        };

        div.appendChild(del);
      }

      messageList.appendChild(div);
    });

    messageList.scrollTop = messageList.scrollHeight;
  });
}

sendBtn.onclick = async () => {
  if (!messageInput.value.trim()) return;

  await addDoc(collection(db,"messages"), {
    thread: currentThread,
    author: currentUser.email,
    text: messageInput.value,
    time: serverTimestamp()
  });

  messageInput.value = "";
};

/* ================= NAVIGATION ================= */

backBoards.onclick = () => show("boardScreen");
backThreads.onclick = () => show("threadScreen");
homeBtn.onclick = () => show("boardScreen");
notifBtn.onclick = () => show("notifScreen");
backHome.onclick = () => show("boardScreen");

/* ================= ADMIN CONSOLE ================= */

adminConsoleBtn.onclick = () => {
  window.open("https://console.firebase.google.com/", "_blank");
};
