const daumStockTitle = document.querySelector("#daumStockTitle");
const daumStockStatus = document.querySelector("#daumStockStatus");
const daumStockResult = document.querySelector("#daumStockResult");

const daumParams = new URLSearchParams(window.location.search);
const daumSymbol = (daumParams.get("symbol") || "000660").replace(/\D/g, "").padStart(6, "0");
const daumName = daumParams.get("name") || (daumSymbol === "005930" ? "삼성전자" : "하이닉스");

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

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "자료 조회 중 오류가 발생했습니다.");
  return data;
}

function renderDaumStock(data) {
  const rows = data.rows.map((row) => `
    <tr>
      <td>${row.timeRange}</td>
      <td>${formatNumber(row.count)}</td>
      <td class="${row.averageChange > 0 ? "stock-up" : row.averageChange < 0 ? "stock-down" : ""}">${formatNumber(row.averageChange)}</td>
      <td class="${row.averageRate > 0 ? "stock-up" : row.averageRate < 0 ? "stock-down" : ""}">${formatNumber(row.averageRate, 2)}%</td>
    </tr>
  `).join("");

  daumStockResult.innerHTML = `
    <p class="post-kicker">주식(다음)</p>
    <h2 class="post-title">${data.name} 10분 평균 등락현황</h2>
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
            <th>10분봉 수</th>
            <td>${formatNumber(data.candleCount)}개</td>
          </tr>
          <tr>
            <th>계산 기준</th>
            <td>10분 단위</td>
            <th>시장 시간</th>
            <td>${data.marketHours}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="stock-notice">${data.notice}</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>시간대</th>
            <th>계산건수</th>
            <th>평균 등락폭</th>
            <th>평균 등락률</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadDaumStockAverage() {
  daumStockTitle.textContent = `${daumName} 주식(다음) 10분 평균`;
  try {
    daumStockStatus.textContent = `${daumName} 다음금융 1년 10분봉 자료를 불러오고 있습니다.`;
    const data = await apiGet(`/api/stocks/daum-ten-minute-average?symbol=${encodeURIComponent(daumSymbol)}&name=${encodeURIComponent(daumName)}`);
    renderDaumStock(data);
    daumStockStatus.textContent = `${data.candleCount}개 10분봉 기준으로 평균을 만들었습니다.`;
  } catch (error) {
    daumStockResult.innerHTML = `<p class="empty">${error.message}</p>`;
    daumStockStatus.textContent = error.message;
    daumStockStatus.style.color = "#c2410c";
  }
}

loadDaumStockAverage();
