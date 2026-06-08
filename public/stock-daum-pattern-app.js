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
    return text.length >= 12 ? `${text.slice(8, 10)}:${text.slice(10, 12)}` : text;
  }).join(", ");
}

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "자료 조회 중 오류가 발생했습니다.");
  return data;
}

function renderDailyThreshold(data) {
  const threshold = data.analysis.threshold || {
    dailyRows: [],
    totalRiseCount: 0,
    totalFallCount: 0,
    riseRate: 5,
    fallRate: -5
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

  patternResult.innerHTML = `
    <p class="post-kicker">주식(다음)분봉 패턴</p>
    <h2 class="post-title">${data.name} 5분봉 급등/급락 횟수</h2>
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
            <th>분봉 수</th>
            <td>${formatNumber(data.candleCount)}개</td>
          </tr>
          <tr>
            <th>상승 기준</th>
            <td>직전 5분 대비 ${formatNumber(threshold.riseRate)}% 이상</td>
            <th>하락 기준</th>
            <td>직전 5분 대비 ${formatNumber(threshold.fallRate)}% 이하</td>
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
    <p class="stock-notice">각 5분봉의 종가를 바로 직전 5분봉 종가와 비교해서 계산했습니다. 장 시작 첫 5분봉은 해당 봉의 시가 대비 종가 기준입니다.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>일자</th>
            <th>5분봉 수</th>
            <th>${formatNumber(threshold.riseRate)}% 이상 상승 횟수</th>
            <th>상승 발생 시간</th>
            <th>${formatNumber(threshold.fallRate)}% 이하 하락 횟수</th>
            <th>하락 발생 시간</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadPattern() {
  patternTitle.textContent = `${patternName} 주식(다음)분봉 패턴`;
  try {
    patternStatus.textContent = `${patternName} 최근 3개월 5분봉 급등/급락 횟수를 계산하고 있습니다.`;
    const data = await apiGet(`/api/stocks/daum-minute-pattern?symbol=${encodeURIComponent(patternSymbol)}&name=${encodeURIComponent(patternName)}`);
    renderDailyThreshold(data);
    const threshold = data.analysis.threshold;
    patternStatus.textContent = `${formatNumber(threshold.riseRate)}% 이상 상승 ${threshold.totalRiseCount}회, ${formatNumber(threshold.fallRate)}% 이하 하락 ${threshold.totalFallCount}회를 일자별로 정리했습니다.`;
  } catch (error) {
    patternResult.innerHTML = `<p class="empty">${error.message}</p>`;
    patternStatus.textContent = error.message;
    patternStatus.style.color = "#c2410c";
  }
}

loadPattern();
