const stockTitle = document.querySelector("#stockTitle");
const stockStatus = document.querySelector("#stockStatus");
const stockResult = document.querySelector("#stockResult");

const stockParams = new URLSearchParams(window.location.search);
const stockSymbol = (stockParams.get("symbol") || "000660").replace(/\D/g, "").padStart(6, "0");
const stockSymbols = (stockParams.get("symbols") || "").split(",").map((value) => value.replace(/\D/g, "").padStart(6, "0")).filter((value) => /^\d{6}$/.test(value));
const stockNames = stockParams.get("names") || "";
const stockName = stockParams.get("name") || (stockSymbol === "005930" ? "삼성전자" : "하이닉스");

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

function renderStock(data) {
  const rows = data.rows.map((row) => `
    <tr>
      <td>${row.timeRange}</td>
      <td>${formatNumber(row.count)}</td>
      <td class="${row.averageChange > 0 ? "stock-up" : row.averageChange < 0 ? "stock-down" : ""}">${formatNumber(row.averageChange)}</td>
      <td class="${row.averageRate > 0 ? "stock-up" : row.averageRate < 0 ? "stock-down" : ""}">${formatNumber(row.averageRate, 2)}%</td>
    </tr>
  `).join("");

  stockResult.innerHTML = `
    <p class="post-kicker">주식</p>
    <h2 class="post-title">${data.name} 30분 평균 등락폭</h2>
    <p class="post-meta">요청 범위: ${formatDate(data.requestedStartDate)} ~ ${formatDate(data.requestedEndDate)}</p>
    <div class="table-wrap">
      <table class="route-info-table">
        <tbody>
          <tr>
            <th>${data.aggregate ? "묶음 종목" : "종목코드"}</th>
            <td>${data.aggregate ? data.names.join(", ") : data.symbol}</td>
            <th>자료출처</th>
            <td>${data.sourceUrl ? `<a href="${data.sourceUrl}" target="_blank" rel="noopener">${data.source}</a>` : data.source}</td>
          </tr>
          <tr>
            <th>실제 분봉 범위</th>
            <td>${formatDate(data.actualStartDate)} ~ ${formatDate(data.actualEndDate)}</td>
            <th>분봉 수</th>
            <td>${formatNumber(data.minuteRowCount)}개</td>
          </tr>
          <tr>
            <th>거래일 수</th>
            <td>${formatNumber(data.tradingDayCount)}일</td>
            <th>계산 기준</th>
            <td>09:00~20:00, 30분 단위</td>
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

async function loadStockAverage() {
  stockTitle.textContent = `${stockName} 30분 평균 등락폭`;
  try {
    stockStatus.textContent = `${stockName} 네이버 금융 분봉 자료를 불러오고 있습니다.`;
    const query = stockSymbols.length
      ? `symbols=${encodeURIComponent(stockSymbols.join(","))}&names=${encodeURIComponent(stockNames)}&name=${encodeURIComponent(stockName)}`
      : `symbol=${encodeURIComponent(stockSymbol)}&name=${encodeURIComponent(stockName)}`;
    const data = await apiGet(`/api/stocks/intraday-average?${query}`);
    renderStock(data);
    stockStatus.textContent = `${data.tradingDayCount}일, ${data.minuteRowCount}개 분봉 기준으로 평균을 만들었습니다.`;
  } catch (error) {
    stockResult.innerHTML = `<p class="empty">${error.message}</p>`;
    stockStatus.textContent = error.message;
    stockStatus.style.color = "#c2410c";
  }
}

loadStockAverage();
