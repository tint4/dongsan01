const tossStockTitle = document.querySelector("#tossStockTitle");
const tossStockStatus = document.querySelector("#tossStockStatus");
const tossStockResult = document.querySelector("#tossStockResult");

const tossParams = new URLSearchParams(window.location.search);
const tossSymbol = (tossParams.get("symbol") || "000660").replace(/\D/g, "").padStart(6, "0");
const tossName = tossParams.get("name") || (tossSymbol === "005930" ? "삼성전자" : "하이닉스");

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
  if (!response.ok) {
    const error = new Error(data.error || "자료 조회 중 오류가 발생했습니다.");
    error.data = data;
    throw error;
  }
  return data;
}

function renderLoginRequired(data) {
  tossStockResult.innerHTML = `
    <p class="post-kicker">주식(토스)</p>
    <h2 class="post-title">${tossName} 10분 평균</h2>
    <div class="table-wrap">
      <table class="route-info-table">
        <tbody>
          <tr>
            <th>종목코드</th>
            <td>${data.symbol || tossSymbol}</td>
            <th>자료출처</th>
            <td><a href="${data.sourceUrl || `https://www.tossinvest.com/stocks/A${tossSymbol}`}" target="_blank" rel="noopener">토스증권</a></td>
          </tr>
          <tr>
            <th>조회 범위</th>
            <td>${formatDate(data.requestedStartDate)} ~ ${formatDate(data.requestedEndDate)}</td>
            <th>계산 기준</th>
            <td>10분 단위</td>
          </tr>
          <tr>
            <th>조회 상태</th>
            <td colspan="3">토스증권 로그인이 필요한 자료입니다.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="empty">${data.error || "토스증권에서 로그인이 필요한 응답을 보냈습니다."}</p>
    <div class="naver-post-actions">
      <a class="home-back-link" href="${data.loginUrl || `https://www.tossinvest.com/stocks/A${tossSymbol}`}" target="_blank" rel="noopener">토스증권 로그인 열기</a>
      <a class="home-back-link" href="https://www.tossinvest.com/stocks/A${tossSymbol}" target="_blank" rel="noopener">토스증권 종목 페이지 열기</a>
    </div>
    <p class="stock-notice">토스증권 공식 차트 API가 로그인 필요 응답을 반환했습니다. 로그인을 직접 진행할 수 있도록 공식 토스증권 페이지를 새 창으로 연결합니다. 이 사이트는 토스 비밀번호나 인증정보를 저장하지 않습니다.</p>
  `;
}

function renderTossStock(data) {
  const rows = data.rows.map((row) => `
    <tr>
      <td>${row.timeRange}</td>
      <td>${formatNumber(row.count)}</td>
      <td class="${row.averageChange > 0 ? "stock-up" : row.averageChange < 0 ? "stock-down" : ""}">${formatNumber(row.averageChange)}</td>
      <td class="${row.averageRate > 0 ? "stock-up" : row.averageRate < 0 ? "stock-down" : ""}">${formatNumber(row.averageRate, 2)}%</td>
    </tr>
  `).join("");

  tossStockResult.innerHTML = `
    <p class="post-kicker">주식(토스)</p>
    <h2 class="post-title">${data.name} 10분 평균 등락폭</h2>
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
            <th>자료 수</th>
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

async function loadTossStockAverage() {
  tossStockTitle.textContent = `${tossName} 주식(토스) 10분 평균`;
  try {
    tossStockStatus.textContent = `${tossName} 토스증권 1년 자료를 불러오고 있습니다.`;
    const data = await apiGet(`/api/stocks/toss-ten-minute-average?symbol=${encodeURIComponent(tossSymbol)}&name=${encodeURIComponent(tossName)}`);
    renderTossStock(data);
    tossStockStatus.textContent = `${data.candleCount}개 자료 기준으로 10분 평균을 만들었습니다.`;
  } catch (error) {
    if (error.data?.loginRequired) {
      renderLoginRequired(error.data);
      tossStockStatus.textContent = "토스증권 로그인이 필요합니다.";
      return;
    }
    tossStockResult.innerHTML = `<p class="empty">${error.message}</p>`;
    tossStockStatus.textContent = error.message;
    tossStockStatus.style.color = "#c2410c";
  }
}

loadTossStockAverage();
