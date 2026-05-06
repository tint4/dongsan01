const PROVIDER = {
  name: "한국도심공항",
  searchApi: "/api/calt/search",
  routesApi: "/api/calt/routes"
};

const form = document.querySelector("#airportForm");
const busNoInput = document.querySelector("#busNoInput");
const statusEl = document.querySelector("#status");
const routeQuickGrid = document.querySelector("#routeQuickGrid");
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

function renderRows(rows) {
  if (!rows || !rows.length) return '<tr><td colspan="6">조회된 시간이 없습니다.</td></tr>';
  return rows
    .map(
      (row) => `
        <tr>
          <td>${row.departTime}</td>
          <td>${row.departTerminal}</td>
          <td>${row.arriveTerminal}</td>
          <td>${row.company}</td>
          <td>${row.adultFare || "-"}</td>
          <td>${row.childFare || "-"}</td>
        </tr>`
    )
    .join("");
}

function renderScheduleSection(title, rows) {
  if (!rows || !rows.length) return "";
  return `
    <h3 class="direction-title">*${title}</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>출발시간</th>
            <th>출발지</th>
            <th>도착지</th>
            <th>버스회사</th>
            <th>버스요금(성인)</th>
            <th>버스요금(어린이)</th>
          </tr>
        </thead>
        <tbody>${renderRows(rows)}</tbody>
      </table>
    </div>
  `;
}

function renderBlogPost(result) {
  const searchedDate = plainDateFromIso(result.searchedAt);
  const majorStops = result.majorStops && result.majorStops.length ? result.majorStops.join(", ") : "-";
  const busLocationUrl = `https://map.naver.com/p/search/${encodeURIComponent(result.busNo)}`;
  blogPost.innerHTML = `
    <p class="post-kicker">대중교통과 여행하기</p>
    <h2 class="post-title">${PROVIDER.name} ${result.busNo}번 시간표</h2>
    <p class="post-meta">${searchedDate} ${PROVIDER.name} 조회 기준</p>

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
            <td><a href="${result.companyUrl}" target="_blank" rel="noopener">${result.company}</a></td>
          </tr>
          <tr>
            <th>출발지</th>
            <td>${result.depName || "-"}</td>
            <th>도착지</th>
            <td>${result.arrName || "-"}</td>
          </tr>
          <tr>
            <th>주요 경유지</th>
            <td colspan="3">${majorStops}</td>
          </tr>
          <tr>
            <th>실시간 버스위치</th>
            <td colspan="3"><a href="${busLocationUrl}" target="_blank" rel="noopener">네이버지도에서 ${result.busNo}번 버스 검색</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    ${renderScheduleSection("공항방면", result.airportDirection)}
    ${renderScheduleSection("공항방면(주말)", result.weekendAirportDirection)}
    ${renderScheduleSection("시내방면(T2기준)", result.cityDirectionT2)}
    ${renderScheduleSection("시내방면(T2기준/주말)", result.weekendCityDirectionT2)}
    ${renderScheduleSection("시내방면(T1기준)", result.cityDirectionT1)}
    ${renderScheduleSection("시내방면(T1기준/주말)", result.weekendCityDirectionT1)}
  `;
  openNaverBtn.disabled = false;
}

async function searchBusNo(busNo) {
  if (!busNo) return;

  try {
    setStatus(`${busNo}번 ${PROVIDER.name} 시간표를 조회하고 있습니다.`);
    const result = await apiGet(`${PROVIDER.searchApi}?busNo=${encodeURIComponent(busNo)}`);
    renderBlogPost(result);
    setStatus(`${result.busNo}번 ${PROVIDER.name} 시간표를 만들었습니다.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderRouteQuickGrid(routes) {
  routeQuickGrid.innerHTML = "";
  routes.forEach((route) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "route-quick-cell";
    button.innerHTML = `<strong>${route.busNo}</strong><span>${route.label.replace(route.busNo, "").trim()}</span>`;
    button.addEventListener("click", () => {
      busNoInput.value = route.busNo;
      searchBusNo(route.busNo);
    });
    routeQuickGrid.appendChild(button);
  });
}

async function loadRouteButtons() {
  try {
    routeQuickGrid.innerHTML = '<p class="empty inline-empty">버스번호 목록을 불러오는 중입니다.</p>';
    const data = await apiGet(PROVIDER.routesApi);
    renderRouteQuickGrid(data.routes);
  } catch (error) {
    routeQuickGrid.innerHTML = '<p class="empty inline-empty">버스번호 목록을 불러오지 못했습니다.</p>';
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await searchBusNo(busNoInput.value.trim());
});

openNaverBtn.addEventListener("click", async () => {
  if (openNaverBtn.disabled) return;
  await navigator.clipboard.writeText(blogPost.innerHTML.trim());
  window.open("https://blog.naver.com/PostWriteForm.naver?blogId=tint4", "_blank", "noopener");
  setStatus("본문 HTML을 복사하고 네이버 블로그 글쓰기 창을 열었습니다.");
});

loadRouteButtons();
