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
const newRankingBtn = document.querySelector("#newRankingBtn");
const rankingForm = document.querySelector("#rankingForm");
const rankingCancelBtn = document.querySelector("#rankingCancelBtn");
const shopNameInput = document.querySelector("#shopNameInput");
const mapUrlInput = document.querySelector("#mapUrlInput");
const tasteScoreInput = document.querySelector("#tasteScoreInput");
const priceScoreInput = document.querySelector("#priceScoreInput");
const rankingMessage = document.querySelector("#rankingMessage");
const rankingList = document.querySelector("#rankingList");
const rankSortButtons = [...document.querySelectorAll(".rank-sort-btn")];
const rankingSection = document.querySelector("#rankingSection");
const postSection = document.querySelector("#postSection");
const newPostBtn = document.querySelector("#newPostBtn");
const postForm = document.querySelector("#postForm");
const postCancelBtn = document.querySelector("#postCancelBtn");
const postTitleInput = document.querySelector("#postTitleInput");
const postBodyInput = document.querySelector("#postBodyInput");
const postList = document.querySelector("#postList");
const postDetail = document.querySelector("#postDetail");
const postDetailMeta = document.querySelector("#postDetailMeta");
const postDetailTitle = document.querySelector("#postDetailTitle");
const postDetailInfo = document.querySelector("#postDetailInfo");
const postDetailBody = document.querySelector("#postDetailBody");
const commentList = document.querySelector("#commentList");
const commentForm = document.querySelector("#commentForm");
const commentInput = document.querySelector("#commentInput");

let currentCategory = "빵류";
let currentSubcategory = "단팥빵";
let editingShopName = "";
let currentSortKey = "totalScore";
let currentSortDirection = "desc";
let currentUser = JSON.parse(localStorage.getItem("community-user") || "null");
let isMember = Boolean(currentUser);
let mapPreviewTimer = 0;
let lastPreviewUrl = "";
const loginFailKey = "community-login-fails";
const loginLockKey = "community-login-locked-until";

const scoreOptions = Array.from({ length: 10 }, (_, index) => {
  const score = index + 1;
  return `<option value="${score}">${score}점</option>`;
}).join("");
tasteScoreInput.innerHTML = scoreOptions;
priceScoreInput.innerHTML = scoreOptions;

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

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function isActiveRankingEnabled() {
  return currentCategory === "빵류" && breadSubcategories.includes(currentSubcategory);
}

function isFreeBoard() {
  return currentCategory === "자유게시판";
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

function setRankingMessage(message, isError = false) {
  rankingMessage.textContent = message;
  rankingMessage.style.color = isError ? "#c2410c" : "";
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
  if (type === "login" && lockedUntil && lockedUntil <= Date.now()) clearLoginFails();
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
}

function renderSubcategories() {
  const items = currentCategory === "빵류"
    ? breadSubcategories
    : currentCategory === "자유게시판"
      ? ["자유게시판"]
      : ["준비중"];

  if (!items.includes(currentSubcategory)) currentSubcategory = items[0];

  subCategoryList.innerHTML = items.map((item) => `
    <button type="button" class="${item === currentSubcategory ? "active" : ""}" data-subcategory="${escapeHtml(item)}">${escapeHtml(item)}</button>
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
  boardSummary.textContent = isFreeBoard() ? "회원 글쓰기와 회원 댓글 게시판" : `${currentSubcategory} 랭킹 차트`;
  rankingForm.hidden = true;
  postForm.hidden = true;
  postDetail.hidden = true;
  editingShopName = "";
  rankingSection.hidden = isFreeBoard();
  postSection.hidden = !isFreeBoard();
  newRankingBtn.hidden = isFreeBoard();
  newPostBtn.hidden = !isFreeBoard();
  newPostBtn.disabled = !isMember;
  if (isFreeBoard()) {
    setRankingMessage(isMember ? "자유게시판은 회원만 글쓰기와 댓글을 사용할 수 있습니다." : "로그인한 회원만 글쓰기와 댓글을 사용할 수 있습니다.");
    renderSubcategories();
    renderPosts().catch((error) => {
      postList.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
    });
    updateMemberUi();
    return;
  }
  if (!isActiveRankingEnabled()) {
    setRankingMessage("빵류 소분류에서 랭킹 투표를 사용할 수 있습니다.");
  } else if (!isMember) {
    setRankingMessage("로그인한 회원만 신규등록과 점수주기를 할 수 있습니다.");
  } else {
    setRankingMessage("각 소분류는 월요일부터 일요일까지 회원 1명당 3개까지 점수를 줄 수 있고, 같은 상점에는 다시 점수를 줄 수 없습니다.");
  }
  newRankingBtn.disabled = !isActiveRankingEnabled() || !isMember;
  renderSubcategories();
  renderRankings().catch((error) => {
    rankingList.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
  });
  updateMemberUi();
}

function sortRankings(rankings) {
  const sortKey = currentSortKey;
  const direction = currentSortDirection === "asc" ? 1 : -1;
  return rankings
    .map((item) => ({ ...item, originalRank: Number(item.rank || 0) }))
    .sort((a, b) => {
      if (sortKey === "rank") {
        return direction * (Number(b.originalRank || 9999) - Number(a.originalRank || 9999));
      }
      const primary = Number(a[sortKey] || 0) - Number(b[sortKey] || 0);
      if (primary !== 0) return direction * primary;
      return Number(b.totalScore || 0) - Number(a.totalScore || 0) ||
        Number(b.voteCount || 0) - Number(a.voteCount || 0) ||
        String(a.shopName || "").localeCompare(String(b.shopName || ""), "ko");
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function updateSortButtons() {
  rankSortButtons.forEach((button) => {
    const active = button.dataset.sort === currentSortKey;
    if (!active) {
      button.dataset.direction = "desc";
      button.textContent = "▼";
      button.setAttribute("aria-label", `${button.dataset.label || button.dataset.sort} 높은순 정렬`);
    }
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function renderRankings(providedRankings) {
  let rankings = providedRankings;
  if (!rankings) {
    const query = new URLSearchParams({ category: currentCategory, subcategory: currentSubcategory });
    rankings = (await apiGet(`/api/community/rankings?${query.toString()}`)).rankings || [];
  }
  rankings = sortRankings(rankings);
  updateSortButtons();
  const byRank = new Map(rankings.map((item) => [item.rank, item]));
  rankingList.innerHTML = Array.from({ length: 100 }, (_, index) => {
    const rank = index + 1;
    const item = byRank.get(rank);
    const shopName = item?.shopName || "";
    const mapUrl = item?.mapUrl || "";
    const disabled = !item || !isActiveRankingEnabled() || !isMember ? "disabled" : "";
    return `
      <tr class="${item ? "" : "ranking-empty-row"}">
        <td>${rank}</td>
        <td>${shopName ? escapeHtml(shopName) : ""}</td>
        <td>${mapUrl ? `<a class="map-link-icon" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener" aria-label="네이버 지도 열기">지도</a>` : ""}</td>
        <td class="total-score-cell">${item ? Number(item.totalScore || 0) : ""}</td>
        <td>${item ? Number(item.tasteScore || 0) : ""}</td>
        <td>${item ? Number(item.priceScore || 0) : ""}</td>
        <td>${item ? Number(item.voteCount || 0) : ""}</td>
        <td>
          ${item ? `<button type="button" class="score-shop-btn" data-shop="${escapeHtml(shopName)}" data-map="${escapeHtml(mapUrl)}" ${disabled}>점수주기</button>` : ""}
        </td>
      </tr>
    `;
  }).join("");

  rankingList.querySelectorAll(".score-shop-btn").forEach((button) => {
    button.addEventListener("click", () => showRankingForm(button.dataset.shop, button.dataset.map || ""));
  });
}

async function renderPosts() {
  const query = new URLSearchParams({ category: currentCategory, subcategory: currentSubcategory });
  const posts = (await apiGet(`/api/community/posts?${query.toString()}`)).posts || [];
  postList.innerHTML = posts.length ? posts.map((post, index) => `
    <tr>
      <td>${posts.length - index}</td>
      <td class="community-title-cell" data-post-id="${post.id}">${escapeHtml(post.title)}</td>
      <td>${escapeHtml(post.author)}</td>
      <td>${Number(post.views || 0)}</td>
      <td>${Array.isArray(post.comments) ? post.comments.length : 0}</td>
      <td>${formatDate(post.createdAt)}</td>
    </tr>
  `).join("") : `<tr><td colspan="6">등록된 글이 없습니다.</td></tr>`;

  postList.querySelectorAll(".community-title-cell").forEach((cell) => {
    cell.addEventListener("click", () => showPostDetail(cell.dataset.postId));
  });
}

function renderComments(post) {
  const comments = Array.isArray(post.comments) ? post.comments : [];
  commentList.innerHTML = comments.length ? comments.map((comment) => `
    <li>
      <strong>${escapeHtml(comment.name)}</strong>
      <span>${escapeHtml(comment.body)}</span>
    </li>
  `).join("") : "<li><strong>댓글</strong><span>등록된 댓글이 없습니다.</span></li>";
}

async function showPostDetail(postId) {
  const data = await apiGet(`/api/community/post?id=${encodeURIComponent(postId)}`);
  const post = data.post;
  postDetail.dataset.postId = post.id;
  postDetail.hidden = false;
  postDetailMeta.textContent = `${post.category} / ${post.subcategory}`;
  postDetailTitle.textContent = post.title;
  postDetailInfo.textContent = `${post.author} · 조회 ${Number(post.views || 0)} · ${formatDate(post.createdAt)}`;
  postDetailBody.textContent = post.body;
  commentInput.disabled = !isMember;
  commentForm.querySelector("button").disabled = !isMember;
  renderComments(post);
  await renderPosts();
}

function showRankingForm(shopName = "", mapUrl = "") {
  if (!isActiveRankingEnabled()) return;
  if (!isMember) {
    setRankingMessage("로그인한 회원만 투표할 수 있습니다.", true);
    showAuthForm("login");
    return;
  }
  editingShopName = shopName;
  rankingForm.hidden = false;
  shopNameInput.value = shopName;
  mapUrlInput.value = mapUrl;
  shopNameInput.readOnly = Boolean(shopName);
  tasteScoreInput.value = "10";
  priceScoreInput.value = "10";
  setRankingMessage(shopName ? `${shopName}에 점수를 추가합니다.` : "신규 상점명을 입력하면 차트에 등록됩니다.");
  if (shopName) {
    tasteScoreInput.focus();
  } else {
    shopNameInput.focus();
  }
}

async function previewNaverMapUrl() {
  const rawUrl = mapUrlInput.value.trim();
  if (!rawUrl || rawUrl === lastPreviewUrl || shopNameInput.value.trim()) return;
  lastPreviewUrl = rawUrl;
  try {
    setRankingMessage("네이버 지도 링크에서 상점명을 확인하고 있습니다.");
    const data = await apiGet(`/api/community/map-preview?url=${encodeURIComponent(rawUrl)}`);
    if (!shopNameInput.value.trim() && data.shopName) {
      shopNameInput.value = data.shopName;
      setRankingMessage(`${data.shopName} 상점명을 자동으로 입력했습니다.`);
    } else {
      setRankingMessage("상점명을 자동으로 찾지 못했습니다. 상점명을 직접 입력해주세요.", true);
    }
  } catch (error) {
    setRankingMessage(error.message, true);
  }
}

function scheduleNaverMapPreview() {
  window.clearTimeout(mapPreviewTimer);
  mapPreviewTimer = window.setTimeout(previewNaverMapUrl, 350);
}

categoryTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    currentCategory = tab.dataset.category;
    currentSubcategory = currentCategory === "빵류" ? "단팥빵" : currentCategory;
    categoryTabs.forEach((item) => item.classList.toggle("active", item === tab));
    renderBoard();
  });
});

rankSortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentSortKey = button.dataset.sort || "totalScore";
    currentSortDirection = button.dataset.direction || "desc";
    const nextDirection = currentSortDirection === "desc" ? "asc" : "desc";
    button.dataset.direction = nextDirection;
    button.textContent = nextDirection === "desc" ? "▼" : "▲";
    button.setAttribute("aria-label", `${button.dataset.label || currentSortKey} ${nextDirection === "desc" ? "높은순" : "낮은순"} 정렬`);
    renderRankings().catch((error) => {
      rankingList.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message)}</td></tr>`;
    });
  });
});

newRankingBtn.addEventListener("click", () => showRankingForm(""));

newPostBtn.addEventListener("click", () => {
  if (!isMember) {
    setRankingMessage("로그인한 회원만 글을 쓸 수 있습니다.", true);
    showAuthForm("login");
    return;
  }
  postForm.hidden = false;
  postTitleInput.focus();
});

rankingCancelBtn.addEventListener("click", () => {
  rankingForm.hidden = true;
  editingShopName = "";
  shopNameInput.readOnly = false;
  mapUrlInput.value = "";
  lastPreviewUrl = "";
  setRankingMessage("");
});

mapUrlInput.addEventListener("input", scheduleNaverMapPreview);
mapUrlInput.addEventListener("paste", () => window.setTimeout(previewNaverMapUrl, 50));
mapUrlInput.addEventListener("blur", previewNaverMapUrl);

postCancelBtn.addEventListener("click", () => {
  postForm.hidden = true;
  postForm.reset();
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isMember) {
    setRankingMessage("로그인한 회원만 글을 쓸 수 있습니다.", true);
    showAuthForm("login");
    return;
  }
  try {
    await apiPost("/api/community/posts", {
      category: currentCategory,
      subcategory: currentSubcategory,
      title: postTitleInput.value,
      body: postBodyInput.value,
      author: currentUser.displayName,
      userId: currentUser.userId
    });
    postForm.hidden = true;
    postForm.reset();
    setRankingMessage("글이 등록되었습니다.");
    await renderPosts();
  } catch (error) {
    setRankingMessage(error.message, true);
  }
});

commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isMember) {
    setRankingMessage("로그인한 회원만 댓글을 쓸 수 있습니다.", true);
    showAuthForm("login");
    return;
  }
  const postId = postDetail.dataset.postId;
  if (!postId) return;
  try {
    const data = await apiPost("/api/community/comments", {
      postId,
      body: commentInput.value,
      name: currentUser.displayName,
      userId: currentUser.userId
    });
    commentInput.value = "";
    renderComments(data.post);
    await renderPosts();
    setRankingMessage("댓글이 등록되었습니다.");
  } catch (error) {
    setRankingMessage(error.message, true);
  }
});

rankingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await apiPost("/api/community/rankings/score", {
      category: currentCategory,
      subcategory: currentSubcategory,
      shopName: editingShopName || shopNameInput.value,
      mapUrl: mapUrlInput.value,
      tasteScore: Number(tasteScoreInput.value),
      priceScore: Number(priceScoreInput.value),
      userId: currentUser?.userId || ""
    });
    rankingForm.hidden = true;
    editingShopName = "";
    shopNameInput.readOnly = false;
    mapUrlInput.value = "";
    setRankingMessage(data.message || "점수가 반영되었습니다.");
    await renderRankings(data.rankings || []);
  } catch (error) {
    setRankingMessage(error.message, true);
  }
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
  renderBoard();
});

joinBtn.addEventListener("click", () => showAuthForm("signup"));
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
    renderBoard();
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

renderBoard();
