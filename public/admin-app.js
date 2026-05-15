const loginPanel = document.querySelector("#adminLoginPanel");
const adminPanel = document.querySelector("#adminPanel");
const loginForm = document.querySelector("#adminLoginForm");
const adminUserId = document.querySelector("#adminUserId");
const adminPassword = document.querySelector("#adminPassword");
const adminMessage = document.querySelector("#adminMessage");
const logoutBtn = document.querySelector("#adminLogoutBtn");
const userCount = document.querySelector("#adminUserCount");
const postCount = document.querySelector("#adminPostCount");
const commentCount = document.querySelector("#adminCommentCount");

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "처리 중 오류가 발생했습니다.");
  return data;
}

function setMessage(message, isError = false) {
  adminMessage.textContent = message;
  adminMessage.style.color = isError ? "#c2410c" : "";
}

function showLogin(message = "") {
  loginPanel.hidden = false;
  adminPanel.hidden = true;
  setMessage(message);
  adminUserId.focus();
}

function showAdmin(data) {
  loginPanel.hidden = true;
  adminPanel.hidden = false;
  userCount.textContent = data.counts?.users ?? 0;
  postCount.textContent = data.counts?.posts ?? 0;
  commentCount.textContent = data.counts?.comments ?? 0;
}

async function refreshStatus() {
  const data = await requestJson("/api/admin/status");
  if (data.loggedIn) {
    showAdmin(data);
  } else {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");
  try {
    await requestJson("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        userId: adminUserId.value,
        password: adminPassword.value
      })
    });
    loginForm.reset();
    await refreshStatus();
  } catch (error) {
    setMessage(error.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  await requestJson("/api/admin/logout", { method: "POST", body: "{}" });
  showLogin("로그아웃되었습니다.");
});

refreshStatus().catch((error) => showLogin(error.message));
