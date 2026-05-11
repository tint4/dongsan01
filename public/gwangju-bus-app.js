const form = document.querySelector("#gwangjuForm");
const keywordInput = document.querySelector("#gwangjuKeyword");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#gwangjuResults");
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

function renderTimetable(timetable) {
  const rows = timetable?.rows || [];
  return `
    <h3 class="direction-title">운행시간표</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>${timetable?.upName || "기점"}</th>
            <th>${timetable?.upNoteHeader || "기점비고"}</th>
            <th>${timetable?.downName || "종점"}</th>
            <th>${timetable?.downNoteHeader || "종점비고"}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.upTime || ""}</td>
              <td>${row.upNote || ""}</td>
              <td>${row.downTime || ""}</td>
              <td>${row.downNote || ""}</td>
            </tr>
          `).join("") || '<tr><td colspan="4">시간표 정보가 없습니다.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderBlogPost(route, searchedAt) {
  const searchedDate = plainDateFromIso(searchedAt);
  const stops = route.stops && route.stops.length ? route.stops.join(", ") : "-";
  blogPost.innerHTML = `
    <p class="post-kicker">대중교통과 여행하기</p>
    <h2 class="post-title">광주버스 ${route.routeNo}번 시간표</h2>
    <p class="post-meta">${searchedDate} 광주버스 조회 기준</p>

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
            <td><a href="${route.sourceUrl}" target="_blank" rel="noopener">${route.company || "광주버스"}${route.phone ? ` (${route.phone})` : ""}</a></td>
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

    <div class="table-wrap">
      <table class="route-info-table">
        <tbody>
          <tr>
            <th>첫차시간</th>
            <td>${route.firstTime || "-"}</td>
            <th>막차시간</th>
            <td>${route.lastTime || "-"}</td>
          </tr>
          <tr>
            <th>배차간격</th>
            <td>${route.interval || "-"}</td>
            <th>운행시간</th>
            <td>${route.duration || "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${renderTimetable(route.timetable)}
  `;
  openNaverBtn.disabled = false;
}

function renderResults(routes, searchedAt) {
  resultsEl.innerHTML = "";
  if (!routes.length) {
    resultsEl.innerHTML = '<p class="empty inline-empty">검색된 광주버스 노선이 없습니다.</p>';
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
        <small>${route.busType || "-"} / 첫차 ${route.firstTime || "-"} / 막차 ${route.lastTime || "-"} / 배차 ${route.interval || "-"}</small>
      </div>
      <div class="buspia-result-actions">
        <button type="button" data-index="${index}">표 만들기</button>
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const keyword = keywordInput.value.trim();
  if (!keyword) return;

  try {
    setStatus("광주버스 시간표를 찾고 있습니다.");
    resultsEl.innerHTML = "";
    openNaverBtn.disabled = true;
    const data = await apiGet(`/api/gwangju-bus/search?q=${encodeURIComponent(keyword)}`);
    renderResults(data.routes, data.searchedAt);
    setStatus(`${data.routes.length}개의 광주버스 노선을 찾았습니다.`);
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
