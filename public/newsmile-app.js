const form = document.querySelector("#newsmileForm");
const keywordInput = document.querySelector("#newsmileKeyword");
const statusEl = document.querySelector("#status");
const quickGrid = document.querySelector("#newsmileQuickGrid");
const resultsEl = document.querySelector("#newsmileResults");
const openNaverBtn = document.querySelector("#openNaverBtn");
const blogPost = document.querySelector("#blogPost");

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
  const searchedDate = plainDateFromIso(searchedAt);
  const stops = route.stops && route.stops.length ? route.stops.join(", ") : "-";
  const imageDownloads = [
    route.routeDownloadUrl ? `<a class="download-link" href="${route.routeDownloadUrl}" download>노선도 이미지 다운로드</a>` : "",
    route.downloadUrl ? `<a class="download-link" href="${route.downloadUrl}" download>운행시간 이미지 다운로드</a>` : ""
  ]
    .filter(Boolean)
    .join(" ");
  const images = [
    route.routeImageUrl ? `<img class="buspia-time-image" src="${route.routeImageUrl}" alt="경주 새천년미소 ${route.routeNo}번 노선도" />` : "",
    route.imageUrl ? `<img class="buspia-time-image" src="${route.imageUrl}" alt="경주 새천년미소 ${route.routeNo}번 운행시간표" />` : ""
  ].join("");
  blogPost.innerHTML = `
    <p class="post-kicker">대중교통과 여행하기</p>
    <h2 class="post-title">경주 새천년미소 ${route.routeNo}번 시간표</h2>
    <p class="post-meta">${searchedDate} 새천년미소 조회 기준</p>

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
            <td>${searchedDate}</td>
            <th>버스회사</th>
            <td><a href="${route.sourceUrl}" target="_blank" rel="noopener">${route.company || "경주 새천년미소"}</a></td>
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
        </tbody>
      </table>
    </div>

    <p class="note">아래 버튼을 누르면 새천년미소 이미지 파일을 다운로드할 수 있습니다.</p>
    <p>${imageDownloads || `<span class="download-missing">${route.imageError || "이미지 없음"}</span>`}</p>
    ${images || `<p class="note">${route.imageError || "시간표 이미지를 찾지 못했습니다."}</p>`}
  `;
  openNaverBtn.disabled = false;
}

function renderResults(routes, searchedAt) {
  resultsEl.innerHTML = "";
  if (!routes.length) {
    resultsEl.innerHTML = '<p class="empty inline-empty">검색된 새천년미소 노선이 없습니다.</p>';
    openNaverBtn.disabled = true;
    return;
  }

  routes.forEach((route, index) => {
    const item = document.createElement("article");
    item.className = "buspia-result";
    item.innerHTML = `
      <div>
        <strong>${route.routeNo}번</strong>
        <span>${route.routeTitle || `${route.depName || ""} - ${route.arrName || ""}`}</span>
        <small>${route.depName || "-"} → ${route.arrName || "-"} / 첫차 ${route.firstTime || "-"} / 막차 ${route.lastTime || "-"}</small>
      </div>
      <div class="buspia-result-actions">
        <button type="button" data-index="${index}">표 만들기</button>
        ${
          route.downloadUrl
            ? `${route.routeDownloadUrl ? `<a class="download-link" href="${route.routeDownloadUrl}" download>노선도</a>` : ""}<a class="download-link" href="${route.downloadUrl}" download>시간표</a>`
            : `<span class="download-missing">${route.imageError || "이미지 없음"}</span>`
        }
      </div>
    `;
    item.querySelector("button").addEventListener("click", () => {
      renderBlogPost(route, searchedAt);
      setStatus(`${route.routeNo}번 블로그용 표를 만들었습니다.`);
    });
    resultsEl.appendChild(item);
  });

  renderBlogPost(routes[0], searchedAt);
}

function selectQuickRoute(route, searchedAt) {
  keywordInput.value = route.routeNo;
  resultsEl.innerHTML = "";
  renderResults([route], searchedAt);
  setStatus(`${route.routeNo}번 시간표 이미지 다운로드 버튼을 만들었습니다.`);
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
      <strong>${route.routeNo}번</strong>
      <span>${route.depName || "-"} → ${route.arrName || "-"}</span>
      <small>${route.routeTitle || "새천년미소"}</small>
    `;
    button.addEventListener("click", () => selectQuickRoute(route, searchedAt));
    quickGrid.appendChild(button);
  });
}

async function loadQuickRoutes() {
  try {
    quickGrid.innerHTML = '<p class="empty inline-empty">빠른 선택 목록을 불러오는 중입니다.</p>';
    const data = await apiGet("/api/newsmile/search?q=10&limit=36");
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
    setStatus("새천년미소 시간표를 찾고 있습니다.");
    resultsEl.innerHTML = "";
    const data = await apiGet(`/api/newsmile/search?q=${encodeURIComponent(keyword)}`);
    renderResults(data.routes, data.searchedAt);
    setStatus(`${data.routes.length}개의 새천년미소 노선을 찾았습니다.`);
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
