window.addEventListener("beforeunload", (e) => {
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
let selectedFile = null;

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
  socket.emit("user_join", user.name);
  loadContacts();
  if (currentRoom) socket.emit("join_room", currentRoom);
});

socket.on("connect", () => {
  socket.emit("user_join", user.name);
  loadContacts();
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
    socket.emit("mark_read", { roomId: currentRoom, reader: user.name });

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
    const sudahKontak = kontakku.includes(username);

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

socket.on("message_deleted", (messageId) => {
  const messageEl = document.querySelector(`[data-id="${messageId}"]`);
  if (messageEl) messageEl.remove();
});

socket.on("messages_read", ({ roomId }) => {
  if (roomId !== currentRoom) return;
  document.querySelectorAll(".message-status").forEach((el) => {
    el.textContent = "✓✓";
    el.style.color = "#53bdeb";
  });
});

/* ===== SEND TEXT ===== */
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!selectedUser) {
    alert("Pilih kontak dulu");
    return;
  }

  const message = messageInput.value.trim();
  let uploadedFileUrl = "";
  let uploadedFileName = "";

  try {
    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(
        "https://pulsechat-production-54e0.up.railway.app/upload",
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await res.json();
      uploadedFileUrl = data.fileUrl;
      uploadedFileName = data.fileName;
    }

    socket.emit("send_message", {
      user: user.name,
      to: selectedUser,
      roomId: currentRoom,
      message,
      file: uploadedFileUrl,
      fileName: uploadedFileName,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    messageInput.value = "";
    selectedFile = null;
    fileInput.value = "";
    document.getElementById("filePreview").style.display = "none";
  } catch (error) {
    console.error(error);
  }
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

fileInput.addEventListener("change", (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!selectedUser) {
    alert("Pilih kontak dulu");
    return;
  }

  const file = fileInput.files[0];
  if (!file) return;

  selectedFile = file;
  document.getElementById("filePreview").style.display = "flex";
  document.getElementById("fileNamePreview").textContent = file.name;
});

/* ===== TAMPILKAN PESAN ===== */
function tampilkanPesan(data) {
  const isSelf = data.user === user.name;
  const initial = data.user ? data.user.charAt(0).toUpperCase() : "?";
  const colorClass = data.user ? avatarColor(data.user) : "";

  const wrapper = document.createElement("div");
  wrapper.dataset.id = data._id?.toString();
  wrapper.classList.add("message-wrapper");
  if (isSelf) wrapper.classList.add("self");

  let contentHTML = "";
  if (data.file) {
    contentHTML = data.file.endsWith(".pdf")
      ? `<a href="${data.file}" target="_blank" class="pdf-link">📄 ${data.fileName || "File"}</a>`
      : `<img src="${data.file}" class="message-image">`;
    if (data.message) contentHTML += `<p>${data.message}</p>`;
  } else if (data.message) {
    contentHTML = `<p>${data.message}</p>`;
  }

  wrapper.innerHTML = `
    ${!isSelf ? `<div class="message-avatar ${colorClass}">${initial}</div>` : ""}
    <div class="message ${isSelf ? "self" : ""}">
      ${!isSelf ? `<strong>${data.user || "Unknown"}</strong>` : ""}
      ${contentHTML}
      <div class="message-meta">
        <span class="message-time">${data.time}</span>
        ${isSelf ? `<span class="message-status" style="font-size:13px;color:#667781;margin-left:4px;">${data.read ? "✓✓" : "✓"}</span>` : ""}
      </div>
    </div>
  `;

  if (isSelf) {
    let pressTimer;
    const onPressStart = () => {
      pressTimer = setTimeout(() => {
        if (confirm("Hapus pesan untuk semua orang?")) {
          socket.emit("delete_message", {
            messageId: data._id?.toString(),
            roomId: currentRoom,
          });
        }
      }, 600);
    };
    const onPressEnd = () => clearTimeout(pressTimer);

    wrapper.addEventListener("mousedown", onPressStart);
    wrapper.addEventListener("mouseup", onPressEnd);
    wrapper.addEventListener("mouseleave", onPressEnd);
    wrapper.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        onPressStart();
      },
      { passive: false },
    );
    wrapper.addEventListener("touchend", onPressEnd);
    wrapper.addEventListener("touchcancel", onPressEnd);
  }

  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

document.getElementById("mobileBackBtn").addEventListener("click", () => {
  document.querySelector(".chat-room").classList.remove("active");
});

document.getElementById("cancelFileBtn").addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  document.getElementById("filePreview").style.display = "none";
});

/* ===== SEARCH PESAN ===== */
const searchChatBar = document.getElementById("searchChatBar");
const searchChatInput = document.getElementById("searchChatInput");
const searchChatCount = document.getElementById("searchChatCount");
const searchChatPrev = document.getElementById("searchChatPrev");
const searchChatNext = document.getElementById("searchChatNext");
const searchChatClose = document.getElementById("searchChatClose");

let searchResults = [];
let searchIndex = 0;

document
  .querySelector(".chat-header-actions .icon-btn")
  .addEventListener("click", () => {
    searchChatBar.style.display = "flex";
    searchChatInput.focus();
  });

searchChatClose.addEventListener("click", () => {
  searchChatBar.style.display = "none";
  searchChatInput.value = "";
  clearSearchHighlight();
  searchResults = [];
  searchChatCount.textContent = "";
});

searchChatInput.addEventListener("input", () => {
  const q = searchChatInput.value.trim().toLowerCase();
  clearSearchHighlight();
  searchResults = [];
  searchIndex = 0;

  if (!q) {
    searchChatCount.textContent = "";
    return;
  }

  document.querySelectorAll(".message p").forEach((p) => {
    if (p.textContent.toLowerCase().includes(q)) {
      searchResults.push(p);
      p.innerHTML = p.textContent.replace(
        new RegExp(`(${q})`, "gi"),
        `<mark class="msg-highlight">$1</mark>`,
      );
    }
  });

  if (searchResults.length === 0) {
    searchChatCount.textContent = "Tidak ditemukan";
    return;
  }

  searchIndex = 0;
  updateSearchActive();
});

searchChatNext.addEventListener("click", () => {
  if (!searchResults.length) return;
  searchIndex = (searchIndex + 1) % searchResults.length;
  updateSearchActive();
});

searchChatPrev.addEventListener("click", () => {
  if (!searchResults.length) return;
  searchIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
  updateSearchActive();
});

function updateSearchActive() {
  document.querySelectorAll(".msg-highlight-active").forEach((el) => {
    el.classList.remove("msg-highlight-active");
  });
  const active = searchResults[searchIndex];
  active.querySelectorAll(".msg-highlight").forEach((el) => {
    el.classList.add("msg-highlight-active");
  });
  active.scrollIntoView({ behavior: "smooth", block: "center" });
  searchChatCount.textContent = `${searchIndex + 1} / ${searchResults.length}`;
}

function clearSearchHighlight() {
  document.querySelectorAll(".message p").forEach((p) => {
    p.textContent = p.textContent;
  });
}
