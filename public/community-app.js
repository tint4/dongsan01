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
const tasteScoreInput = document.querySelector("#tasteScoreInput");
const priceScoreInput = document.querySelector("#priceScoreInput");
const rankingMessage = document.querySelector("#rankingMessage");
const rankingList = document.querySelector("#rankingList");
const rankSortButtons = [...document.querySelectorAll(".rank-sort-btn")];

let currentCategory = "빵류";
let currentSubcategory = "단팥빵";
let editingShopName = "";
let currentSortKey = "totalScore";
let currentSortDirection = "desc";
let currentUser = JSON.parse(localStorage.getItem("community-user") || "null");
let isMember = Boolean(currentUser);
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

function isActiveRankingEnabled() {
  return currentCategory === "빵류" && breadSubcategories.includes(currentSubcategory);
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
  boardSummary.textContent = `${currentSubcategory} 랭킹 차트`;
  rankingForm.hidden = true;
  editingShopName = "";
  if (!isActiveRankingEnabled()) {
    setRankingMessage("빵류 소분류에서 랭킹 투표를 사용할 수 있습니다.");
  } else if (!isMember) {
    setRankingMessage("로그인한 회원만 신규등록과 점수주기를 할 수 있습니다.");
  } else {
    setRankingMessage("각 소분류는 월요일부터 일요일까지 회원 1명당 1회만 투표할 수 있습니다.");
  }
  newRankingBtn.disabled = !isActiveRankingEnabled() || !isMember;
  renderSubcategories();
  renderRankings().catch((error) => {
    rankingList.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
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
        return direction * (Number(a.originalRank || 9999) - Number(b.originalRank || 9999));
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
    const active = button.dataset.sort === currentSortKey && button.dataset.direction === currentSortDirection;
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
    const disabled = !item || !isActiveRankingEnabled() || !isMember ? "disabled" : "";
    return `
      <tr class="${item ? "" : "ranking-empty-row"}">
        <td>${rank}</td>
        <td>${shopName ? escapeHtml(shopName) : ""}</td>
        <td class="total-score-cell">${item ? Number(item.totalScore || 0) : ""}</td>
        <td>${item ? Number(item.tasteScore || 0) : ""}</td>
        <td>${item ? Number(item.priceScore || 0) : ""}</td>
        <td>${item ? Number(item.voteCount || 0) : ""}</td>
        <td>
          ${item ? `<button type="button" class="score-shop-btn" data-shop="${escapeHtml(shopName)}" ${disabled}>점수주기</button>` : ""}
        </td>
      </tr>
    `;
  }).join("");

  rankingList.querySelectorAll(".score-shop-btn").forEach((button) => {
    button.addEventListener("click", () => showRankingForm(button.dataset.shop));
  });
}

function showRankingForm(shopName = "") {
  if (!isActiveRankingEnabled()) return;
  if (!isMember) {
    setRankingMessage("로그인한 회원만 투표할 수 있습니다.", true);
    showAuthForm("login");
    return;
  }
  editingShopName = shopName;
  rankingForm.hidden = false;
  shopNameInput.value = shopName;
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
    renderRankings().catch((error) => {
      rankingList.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    });
  });
});

newRankingBtn.addEventListener("click", () => showRankingForm(""));

rankingCancelBtn.addEventListener("click", () => {
  rankingForm.hidden = true;
  editingShopName = "";
  shopNameInput.readOnly = false;
  setRankingMessage("");
});

rankingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await apiPost("/api/community/rankings/score", {
      category: currentCategory,
      subcategory: currentSubcategory,
      shopName: editingShopName || shopNameInput.value,
      tasteScore: Number(tasteScoreInput.value),
      priceScore: Number(priceScoreInput.value),
      userId: currentUser?.userId || ""
    });
    rankingForm.hidden = true;
    editingShopName = "";
    shopNameInput.readOnly = false;
    setRankingMessage("점수가 반영되었습니다.");
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
