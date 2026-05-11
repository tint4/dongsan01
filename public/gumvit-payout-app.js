const statusEl = document.querySelector("#status");
const resultEl = document.querySelector("#gumvitPayoutResult");
const pageTitle = document.querySelector("#pageTitle");

const params = new URLSearchParams(window.location.search);
const loc = (params.get("loc") || "S").toUpperCase();
const label = params.get("label") || ({ S: "서울", B: "부산", J: "제주" }[loc] || "서울");
const firstDate = "2018-01-01";
const maxPages = 120;
const rateLimitMs = 60 * 1000;
const cacheKey = `gumvit-payout-cache-v2-${loc}`;
const dateCachePrefix = `gumvit-result-date-cache-v2-${loc}-`;

let rowsCache = [];
let overallCache = { count: 0, sum: 0, average: 0 };
let processedDayCount = 0;
let processedRaceCount = 0;
let isLoading = false;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c2410c" : "";
}

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "조회 중 오류가 발생했습니다.");
  return data;
}

function loadCachedResult() {
  try {
    const data = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (!data || !Array.isArray(data.rows) || !data.searchedAt) return null;
    return data;
  } catch (error) {
    return null;
  }
}

function saveCachedResult(rows) {
  localStorage.setItem(cacheKey, JSON.stringify({
    searchedAt: Date.now(),
    rows,
    processedDayCount,
    processedRaceCount
  }));
}

function getRemainingSeconds(cached) {
  if (!cached) return 0;
  const remaining = rateLimitMs - (Date.now() - Number(cached.searchedAt || 0));
  return Math.max(0, Math.ceil(remaining / 1000));
}

function loadCachedDate(date, races) {
  try {
    const data = JSON.parse(localStorage.getItem(`${dateCachePrefix}${date}`) || "null");
    if (!data || !Array.isArray(data.results)) return null;
    const found = new Set(data.results.map((item) => Number(item.raceNo)));
    if (!races.every((raceNo) => found.has(Number(raceNo)))) return null;
    return {
      ...data,
      results: data.results.filter((item) => races.includes(Number(item.raceNo)))
    };
  } catch (error) {
    return null;
  }
}

function saveCachedDate(date, data) {
  try {
    localStorage.setItem(`${dateCachePrefix}${date}`, JSON.stringify({
      cachedAt: Date.now(),
      loc,
      date,
      results: data.results || []
    }));
  } catch (error) {
    // Storage may be full; the search can still continue without this cache.
  }
}

async function loadDateRaceData(day) {
  const cached = loadCachedDate(day.date, day.races);
  if (cached) return cached;
  const raceData = await apiGet(`/api/gumvit/result-date?loc=${encodeURIComponent(loc)}&date=${encodeURIComponent(day.date)}&races=${encodeURIComponent(day.races.join(","))}`);
  saveCachedDate(day.date, raceData);
  return raceData;
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function addPayout(summary, item) {
  const payout = Number(item.trifectaPayout || 0);
  if (!payout) return;
  const current = summary.get(item.raceNo) || {
    raceNo: item.raceNo,
    count: 0,
    sum: 0,
    average: 0,
    latest: ""
  };
  current.count += 1;
  current.sum += payout;
  current.average = current.sum / current.count;
  if (!current.latest || `${item.date} ${item.raceNo}` > current.latest) {
    current.latest = `${item.date} ${item.raceNo}경주`;
  }
  summary.set(item.raceNo, current);
  processedRaceCount += 1;
}

function getRows(summary) {
  return [...summary.values()]
    .map((row) => ({ ...row, average: row.count ? row.sum / row.count : 0 }))
    .sort((a, b) => a.raceNo - b.raceNo);
}

function getOverall(rows) {
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const total = rows.reduce((sum, row) => sum + row.sum, 0);
  return { count, sum: total, average: count ? total / count : 0 };
}

function bindButtons() {
  document.querySelector("#searchBtn")?.addEventListener("click", () => {
    loadPayouts().catch(handleLoadError);
  });
  document.querySelector("#excelDownloadBtn")?.addEventListener("click", downloadExcel);
}

function renderReady() {
  pageTitle.textContent = `${label}경주 배당`;
  resultEl.innerHTML = `
    <p class="post-kicker">검빛</p>
    <h2 class="post-title">${label}경주 배당</h2>
    <p class="post-meta">자료 조회 버튼을 누르면 2018년 1월 1일부터 조회일까지의 삼쌍승 배당을 분석합니다.</p>
    <div class="result-tools">
      <button type="button" id="searchBtn">자료 조회</button>
      <button type="button" id="excelDownloadBtn" disabled>엑셀 다운로드</button>
    </div>
    <p class="empty">아직 조회를 시작하지 않았습니다.</p>
  `;
  bindButtons();
  setStatus("자료 조회 버튼을 누르면 분석을 시작합니다.");
}

function renderTable(rows, isDone = false, cachedMessage = "") {
  rowsCache = getRows(new Map(rows.map((row) => [row.raceNo, row])));
  overallCache = getOverall(rowsCache);

  resultEl.innerHTML = `
    <p class="post-kicker">검빛</p>
    <h2 class="post-title">${label}경주 배당</h2>
    <p class="post-meta">분석 범위: 2018년 1월 1일부터 조회일까지 · 삼쌍승 배당 평균</p>
    <div class="result-tools">
      <button type="button" id="searchBtn" ${isLoading ? "disabled" : ""}>자료 조회</button>
      <button type="button" id="excelDownloadBtn" ${rowsCache.length ? "" : "disabled"}>엑셀 다운로드</button>
    </div>
    <div class="table-wrap">
      <table class="route-info-table">
        <tbody>
          <tr>
            <th>전체 경주수</th>
            <td>${overallCache.count.toLocaleString("ko-KR")}</td>
            <th>전체 삼쌍승 평균</th>
            <td>${formatNumber(overallCache.average)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>경주</th>
            <th>경주수</th>
            <th>삼쌍승 배당 합계</th>
            <th>삼쌍승 평균</th>
            <th>최근 사례</th>
          </tr>
        </thead>
        <tbody>
          ${rowsCache.map((row) => `
            <tr>
              <td>${row.raceNo}경주</td>
              <td>${row.count.toLocaleString("ko-KR")}</td>
              <td>${formatNumber(row.sum)}</td>
              <td>${formatNumber(row.average)}</td>
              <td>${row.latest}</td>
            </tr>
          `).join("") || '<tr><td colspan="5">아직 집계된 배당이 없습니다.</td></tr>'}
        </tbody>
      </table>
    </div>
    <p class="post-meta">${cachedMessage || (isDone ? "분석 완료" : "분석 중")} · 처리 일자 ${processedDayCount}일 · 처리 경주 ${processedRaceCount}경주</p>
  `;
  bindButtons();
}

function downloadExcel() {
  if (!rowsCache.length) return;
  const header = ["경주", "경주수", "삼쌍승 배당 합계", "삼쌍승 평균", "최근 사례"];
  const lines = [
    [`${label}경주 전체`, overallCache.count, overallCache.sum.toFixed(1), overallCache.average.toFixed(1), ""].join(","),
    header.join(","),
    ...rowsCache.map((row) => [
      `${row.raceNo}경주`,
      row.count,
      row.sum.toFixed(1),
      row.average.toFixed(1),
      `"${String(row.latest || "").replace(/"/g, '""')}"`
    ].join(","))
  ];
  const blob = new Blob([`\ufeff${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${label}-경주-삼쌍승-배당.csv`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

async function loadPayouts() {
  if (isLoading) return;
  isLoading = true;

  const cached = loadCachedResult();
  const remainingSeconds = getRemainingSeconds(cached);
  if (cached && remainingSeconds > 0) {
    processedDayCount = Number(cached.processedDayCount || 0);
    processedRaceCount = Number(cached.processedRaceCount || 0);
    isLoading = false;
    renderTable(cached.rows, true, `최근 조회 결과 표시 중 · ${remainingSeconds}초 후 재검색 가능`);
    setStatus(`${label}경주 배당은 1분 이내 재검색할 수 없습니다. ${remainingSeconds}초 후 다시 조회할 수 있습니다.`);
    return;
  }

  const summary = new Map();
  const seenDates = new Set();
  processedDayCount = 0;
  processedRaceCount = 0;
  renderTable([], false);

  for (let page = 1; page <= maxPages; page += 1) {
    setStatus(`${label} 배당 목록 ${page}페이지를 확인하고 있습니다. 현재 ${processedRaceCount}경주 처리.`);
    const dayData = await apiGet(`/api/gumvit/result-days?loc=${encodeURIComponent(loc)}&page=${page}`);
    const days = (dayData.days || []).filter((day) => {
      if (seenDates.has(day.date)) return false;
      seenDates.add(day.date);
      return day.date >= firstDate;
    });
    if (!days.length) break;

    for (const day of days) {
      setStatus(`${day.date} ${label} 삼쌍승 배당을 분석하고 있습니다. 현재 ${processedRaceCount}경주 처리.`);
      const raceData = await loadDateRaceData(day);
      processedDayCount += 1;
      (raceData.results || []).forEach((item) => addPayout(summary, item));
      if (processedDayCount % 5 === 0) renderTable(getRows(summary), false);
    }

    renderTable(getRows(summary), false);
    const oldest = days[days.length - 1]?.date || "";
    if (oldest && oldest < firstDate) break;
  }

  const rows = getRows(summary);
  saveCachedResult(rows);
  isLoading = false;
  renderTable(rows, true);
  setStatus(`${label}경주 배당 분석을 완료했습니다. 총 ${processedRaceCount}경주를 반영했습니다.`);
}

function handleLoadError(error) {
  isLoading = false;
  resultEl.innerHTML = `
    <p class="empty">${error.message}</p>
    <div class="result-tools">
      <button type="button" id="searchBtn">자료 조회</button>
      <button type="button" id="excelDownloadBtn" disabled>엑셀 다운로드</button>
    </div>
  `;
  bindButtons();
  setStatus(error.message, true);
}

renderReady();
