const statusEl = document.querySelector("#status");
const resultEl = document.querySelector("#gumvitOrderResult");
const pageTitle = document.querySelector("#pageTitle");

const params = new URLSearchParams(window.location.search);
const loc = params.get("loc") || "S";
const type = params.get("type") || "6";
const label = params.get("label") || "서울(토)";

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

function renderOrderTable(data) {
  const headerCells = Array.from({ length: 12 }, (_, index) => `<th>${index + 1}</th>`).join("");
  const rows = data.races.map((race) => {
    const hasScore = race.horses.some((horse) => Number(horse.score || 0) > 0);
    const horses = hasScore ? race.horses.slice(0, 12) : [];
    const cells = hasScore
      ? Array.from({ length: 12 }, (_, index) => `<td>${horses[index]?.horseNo || ""}</td>`).join("")
      : '<td colspan="12">점수 데이터 없음</td>';
    return `
      <tr>
        <th>${race.raceNo}경기</th>
        ${cells}
      </tr>
    `;
  }).join("");

  resultEl.innerHTML = `
    <p class="post-kicker">검빛</p>
    <h2 class="post-title">${label} 검빛 순서도</h2>
    <p class="post-meta">${data.date || ""} 기준 · 각 경주별 점수 높은 말번호 순서</p>
    <div class="table-wrap">
      <table class="gumvit-order-table">
        <thead>
          <tr>
            <th></th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadOrder() {
  pageTitle.textContent = `${label} 검빛 순서도`;
  try {
    setStatus(`${label} 검빛 순서도를 만들고 있습니다.`);
    const data = await apiGet(`/api/gumvit/scores?loc=${encodeURIComponent(loc)}&type=${encodeURIComponent(type)}`);
    renderOrderTable(data);
    setStatus(`${data.races.length}개 경기의 순서도를 만들었습니다.`);
  } catch (error) {
    resultEl.innerHTML = `<p class="empty">${error.message}</p>`;
    setStatus(error.message, true);
  }
}

loadOrder();
