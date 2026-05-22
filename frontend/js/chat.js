window.addEventListener("beforeunload", (e) => {
  console.trace("🔴 PAGE RELOADING:");
  e.preventDefault();
  e.returnValue = "";
});

const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "auth.html";

/* ===== ELEMENTS ===== */
const messages = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const typingIndicator = document.getElementById("typingIndicator");
const usersList = document.getElementById("usersList");
const fileInput = document.getElementById("fileInput");
const uploadButton = document.getElementById("uploadBtn");

/* ===== STATE ===== */
let selectedUser = null;
let currentRoom = null;

/* ===== HEADER ===== */
document.getElementById("username").textContent = user.name;
document.querySelector(".profile-avatar").textContent = user.name
  .charAt(0)
  .toUpperCase();

/* ===== AVATAR COLOR ===== */
const COLOR_CLASSES = ["c1", "c2", "c3", "c4", "c5"];
function avatarColor(username) {
  let hash = 0;
  for (const c of username)
    hash = (hash * 31 + c.charCodeAt(0)) % COLOR_CLASSES.length;
  return COLOR_CLASSES[hash];
}

/* ===== SOCKET ===== */
const socket = io("https://pulsechat-production-54e0.up.railway.app");

socket.on("disconnect", () => console.log("Socket disconnected..."));

socket.on("reconnect", () => {
  console.log("Reconnected, rejoining...");
  socket.emit("user_join", user.name);
  loadContacts();
  if (currentRoom) socket.emit("join_room", currentRoom);
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("user_join", user.name);
  loadContacts(); // ← dipanggil setelah socket benar-benar connect
});

/* ===== ONLINE USERS ===== */
socket.on("online_users", (onlineUsers) => {
  document.querySelectorAll(".user-item[data-user]").forEach((item) => {
    const username = item.dataset.user;
    const isOnline = onlineUsers.some((u) => u.username === username);
    const avatar = item.querySelector(".user-item-avatar");
    const dotAda = item.querySelector(".online-dot");

    if (isOnline && !dotAda) {
      avatar.insertAdjacentHTML("beforeend", '<div class="online-dot"></div>');
      item.querySelector(".user-item-status").textContent = "Aktif sekarang";
      item.querySelector(".user-item-status").classList.add("online");
    }

    if (!isOnline && dotAda) {
      dotAda.remove();
      item.querySelector(".user-item-status").textContent = "Ketuk untuk chat";
      item.querySelector(".user-item-status").classList.remove("online");
    }
  });
});

/* ===== LOAD KONTAK ===== */
async function loadContacts() {
  const res = await fetch(
    `https://pulsechat-production-54e0.up.railway.app/contacts?owner=${user.name}`,
  );
  const data = await res.json();
  renderContactList(data);
}

function renderContactList(contacts) {
  usersList.innerHTML = "";

  if (contacts.length === 0) {
    usersList.innerHTML = `
      <div style="padding:24px 16px; text-align:center; color:#8696a0; font-size:13px;">
        Belum ada kontak.<br>Cari teman lewat search di atas.
      </div>
    `;
    return;
  }

  contacts.forEach((username) => {
    usersList.appendChild(buatItemKontak(username));
  });
}

/* ===== BUAT ITEM KONTAK ===== */
function buatItemKontak(username) {
  const initial = username.charAt(0).toUpperCase();
  const colorClass = avatarColor(username);

  const item = document.createElement("div");
  item.classList.add("user-item");
  item.dataset.user = username;

  item.innerHTML = `
    <div class="user-item-avatar">
      <div class="user-avatar-circle ${colorClass}">${initial}</div>
    </div>
    <div class="user-item-body">
      <div class="user-item-row1">
        <span class="user-item-name">${username}</span>
      </div>
      <div class="user-item-row2">
        <span class="user-item-status">Ketuk untuk chat</span>
      </div>
    </div>
  `;

  item.addEventListener("click", () => {
    selectedUser = username;
    currentRoom = [user.name, username].sort().join("_");

    document
      .querySelectorAll(".user-item")
      .forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    if (window.innerWidth <= 768) {
      document.querySelector(".chat-room").classList.add("active");
    }

    document.getElementById("chatHeaderName").textContent = username;
    document.getElementById("chatHeaderAvatar").textContent = initial;
    document.getElementById("username").textContent = "Online";

    messages.innerHTML = "";
    socket.emit("join_room", currentRoom);

    fetch(
      `https://pulsechat-production-54e0.up.railway.app/messages?roomId=${currentRoom}`,
    )
      .then((res) => res.json())
      .then((data) => data.forEach((msg) => tampilkanPesan(msg)));
  });

  return item;
}

/* ===== SEARCH ===== */
const searchInput = document.querySelector(".search-box input");
let searchTimeout;

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();

  if (!q) {
    loadContacts();
    return;
  }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => cariUser(q), 400);
});

async function cariUser(q) {
  // Fetch hasil search DAN daftar kontak sekaligus
  const [searchRes, kontakRes] = await Promise.all([
    fetch(
      `https://pulsechat-production-54e0.up.railway.app/search-users?q=${q}&me=${user.name}`,
    ),
    fetch(
      `https://pulsechat-production-54e0.up.railway.app/contacts?owner=${user.name}`,
    ),
  ]);

  const results = await searchRes.json();
  const kontakku = await kontakRes.json();

  tampilkanHasilSearch(results, kontakku);
}

function tampilkanHasilSearch(results, kontakku = []) {
  usersList.innerHTML = "";

  if (results.length === 0) {
    usersList.innerHTML = `
      <div style="padding:24px 16px; text-align:center; color:#8696a0; font-size:13px;">
        User tidak ditemukan
      </div>
    `;
    return;
  }

  results.forEach(({ username }) => {
    const initial = username.charAt(0).toUpperCase();
    const colorClass = avatarColor(username);
    const sudahKontak = kontakku.includes(username); // cek sudah kontak atau belum

    const item = document.createElement("div");
    item.classList.add("user-item");

    item.innerHTML = `
      <div class="user-item-avatar">
        <div class="user-avatar-circle ${colorClass}">${initial}</div>
      </div>
      <div class="user-item-body">
        <div class="user-item-row1">
          <span class="user-item-name">${username}</span>
        </div>
        <div class="user-item-row2">
          <span class="user-item-status">
            ${sudahKontak ? "Sudah jadi kontak ✓" : "Ketuk untuk tambahkan"}
          </span>
        </div>
      </div>
      ${
        sudahKontak
          ? `<button class="add-btn" style="background:#128C7E; cursor:default;">✓</button>`
          : `<button class="add-btn" data-user="${username}">+ Add</button>`
      }
    `;

    if (!sudahKontak) {
      // Belum kontak — tombol add
      item.querySelector(".add-btn").addEventListener("click", async (e) => {
        e.stopPropagation();

        const btn = e.target;
        btn.textContent = "...";
        btn.disabled = true;

        const res = await fetch(
          "https://pulsechat-production-54e0.up.railway.app/add-contact",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ owner: user.name, contact: username }),
          },
        );
        const data = await res.json();

        if (res.ok) {
          btn.textContent = "✓";
          btn.style.background = "#128C7E";
          setTimeout(() => {
            searchInput.value = "";
            loadContacts();
          }, 800);
        }
      });
    } else {
      // Sudah kontak — klik langsung buka chat
      item.addEventListener("click", () => {
        searchInput.value = "";
        loadContacts().then(() => {
          setTimeout(() => {
            const kontakItem = document.querySelector(
              `.user-item[data-user="${username}"]`,
            );
            if (kontakItem) kontakItem.click();
          }, 300);
        });
      });
    }

    usersList.appendChild(item);
  });
}

/* ===== RECEIVE MESSAGE ===== */
socket.on("receive_message", (data) => {
  if (!currentRoom) return;
  if (data.roomId !== currentRoom) return;
  tampilkanPesan(data);
});

/* ===== SEND TEXT ===== */
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;
  if (!selectedUser) {
    alert("Pilih kontak dulu");
    return;
  }

  socket.emit("send_message", {
    user: user.name,
    to: selectedUser,
    roomId: currentRoom,
    message,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  messageInput.value = "";
});

/* ===== TYPING ===== */
messageInput.addEventListener("input", () => {
  socket.emit("typing", user.name);
});

socket.on("show_typing", (username) => {
  if (username === user.name) return;
  if (selectedUser && username !== selectedUser) return;

  const initial = username.charAt(0).toUpperCase();
  typingIndicator.innerHTML = `
    <div class="typing-bubble">
      <div class="typing-avatar">${initial}</div>
      <div class="typing-box">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;

  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    typingIndicator.innerHTML = "";
  }, 2000);
});

/* ===== FILE UPLOAD ===== */
uploadButton.addEventListener("click", (e) => {
  e.preventDefault();
  fileInput.click();
});

fileInput.addEventListener("change", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  try {
    if (!selectedUser) {
      alert("Pilih kontak dulu");
      return;
    }

    const file = fileInput.files[0];
    if (!file) return;

    const activeRoom = currentRoom;
    const activeUser = selectedUser;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      "https://pulsechat-production-54e0.up.railway.app/upload",
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await res.json();

    socket.emit("send_message", {
      user: user.name,
      to: activeUser,
      roomId: activeRoom,
      file: data.fileUrl,
      fileName: data.fileName,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    fileInput.value = "";
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
  }
});

/* ===== TAMPILKAN PESAN ===== */
function tampilkanPesan(data) {
  const isSelf = data.user === user.name;
  const initial = data.user ? data.user.charAt(0).toUpperCase() : "?";
  const colorClass = data.user ? avatarColor(data.user) : "";

  const wrapper = document.createElement("div");
  wrapper.classList.add("message-wrapper");
  if (isSelf) wrapper.classList.add("self");

  let contentHTML = "";
  if (data.message) {
    contentHTML = `<p>${data.message}</p>`;
  } else if (data.file) {
    contentHTML = data.file.endsWith(".pdf")
      ? `<a href="${data.file}" target="_blank" class="pdf-link">📄 ${data.fileName || "File"}</a>`
      : `<img src="${data.file}" class="message-image" onerror="this.style.display='none'">`;
  }

  wrapper.innerHTML = `
    ${!isSelf ? `<div class="message-avatar ${colorClass}">${initial}</div>` : ""}
    <div class="message ${isSelf ? "self" : ""}">
      ${!isSelf ? `<strong>${data.user || "Unknown"}</strong>` : ""}
      ${contentHTML}
      <span class="message-time">${data.time}</span>
    </div>
  `;

  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}
