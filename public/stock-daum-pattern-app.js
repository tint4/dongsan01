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

function formatDateTime(value) {
  const text = String(value || "");
  if (text.length < 12) return "-";
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)} ${text.slice(8, 10)}:${text.slice(10, 12)}`;
}

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "자료 조회 중 오류가 발생했습니다.");
  return data;
}

function classBySign(value) {
  return Number(value) > 0 ? "stock-up" : Number(value) < 0 ? "stock-down" : "";
}

function renderSummaryText(data) {
  const surge = data.analysis.surge;
  const plunge = data.analysis.plunge;
  const surgeDirection = surge.beforeUpRatio >= 0.5 ? "상승 흐름" : "하락 또는 보합 흐름";
  const plungeDirection = plunge.beforeDownRatio >= 0.5 ? "하락 흐름" : "상승 또는 보합 흐름";
  const surgeVolume = surge.avgBeforeVolumeRatio >= 1.2 ? "평소보다 거래량이 먼저 늘어나는 편" : "거래량 선행 신호는 강하지 않은 편";
  const plungeVolume = plunge.avgBeforeVolumeRatio >= 1.2 ? "급락 전 거래량이 먼저 커지는 편" : "급락 전 거래량 변화는 제한적인 편";

  return `
    <p>
      최근 3개월 5분봉에서 급등 상위 구간 직전 15분은 평균 ${formatNumber(surge.avgBeforeRate, 2)}%의 ${surgeDirection}이었고,
      직전 거래량은 평소 대비 ${formatNumber(surge.avgBeforeVolumeRatio, 2)}배 수준이었습니다. ${surgeVolume}입니다.
    </p>
    <p>
      급락 상위 구간 직전 15분은 평균 ${formatNumber(plunge.avgBeforeRate, 2)}%의 ${plungeDirection}이었고,
      직전 거래량은 평소 대비 ${formatNumber(plunge.avgBeforeVolumeRatio, 2)}배 수준이었습니다. ${plungeVolume}입니다.
    </p>
    <p class="stock-notice">이 내용은 과거 분봉의 통계 요약이며 매수 또는 매도 추천이 아닙니다.</p>
  `;
}

function renderEvents(title, events) {
  const rows = events.map((event) => `
    <tr>
      <td>${formatDateTime(event.candleTime)}</td>
      <td class="${classBySign(event.eventRate)}">${formatNumber(event.eventRate, 2)}%</td>
      <td class="${classBySign(event.eventChange)}">${formatNumber(event.eventChange)}</td>
      <td>${event.beforeDirection}</td>
      <td class="${classBySign(event.beforeRate)}">${formatNumber(event.beforeRate, 2)}%</td>
      <td>${formatNumber(event.beforeVolumeRatio, 2)}배</td>
    </tr>
  `).join("");

  return `
    <h3>${title}</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>시간</th>
            <th>해당 5분 등락률</th>
            <th>해당 5분 등락폭</th>
            <th>직전 15분 방향</th>
            <th>직전 15분 등락률</th>
            <th>직전 거래량 배율</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderPattern(data) {
  patternResult.innerHTML = `
    <p class="post-kicker">주식(다음)분봉 패턴</p>
    <h2 class="post-title">${data.name} 급등/급락 조짐 분석</h2>
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
            <th>분석 기준</th>
            <td>최근 3개월 ${data.unitMinutes}분봉</td>
            <th>패턴 구간</th>
            <td>급등 ${data.analysis.surge.count}건 / 급락 ${data.analysis.plunge.count}건</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${renderSummaryText(data)}
    ${renderEvents("급등 상위 구간", data.analysis.surgeEvents)}
    ${renderEvents("급락 상위 구간", data.analysis.plungeEvents)}
  `;
}

async function loadPattern() {
  patternTitle.textContent = `${patternName} 주식(다음)분봉 패턴 분석`;
  try {
    patternStatus.textContent = `${patternName} 다음금융 3개월 5분봉 자료를 분석하고 있습니다.`;
    const data = await apiGet(`/api/stocks/daum-minute-pattern?symbol=${encodeURIComponent(patternSymbol)}&name=${encodeURIComponent(patternName)}`);
    renderPattern(data);
    patternStatus.textContent = `${data.candleCount}개 5분봉으로 급등/급락 조짐을 분석했습니다.`;
  } catch (error) {
    patternResult.innerHTML = `<p class="empty">${error.message}</p>`;
    patternStatus.textContent = error.message;
    patternStatus.style.color = "#c2410c";
  }
}

loadPattern();
