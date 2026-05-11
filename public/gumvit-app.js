const statusEl = document.querySelector("#status");
const resultEl = document.querySelector("#gumvitResult");
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

function renderRace(race) {
  const rows = race.horses.map((horse) => `
    <tr class="gumvit-grade-${horse.grade}">
      <td>${horse.rank}</td>
      <td>${horse.grade}</td>
      <td>${horse.horseNo}</td>
      <td>${horse.horseName}</td>
      <td>${horse.score}</td>
      <td>${horse.jockeyName || "-"}</td>
      <td>${horse.note || ""}</td>
    </tr>
  `).join("");

  return `
    <h3 class="direction-title">${race.raceNo}경주</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>순위</th>
            <th>등급</th>
            <th>마번</th>
            <th>마명</th>
            <th>점수</th>
            <th>기수명</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7">조회된 말 정보가 없습니다.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function renderResult(data) {
  resultEl.innerHTML = `
    <p class="post-kicker">검빛</p>
    <h2 class="post-title">${label} 검빛 점수표</h2>
    <p class="post-meta">${data.date || ""} 기준 · ★ 4점, ◎ 3점, ○ 2점, ▲ 1점, ※ 2점</p>
    <div class="table-wrap">
      <table class="route-info-table">
        <tbody>
          <tr>
            <th>출처</th>
            <td><a href="${data.officialUrl}" target="_blank" rel="noopener">검빛 출마표</a></td>
            <th>등급</th>
            <td>1~4위 A, 5~8위 B, 나머지 C</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${data.races.map(renderRace).join("")}
  `;
}

async function loadScores() {
  pageTitle.textContent = `${label} 검빛 점수표`;
  try {
    setStatus(`${label} 검빛 출마표를 불러오고 있습니다.`);
    const data = await apiGet(`/api/gumvit/scores?loc=${encodeURIComponent(loc)}&type=${encodeURIComponent(type)}`);
    renderResult(data);
    setStatus(`${data.races.length}개 경주의 점수표를 만들었습니다.`);
  } catch (error) {
    resultEl.innerHTML = `<p class="empty">${error.message}</p>`;
    setStatus(error.message, true);
  }
}

loadScores();
