const categories = ["빵류", "밥류", "면류", "고기류", "국물류", "분식류", "자유게시판"];
const breadSubcategories = [
  "단팥빵",
  "바게트",
  "베이글",
  "빵 오 쇼콜라",
  "브리오슈",
  "소금빵",
  "소보로",
  "앙버터",
  "치아바타",
  "카스테라",
  "크루아상",
  "크림빵",
  "호밀빵",
  "햄버거"
];

const memberStatus = document.querySelector("#memberStatus");
const communityLogin = document.querySelector(".community-login");
const joinBtn = document.querySelector("#joinBtn");
const loginToggle = document.querySelector("#loginToggle");
const authPanel = document.querySelector("#authPanel");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const authMessage = document.querySelector("#authMessage");
const loginUserId = document.querySelector("#loginUserId");
const loginPassword = document.querySelector("#loginPassword");
const loginCancelBtn = document.querySelector("#loginCancelBtn");
const signupUserId = document.querySelector("#signupUserId");
const signupDisplayName = document.querySelector("#signupDisplayName");
const signupPassword = document.querySelector("#signupPassword");
const signupCancelBtn = document.querySelector("#signupCancelBtn");
const categoryTabs = [...document.querySelectorAll(".category-tab")];
const boardTitle = document.querySelector("#boardTitle");
const boardSummary = document.querySelector("#boardSummary");
const subCategoryList = document.querySelector("#subCategoryList");
const writeOpenBtn = document.querySelector("#writeOpenBtn");
const writeForm = document.querySelector("#writeForm");
const writeCancelBtn = document.querySelector("#writeCancelBtn");
const postTitle = document.querySelector("#postTitle");
const postBody = document.querySelector("#postBody");
const postList = document.querySelector("#postList");
const postDetail = document.querySelector("#postDetail");

let currentCategory = "빵류";
let currentSubcategory = "단팥빵";
let currentUser = JSON.parse(localStorage.getItem("community-user") || "null");
let isMember = Boolean(currentUser);
const loginFailKey = "community-login-fails";
const loginLockKey = "community-login-locked-until";

async function apiPost(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "처리 중 오류가 발생했습니다.");
  return data;
}

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "처리 중 오류가 발생했습니다.");
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLoginFailCount() {
  return Number(localStorage.getItem(loginFailKey) || 0);
}

function setLoginFailCount(count) {
  localStorage.setItem(loginFailKey, String(count));
}

function clearLoginFails() {
  localStorage.removeItem(loginFailKey);
  localStorage.removeItem(loginLockKey);
}

function getLoginLockedUntil() {
  return Number(localStorage.getItem(loginLockKey) || 0);
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#c2410c" : "";
}

function lockLoginForThreeMinutes() {
  const lockedUntil = Date.now() + 3 * 60 * 1000;
  localStorage.setItem(loginLockKey, String(lockedUntil));
  setLoginFailCount(5);
  setAuthMessage("아이디/비밀번호 틀린 횟수가 많아 로그인을 할 수 없습니다. 3분후 다시 시도해주세요.", true);
  loginForm.hidden = true;
  window.setTimeout(() => {
    if (!isMember) showAuthForm("login");
  }, 3 * 60 * 1000);
}

function showAuthForm(type) {
  const lockedUntil = getLoginLockedUntil();
  if (type === "login" && lockedUntil > Date.now()) {
    authPanel.hidden = false;
    loginForm.hidden = true;
    signupForm.hidden = true;
    setAuthMessage("아이디/비밀번호 틀린 횟수가 많아 로그인을 할 수 없습니다. 3분후 다시 시도해주세요.", true);
    window.setTimeout(() => {
      if (!isMember) showAuthForm("login");
    }, lockedUntil - Date.now());
    return;
  }
  if (type === "login" && lockedUntil && lockedUntil <= Date.now()) {
    clearLoginFails();
  }
  authPanel.hidden = false;
  loginForm.hidden = type !== "login";
  signupForm.hidden = type !== "signup";
  communityLogin.hidden = type === "signup";
  loginToggle.hidden = type === "signup";
  setAuthMessage("");
  if (type === "login") loginUserId.focus();
  if (type === "signup") signupUserId.focus();
}

function hideAuthForm() {
  authPanel.hidden = true;
  loginForm.hidden = true;
  signupForm.hidden = true;
  communityLogin.hidden = false;
  loginToggle.hidden = false;
  setAuthMessage("");
}

function updateMemberUi() {
  memberStatus.textContent = isMember ? `${currentUser.displayName}님` : "비회원";
  communityLogin.hidden = false;
  joinBtn.hidden = isMember;
  if (isMember) loginToggle.hidden = false;
  loginToggle.textContent = isMember ? "로그아웃" : "회원 로그인";
  writeOpenBtn.disabled = !isMember;
  writeOpenBtn.title = isMember ? "" : "회원만 글을 쓸 수 있습니다.";
}

function renderSubcategories() {
  const items = currentCategory === "빵류"
    ? breadSubcategories
    : currentCategory === "자유게시판"
      ? ["자유게시판"]
      : ["준비중"];

  if (!items.includes(currentSubcategory)) currentSubcategory = items[0];

  subCategoryList.innerHTML = items.map((item) => `
    <button type="button" class="${item === currentSubcategory ? "active" : ""}" data-subcategory="${item}">${item}</button>
  `).join("");

  subCategoryList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      currentSubcategory = button.dataset.subcategory;
      renderBoard();
    });
  });
}

function renderBoard() {
  boardTitle.textContent = currentCategory;
  boardSummary.textContent = `${currentSubcategory} 게시판 · 회원은 글쓰기 가능, 비회원은 읽기와 댓글 가능`;
  renderSubcategories();
  postDetail.innerHTML = "";
  renderPosts().catch((error) => {
    postList.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
  });
  updateMemberUi();
}

async function renderPosts() {
  const query = new URLSearchParams({
    category: currentCategory,
    subcategory: currentSubcategory
  });
  const data = await apiGet(`/api/community/posts?${query.toString()}`);
  const posts = data.posts || [];

  postList.innerHTML = posts.map((post, index) => `
    <tr data-id="${post.id}">
      <td>${posts.length - index}</td>
      <td>${escapeHtml(post.subcategory)}</td>
      <td class="community-title-cell">${escapeHtml(post.title)}</td>
      <td>${escapeHtml(post.author)}</td>
      <td>${(post.comments || []).length}</td>
      <td>${Number(post.views || 0)}</td>
    </tr>
  `).join("") || '<tr><td colspan="6">아직 게시글이 없습니다.</td></tr>';

  postList.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      openPost(Number(row.dataset.id)).catch((error) => {
        postDetail.innerHTML = `<p>${error.message}</p>`;
      });
    });
  });
}

async function openPost(id) {
  const data = await apiGet(`/api/community/post?id=${encodeURIComponent(id)}`);
  const post = data.post;
  if (!post) return;
  postDetail.innerHTML = `
    <div class="community-detail-head">
      <span>${escapeHtml(post.subcategory)}</span>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.author)} · 조회 ${Number(post.views || 0)} · 댓글 ${(post.comments || []).length}</p>
    </div>
    <div class="community-detail-body">${escapeHtml(post.body).replace(/\n/g, "<br>")}</div>
    <section class="community-comments">
      <h4>댓글</h4>
      <ul>
        ${(post.comments || []).map((comment) => `<li><strong>${escapeHtml(comment.name)}</strong><span>${escapeHtml(comment.body)}</span></li>`).join("") || "<li>댓글이 없습니다.</li>"}
      </ul>
      <form class="comment-form" data-id="${post.id}">
        <input name="name" type="text" placeholder="비회원 이름" value="비회원" />
        <input name="body" type="text" placeholder="댓글을 입력하세요" required />
        <button type="submit">댓글 등록</button>
      </form>
    </section>
  `;
  postDetail.querySelector(".comment-form").addEventListener("submit", (event) => {
    addComment(event).catch((error) => window.alert(error.message));
  });
  await renderPosts();
}

async function addComment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = Number(form.dataset.id);
  const data = new FormData(form);
  await apiPost("/api/community/comments", {
    postId: id,
    name: String(data.get("name") || "비회원").trim() || "비회원",
    body: String(data.get("body") || "").trim()
  });
  await openPost(id);
}

categoryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentCategory = tab.dataset.category;
    currentSubcategory = currentCategory === "빵류" ? "단팥빵" : currentCategory;
    categoryTabs.forEach((item) => item.classList.toggle("active", item === tab));
    writeForm.hidden = true;
    postDetail.innerHTML = "";
    renderBoard();
  });
});

loginToggle.addEventListener("click", () => {
  if (!isMember) {
    showAuthForm("login");
    return;
  }
  currentUser = null;
  isMember = false;
  localStorage.removeItem("community-user");
  hideAuthForm();
  updateMemberUi();
});

joinBtn.addEventListener("click", () => {
  showAuthForm("signup");
});

loginCancelBtn.addEventListener("click", hideAuthForm);
signupCancelBtn.addEventListener("click", hideAuthForm);

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await apiPost("/api/community/signup", {
      userId: signupUserId.value,
      displayName: signupDisplayName.value,
      password: signupPassword.value
    });
    signupForm.reset();
    showAuthForm("login");
    setAuthMessage("회원가입이 완료되었습니다. 아이디와 비밀번호로 로그인해주세요.");
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (getLoginLockedUntil() > Date.now()) {
    lockLoginForThreeMinutes();
    return;
  }
  try {
    const data = await apiPost("/api/community/login", {
      userId: loginUserId.value,
      password: loginPassword.value
    });
    currentUser = data.user;
    isMember = true;
    localStorage.setItem("community-user", JSON.stringify(currentUser));
    clearLoginFails();
    loginForm.reset();
    hideAuthForm();
    updateMemberUi();
  } catch (error) {
    const nextFailCount = getLoginFailCount() + 1;
    setLoginFailCount(nextFailCount);
    if (nextFailCount >= 5) {
      lockLoginForThreeMinutes();
      return;
    }
    setAuthMessage(error.message, true);
  }
});

writeOpenBtn.addEventListener("click", () => {
  if (!isMember) return;
  writeForm.hidden = false;
  postTitle.focus();
});

writeCancelBtn.addEventListener("click", () => {
  writeForm.hidden = true;
});

writeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isMember) return;
  const title = postTitle.value.trim();
  const body = postBody.value.trim();
  if (!title || !body) return;
  try {
    await apiPost("/api/community/posts", {
      category: currentCategory,
      subcategory: currentSubcategory,
      title,
      body,
      author: currentUser?.displayName || "회원"
    });
    postTitle.value = "";
    postBody.value = "";
    writeForm.hidden = true;
    await renderPosts();
  } catch (error) {
    window.alert(error.message);
  }
});

renderBoard();
