const form = document.querySelector("#buspiaForm");
const keywordInput = document.querySelector("#buspiaKeyword");
const statusEl = document.querySelector("#status");
const quickGrid = document.querySelector("#buspiaQuickGrid");
const resultsEl = document.querySelector("#buspiaResults");
const openNaverBtn = document.querySelector("#openNaverBtn");
const blogPost = document.querySelector("#blogPost");

let lastSearch = null;
let quickRoutes = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c2410c" : "";
}

function plainDateFromIso(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "조회 중 오류가 발생했습니다.");
  return data;
}

function renderBlogPost(route, searchedAt) {
  const stops = route.stops.length ? route.stops.join(", ") : "-";
  const busLocationUrl = `https://map.naver.com/p/search/${encodeURIComponent(`버스피아 ${route.routeNo}번 버스`)}`;
  blogPost.innerHTML = `
    <p class="post-kicker">대중교통 타고 여행하기</p>
    <h2 class="post-title">버스피아 공항버스 ${route.routeNo}번 시간표</h2>
    <p class="post-meta">${plainDateFromIso(searchedAt)} 버스피아 조회 기준</p>

    <div class="table-wrap">
      <table class="route-info-table buspia-meta-table">
        <colgroup>
          <col class="label-col" />
          <col class="value-col" />
          <col class="label-col" />
          <col class="value-col" />
        </colgroup>
        <tbody>
          <tr>
            <th>시간표 확인일</th>
            <td>${plainDateFromIso(searchedAt)}</td>
            <th>버스회사</th>
            <td>${route.company || "-"}</td>
          </tr>
          <tr>
            <th>출발지</th>
            <td>${route.depName || "-"}</td>
            <th>도착지</th>
            <td>${route.arrName || "-"}</td>
          </tr>
        </tbody>
      </table>
      <table class="route-info-table attached-table buspia-meta-table">
        <colgroup>
          <col class="label-col" />
          <col class="value-col" />
          <col class="label-col" />
          <col class="value-col" />
        </colgroup>
        <tbody>
          <tr>
            <th>주요정류장</th>
            <td colspan="3">${stops}</td>
          </tr>
          <tr>
            <th>실시간 버스위치</th>
            <td colspan="3"><a href="${busLocationUrl}" target="_blank" rel="noopener">네이버지도에서 ${route.routeNo}번 버스 검색</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="note">아래 버튼을 누르면 버스피아 운행시간 이미지 파일을 다운로드할 수 있습니다.</p>
    <p><a class="download-link" href="${route.downloadUrl}" download>운행시간 이미지 다운로드</a></p>
    ${route.imageUrl ? `<img class="buspia-time-image" src="${route.imageUrl}" alt="버스피아 공항버스 ${route.routeNo}번 운행시간표" />` : ""}
  `;
  openNaverBtn.disabled = false;
}

function renderResults(routes, searchedAt) {
  resultsEl.innerHTML = "";
  if (!routes.length) {
    resultsEl.innerHTML = '<p class="empty inline-empty">검색된 공항버스 노선이 없습니다.</p>';
    return;
  }

  routes.forEach((route, index) => {
    const item = document.createElement("article");
    item.className = "buspia-result";
    item.innerHTML = `
      <div>
        <strong>공항 ${route.routeNo}</strong>
        <span>${route.routeTitle || "-"}</span>
        <small>${route.company || "버스회사 정보 없음"}</small>
      </div>
      <div class="buspia-result-actions">
        <button type="button" data-index="${index}">표 만들기</button>
        ${
          route.downloadUrl
            ? `<a class="download-link" href="${route.downloadUrl}" download>이미지 다운로드</a>`
            : `<span class="download-missing">${route.imageError || "이미지 없음"}</span>`
        }
      </div>
    `;
    item.querySelector("button").addEventListener("click", () => {
      renderBlogPost(route, searchedAt);
      setStatus(`공항 ${route.routeNo}번 블로그용 표를 만들었습니다.`);
    });
    resultsEl.appendChild(item);
  });

  renderBlogPost(routes[0], searchedAt);
}

function selectQuickRoute(route, searchedAt) {
  keywordInput.value = route.routeNo;
  resultsEl.innerHTML = "";
  renderResults([route], searchedAt);
  setStatus(`공항 ${route.routeNo}번 표와 이미지 다운로드 버튼을 만들었습니다.`);
}

function renderQuickGrid(routes, searchedAt) {
  quickGrid.innerHTML = "";
  Array.from({ length: 36 }).forEach((_, index) => {
    const route = routes[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "buspia-quick-cell";
    if (!route) {
      button.classList.add("empty-quick-cell");
      button.disabled = true;
      quickGrid.appendChild(button);
      return;
    }
    button.innerHTML = `
      <strong>${route.depName || route.routeNo}</strong>
      <span>${route.arrName || route.routeTitle || "-"}</span>
      <small>공항 ${route.routeNo}</small>
    `;
    button.addEventListener("click", () => selectQuickRoute(route, searchedAt));
    quickGrid.appendChild(button);
  });
}

async function loadQuickRoutes() {
  try {
    quickGrid.innerHTML = '<p class="empty inline-empty">공항버스 빠른 선택 목록을 불러오는 중입니다.</p>';
    const data = await apiGet("/api/buspia/search?q=공항&limit=36");
    quickRoutes = data.routes;
    renderQuickGrid(data.routes, data.searchedAt);
  } catch (error) {
    quickGrid.innerHTML = '<p class="empty inline-empty">빠른 선택 목록을 불러오지 못했습니다.</p>';
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const keyword = keywordInput.value.trim();
  if (!keyword) return;

  try {
    setStatus("버스피아 공항버스 시간표를 찾고 있습니다.");
    resultsEl.innerHTML = "";
    const data = await apiGet(`/api/buspia/search?q=${encodeURIComponent(keyword)}`);
    lastSearch = data;
    renderResults(data.routes, data.searchedAt);
    setStatus(`${data.routes.length}개의 공항버스 노선을 찾았습니다.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

openNaverBtn.addEventListener("click", async () => {
  if (openNaverBtn.disabled) return;
  await navigator.clipboard.writeText(blogPost.innerHTML.trim());
  window.open("https://blog.naver.com/PostWriteForm.naver?blogId=tint4", "_blank", "noopener");
  setStatus("본문 HTML을 복사하고 네이버 블로그 글쓰기 창을 열었습니다.");
});

loadQuickRoutes();
