const patternTitle = document.querySelector("#patternTitle");
const patternStatus = document.querySelector("#patternStatus");
const patternResult = document.querySelector("#patternResult");

const patternParams = new URLSearchParams(window.location.search);
const patternSymbol = (patternParams.get("symbol") || "000660").replace(/\D/g, "").padStart(6, "0");
const patternName = patternParams.get("name") || "하이닉스";

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function formatDate(value) {
  const text = String(value || "");
  if (text.length !== 8) return "-";
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function formatTimes(times) {
  if (!Array.isArray(times) || !times.length) return "-";
  return times.map((value) => {
    const text = String(value || "");
    const dashed = text.match(/\b\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2})/);
    if (dashed) return `${dashed[1]}:${dashed[2]}`;
    const compact = text.match(/^\d{8}(\d{2})(\d{2})/);
    if (compact) return `${compact[1]}:${compact[2]}`;
    const timeOnly = text.match(/\b(\d{1,2}):(\d{2})/);
    if (timeOnly) return `${timeOnly[1].padStart(2, "0")}:${timeOnly[2]}`;
    return text;
  }).join(", ");
}

function parseTimeMinutes(value) {
  const text = String(value || "");
  const dashed = text.match(/\b\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2})/);
  const compact = text.match(/^\d{8}(\d{2})(\d{2})/);
  const timeOnly = text.match(/\b(\d{1,2}):(\d{2})/);
  const match = dashed || compact || timeOnly;
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function formatMinuteLabel(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildThirtyMinuteRows(dailyRows) {
  const bucketMap = new Map();
  for (let minutes = 9 * 60; minutes < 15 * 60 + 30; minutes += 30) {
    bucketMap.set(minutes, { start: minutes, riseCount: 0, fallCount: 0 });
  }

  dailyRows.forEach((row) => {
    (row.riseTimes || []).forEach((value) => {
      const minutes = parseTimeMinutes(value);
      if (minutes === null) return;
      const bucketStart = Math.floor(minutes / 30) * 30;
      if (bucketMap.has(bucketStart)) bucketMap.get(bucketStart).riseCount += 1;
    });
    (row.fallTimes || []).forEach((value) => {
      const minutes = parseTimeMinutes(value);
      if (minutes === null) return;
      const bucketStart = Math.floor(minutes / 30) * 30;
      if (bucketMap.has(bucketStart)) bucketMap.get(bucketStart).fallCount += 1;
    });
  });

  return Array.from(bucketMap.values());
}

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "자료 조회 중 오류가 발생했습니다.");
  return data;
}

function renderDailyThreshold(data) {
  const unit = data.unitMinutes || 10;
  const threshold = data.analysis.threshold || {
    dailyRows: [],
    totalRiseCount: 0,
    totalFallCount: 0,
    riseRate: 1,
    fallRate: -1
  };
  const rows = threshold.dailyRows.map((row) => `
    <tr>
      <td>${formatDate(row.date)}</td>
      <td>${formatNumber(row.candleCount)}</td>
      <td class="${row.riseCount > 0 ? "stock-up" : ""}">${formatNumber(row.riseCount)}</td>
      <td>${formatTimes(row.riseTimes)}</td>
      <td class="${row.fallCount > 0 ? "stock-down" : ""}">${formatNumber(row.fallCount)}</td>
      <td>${formatTimes(row.fallTimes)}</td>
    </tr>
  `).join("");
  const timeBucketRows = buildThirtyMinuteRows(threshold.dailyRows);
  const timeBucketTotal = timeBucketRows.reduce((acc, row) => {
    acc.riseCount += row.riseCount;
    acc.fallCount += row.fallCount;
    return acc;
  }, { riseCount: 0, fallCount: 0 });
  const timeRows = timeBucketRows.map((row) => `
    <tr>
      <td>${formatMinuteLabel(row.start)}~${formatMinuteLabel(row.start + 29)}</td>
      <td class="${row.riseCount > 0 ? "stock-up" : ""}">${formatNumber(row.riseCount)}</td>
      <td class="${row.fallCount > 0 ? "stock-down" : ""}">${formatNumber(row.fallCount)}</td>
      <td>${formatNumber(row.riseCount + row.fallCount)}</td>
    </tr>
  `).join("") + `
    <tr>
      <th>전체 합계</th>
      <th class="${timeBucketTotal.riseCount > 0 ? "stock-up" : ""}">${formatNumber(timeBucketTotal.riseCount)}</th>
      <th class="${timeBucketTotal.fallCount > 0 ? "stock-down" : ""}">${formatNumber(timeBucketTotal.fallCount)}</th>
      <th>${formatNumber(timeBucketTotal.riseCount + timeBucketTotal.fallCount)}</th>
    </tr>
  `;

  patternResult.innerHTML = `
    <p class="post-kicker">주식(다음)분봉 패턴</p>
    <h2 class="post-title">${data.name} ${unit}분봉 급등/급락 횟수</h2>
    <p class="post-meta">조회 범위: ${formatDate(data.requestedStartDate)} ~ ${formatDate(data.requestedEndDate)}</p>
    <div class="table-wrap">
      <table class="route-info-table">
        <tbody>
          <tr>
            <th>종목코드</th>
            <td>${data.symbol}</td>
            <th>자료출처</th>
            <td><a href="${data.sourceUrl}" target="_blank" rel="noopener">${data.source}</a></td>
          </tr>
          <tr>
            <th>실제 자료 범위</th>
            <td>${formatDate(data.actualStartDate)} ~ ${formatDate(data.actualEndDate)}</td>
            <th>${unit}분봉 수</th>
            <td>${formatNumber(data.candleCount)}개</td>
          </tr>
          <tr>
            <th>상승 기준</th>
            <td>직전 ${unit}분 대비 ${formatNumber(threshold.riseRate)}% 이상</td>
            <th>하락 기준</th>
            <td>직전 ${unit}분 대비 ${formatNumber(threshold.fallRate)}% 이하</td>
          </tr>
          <tr>
            <th>상승 총횟수</th>
            <td class="${threshold.totalRiseCount > 0 ? "stock-up" : ""}">${formatNumber(threshold.totalRiseCount)}회</td>
            <th>하락 총횟수</th>
            <td class="${threshold.totalFallCount > 0 ? "stock-down" : ""}">${formatNumber(threshold.totalFallCount)}회</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="stock-notice">각 ${unit}분봉의 종가를 바로 직전 ${unit}분봉 종가와 비교해서 계산했습니다. 장 시작 첫 ${unit}분봉은 해당 봉의 시가 대비 종가 기준입니다.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>일자</th>
            <th>${unit}분봉 수</th>
            <th>${formatNumber(threshold.riseRate)}% 이상 상승 횟수</th>
            <th>상승 발생 시간</th>
            <th>${formatNumber(threshold.fallRate)}% 이하 하락 횟수</th>
            <th>하락 발생 시간</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <h3>30분 단위 발생시간 총합계</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>시간대</th>
            <th>${formatNumber(threshold.riseRate)}% 이상 상승 횟수</th>
            <th>${formatNumber(threshold.fallRate)}% 이하 하락 횟수</th>
            <th>합계</th>
          </tr>
        </thead>
        <tbody>${timeRows}</tbody>
      </table>
    </div>
  `;
}

async function loadPattern() {
  patternTitle.textContent = `${patternName} 주식(다음)분봉 패턴`;
  try {
    patternStatus.textContent = `${patternName} 최근 3개월 10분봉 급등/급락 횟수를 계산하고 있습니다.`;
    const data = await apiGet(`/api/stocks/daum-minute-pattern?symbol=${encodeURIComponent(patternSymbol)}&name=${encodeURIComponent(patternName)}`);
    renderDailyThreshold(data);
    const threshold = data.analysis.threshold;
    patternStatus.textContent = `${data.unitMinutes}분봉 기준 ${formatNumber(threshold.riseRate)}% 이상 상승 ${threshold.totalRiseCount}회, ${formatNumber(threshold.fallRate)}% 이하 하락 ${threshold.totalFallCount}회를 일자별로 정리했습니다.`;
  } catch (error) {
    patternResult.innerHTML = `<p class="empty">${error.message}</p>`;
    patternStatus.textContent = error.message;
    patternStatus.style.color = "#c2410c";
  }
}

loadPattern();
