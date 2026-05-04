const form = document.querySelector("#busanBusForm");
const busNoInput = document.querySelector("#busNoInput");
const statusEl = document.querySelector("#status");
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

function renderScheduleTable(schedule, index) {
  const headers = schedule.headers.map((header) => `<th>${header}</th>`).join("");
  const rows = schedule.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell || "-"}</td>`).join("")}</tr>`)
    .join("");
  return `
    <section class="jeju-schedule-panel ${index === 0 ? "active" : ""}" data-panel="${index}">
      <div class="table-wrap">
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function activateTab(index) {
  blogPost.querySelectorAll(".jeju-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === String(index)));
  blogPost.querySelectorAll(".jeju-schedule-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === String(index)));
}

function bindTabs() {
  blogPost.querySelectorAll(".jeju-tab").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });
}

function renderBlogPost(result) {
  const searchedDate = plainDateFromIso(result.searchedAt);
  const majorStops = result.majorStops && result.majorStops.length ? result.majorStops.join(", ") : "-";
  const tabs = result.schedules
    .map((schedule, index) => `<button class="jeju-tab ${index === 0 ? "active" : ""}" type="button" data-tab="${index}">${schedule.title}</button>`)
    .join("");
  const panels = result.schedules.map(renderScheduleTable).join("");

  blogPost.innerHTML = `
    <p class="post-kicker">대중교통과 여행하기</p>
    <h2 class="post-title">부산버스 ${result.busNo}번 정류소별 첫차 막차</h2>
    <p class="post-meta">${searchedDate} 부산버스 조회 기준</p>

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
            <td>${result.company}</td>
          </tr>
          <tr>
            <th>기점</th>
            <td>${result.origin || "-"}</td>
            <th>종점</th>
            <td>${result.destination || "-"}</td>
          </tr>
          <tr>
            <th>버스종류</th>
            <td>${result.busKind || "-"}</td>
            <th>배차간격</th>
            <td>${result.interval || "-"}</td>
          </tr>
          <tr>
            <th>주요 정류장</th>
            <td colspan="3">${majorStops}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="jeju-tabs">${tabs}</div>
    ${panels || '<p class="empty">조회된 첫차/막차 정보가 없습니다.</p>'}
  `;
  openNaverBtn.disabled = false;
  bindTabs();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const busNo = busNoInput.value.trim();
  if (!busNo) return;

  try {
    setStatus(`${busNo}번 부산버스 정보를 조회하고 있습니다.`);
    const result = await apiGet(`/api/busan-bus/search?busNo=${encodeURIComponent(busNo)}`);
    renderBlogPost(result);
    setStatus(`${result.busNo}번 부산버스 첫차/막차 표를 만들었습니다.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

openNaverBtn.addEventListener("click", async () => {
  if (openNaverBtn.disabled) return;
  await navigator.clipboard.writeText(blogPost.innerHTML.trim());
  window.open("https://blog.naver.com/PostWriteForm.naver?blogId=tint4", "_blank", "noopener");
  setStatus("본문 HTML을 복사하고 네이버 블로그 글쓰기 창을 열었습니다.");
});
