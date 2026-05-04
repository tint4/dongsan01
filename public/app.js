const state = {
  dep: null,
  arr: null,
  lastResult: null
};

const depInput = document.querySelector("#depInput");
const arrInput = document.querySelector("#arrInput");
const dateInput = document.querySelector("#dateInput");
const swapTerminalsBtn = document.querySelector("#swapTerminalsBtn");
const depList = document.querySelector("#depList");
const arrList = document.querySelector("#arrList");
const depQuick = document.querySelector("#depQuick");
const arrQuick = document.querySelector("#arrQuick");
const statusEl = document.querySelector("#status");
const form = document.querySelector("#searchForm");
const blogPost = document.querySelector("#blogPost");
const copyTextBtn = document.querySelector("#copyTextBtn");
const copyHtmlBtn = document.querySelector("#copyHtmlBtn");
const openNaverBtn = document.querySelector("#openNaverBtn");
const printBtn = document.querySelector("#printBtn");

function defaultTravelDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date;
}

dateInput.valueAsDate = defaultTravelDate();

const MAIN_TERMINALS = [
  { id: "0004", name: "서울남부", area: "서울", lat: 37.4849, lng: 127.0167 },
  { id: "0010", name: "김포공항", area: "서울", lat: 37.5585, lng: 126.7945 },
  { id: "0001", name: "동서울", area: "서울", lat: 37.5341, lng: 127.0947 },
  { id: "9002", name: "부산서부", area: "부산", lat: 35.1631, lng: 128.9846 },
  { id: "9401", name: "광주(유ㆍ스퀘어)", area: "광주", lat: 35.1601, lng: 126.8808 },
  { id: "9201", name: "동대구", area: "대구", lat: 35.8779, lng: 128.6286 }
];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#c2410c" : "";
}

function money(value) {
  const number = Number(value || 0);
  return number ? `${number.toLocaleString("ko-KR")}원` : "-";
}

function prettyDate(value) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function plainDate(value) {
  if (!value || value.length < 8) return "";
  return `${value.slice(0, 4)}년 ${Number(value.slice(4, 6))}월 ${Number(value.slice(6, 8))}일`;
}

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "조회 중 오류가 발생했습니다.");
  return data;
}

function closeSuggestions() {
  depList.classList.remove("open");
  arrList.classList.remove("open");
}

function resetGeneratedPost() {
  state.lastResult = null;
  blogPost.innerHTML = '<p class="empty">출발지, 도착지, 날짜를 선택하면 블로그용 운행 정보가 여기에 만들어집니다.</p>';
  copyTextBtn.disabled = true;
  copyHtmlBtn.disabled = true;
  openNaverBtn.disabled = true;
  printBtn.disabled = true;
}

function renderSuggestions(target, items, onPick) {
  target.innerHTML = "";
  if (!items.length) {
    target.classList.remove("open");
    return;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion";
    button.innerHTML = `${item.name}<small>${item.area || ""} · 코드 ${item.id}</small>`;
    button.addEventListener("click", () => {
      onPick(item);
      target.classList.remove("open");
    });
    target.appendChild(button);
  });

  target.classList.add("open");
}

function markQuickSelection(kind, terminal) {
  const container = kind === "dep" ? depQuick : arrQuick;
  container.querySelectorAll(".quick-terminal").forEach((button) => {
    button.classList.toggle("selected", Boolean(terminal) && button.dataset.id === terminal.id);
  });
}

function syncTerminalFields() {
  depInput.value = state.dep ? state.dep.name : "";
  arrInput.value = state.arr ? state.arr.name : "";
  arrInput.disabled = !state.dep;
  markQuickSelection("dep", state.dep);
  markQuickSelection("arr", state.arr);
}

function selectTerminal(kind, terminal) {
  if (kind === "dep") {
    state.dep = terminal;
    depInput.value = terminal.name;
    arrInput.disabled = false;
    arrInput.placeholder = "예: 강릉, 부산, 전주";
    depList.classList.remove("open");
    markQuickSelection("dep", terminal);
    setStatus(`${terminal.name} 출발지가 선택되었습니다.`);
    return;
  }

  state.arr = terminal;
  arrInput.value = terminal.name;
  arrList.classList.remove("open");
  markQuickSelection("arr", terminal);
  setStatus(`${terminal.name} 도착지가 선택되었습니다.`);
}

function swapTerminals() {
  const nextDep = state.arr;
  const nextArr = state.dep;
  state.dep = nextDep;
  state.arr = nextArr;
  syncTerminalFields();
  closeSuggestions();
  resetGeneratedPost();
  setStatus(state.dep && state.arr ? "출발지와 도착지를 바꿨습니다." : "출발지와 도착지를 바꾸려면 두 터미널을 먼저 선택해 주세요.", !state.dep || !state.arr);
}

function renderQuickTerminals(container, kind) {
  container.innerHTML = "";
  MAIN_TERMINALS.forEach((terminal) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-terminal";
    button.dataset.id = terminal.id;
    button.textContent = terminal.name;
    button.addEventListener("click", () => selectTerminal(kind, terminal));
    container.appendChild(button);
  });
}

function debounce(callback, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}

const searchDepartures = debounce(async () => {
  const keyword = depInput.value.trim();
  state.dep = null;
  state.arr = null;
  arrInput.value = "";
  markQuickSelection("dep", null);
  markQuickSelection("arr", null);

  if (keyword.length < 2) {
    depList.classList.remove("open");
    return;
  }

  try {
    setStatus("출발지 터미널을 찾고 있습니다.");
    const data = await apiGet(`/api/terminals?q=${encodeURIComponent(keyword)}`);
    renderSuggestions(depList, data.terminals, (item) => {
      selectTerminal("dep", item);
      arrInput.focus();
    });
  } catch (error) {
    setStatus(error.message, true);
  }
});

const searchArrivals = debounce(async () => {
  const keyword = arrInput.value.trim();
  state.arr = null;
  markQuickSelection("arr", null);

  if (!state.dep || keyword.length < 1) {
    arrList.classList.remove("open");
    return;
  }

  try {
    setStatus("도착지 터미널을 찾고 있습니다.");
    const data = await apiGet(
      `/api/destinations?depTerId=${encodeURIComponent(state.dep.id)}&q=${encodeURIComponent(keyword)}`
    );
    renderSuggestions(arrList, data.destinations, (item) => {
      selectTerminal("arr", item);
    });
  } catch (error) {
    setStatus(error.message, true);
  }
});

function makePlainText(result) {
  const rows = result.trips
    .map(
      (trip, index) =>
        `${index + 1}. ${trip.departTime} / ${trip.departTerminal} → ${trip.arriveTerminal} / ${trip.company} / ${trip.busGrade || "-"} / 일반 ${money(trip.adultFare)} / 중고생 ${money(trip.studentFare)} / 아동 ${money(trip.childFare)} / 약 ${trip.duration}`
    )
    .join("\n");

  return `${result.depName}에서 ${result.arrName} 가는 버스 시간표\n${prettyDate(result.date)} 기준\n\n${rows || "조회된 배차가 없습니다."}\n\n자료: 버스타고`;
}

function makePostHtml() {
  return blogPost.innerHTML.trim();
}

function routeStops(result) {
  const routes = result.trips.map((trip) => trip.route).filter(Boolean);

  for (const route of routes) {
    const parts = String(route)
      .split(/(?:->|→|>|,|\/|\||\s+-\s+|\s{2,})/)
      .map((item) => item.trim())
      .filter(Boolean);
    const stops = parts.filter((name) => name !== result.depName && name !== result.arrName);

    if (stops.length) return [...new Set(stops)].join(", ");
  }

  return "";
}

function renderBlogPost(result) {
  const stops = routeStops(result);
  const rows = result.trips
    .map(
      (trip) => `
        <tr>
          <td>${trip.departTime}</td>
          <td>${trip.departTerminal}</td>
          <td>${trip.arriveTerminal}</td>
          <td>${trip.company}</td>
          <td>${trip.busGrade || "-"}</td>
          <td>${money(trip.adultFare)}</td>
          <td>${money(trip.studentFare)}</td>
          <td>${money(trip.childFare)}</td>
          <td>${trip.duration}</td>
        </tr>`
    )
    .join("");

  blogPost.innerHTML = `
    <p class="post-kicker">대중교통 타고 여행하기</p>
    <h2 class="post-title">${result.depName}에서 ${result.arrName} 가는 버스 시간표</h2>
    <p class="post-meta">${prettyDate(result.date)} 버스타고 조회 기준</p>

    <div class="table-wrap">
      <table class="route-info-table">
        <tbody>
          <tr>
            <th>시간표 확인일</th>
            <td>${plainDate(result.date)}</td>
            <th>예매 사이트</th>
            <td><a href="https://www.bustago.or.kr/newweb/kr/index.do" target="_blank" rel="noopener">버스타고</a></td>
          </tr>
          <tr>
            <th>출발지</th>
            <td>${result.depName}</td>
            <th>도착지</th>
            <td>${result.arrName}</td>
          </tr>
          <tr>
            <th>주요 경유지</th>
            <td colspan="3">${stops}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>출발시간</th>
            <th>출발지</th>
            <th>도착지</th>
            <th>버스회사</th>
            <th>버스등급</th>
            <th>일반요금</th>
            <th>중고생요금</th>
            <th>아동요금</th>
            <th>예상소요시간</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="9">조회된 배차가 없습니다.</td></tr>`}
        </tbody>
      </table>
    </div>

    <p class="note">요금과 소요시간은 버스타고 조회 시점 기준이며, 운행사 및 도로 사정에 따라 달라질 수 있습니다.</p>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.dep || !state.arr || !dateInput.value) {
    setStatus("출발지와 도착지를 목록에서 선택하고 날짜를 입력해 주세요.", true);
    return;
  }

  try {
    setStatus("버스타고에서 운행 정보를 조회하고 있습니다.");
    const date = dateInput.value.replaceAll("-", "");
    const params = new URLSearchParams({
      depTerId: state.dep.id,
      arrTerId: state.arr.id,
      depName: state.dep.name,
      arrName: state.arr.name,
      date
    });
    const result = await apiGet(`/api/search?${params.toString()}`);
    state.lastResult = result;
    renderBlogPost(result);
    copyTextBtn.disabled = false;
    copyHtmlBtn.disabled = false;
    openNaverBtn.disabled = false;
    printBtn.disabled = false;
    setStatus(`${result.trips.length}건의 배차를 블로그용 표로 만들었습니다.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

depInput.addEventListener("input", searchDepartures);
arrInput.addEventListener("input", searchArrivals);
swapTerminalsBtn.addEventListener("click", swapTerminals);
renderQuickTerminals(depQuick, "dep");
renderQuickTerminals(arrQuick, "arr");
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-form")) closeSuggestions();
});

copyTextBtn.addEventListener("click", async () => {
  if (!state.lastResult) return;
  await navigator.clipboard.writeText(makePlainText(state.lastResult));
  setStatus("블로그 글 내용을 복사했습니다.");
});

copyHtmlBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(makePostHtml());
  setStatus("블로그용 HTML을 복사했습니다.");
});

openNaverBtn.addEventListener("click", async () => {
  if (!state.lastResult) return;
  await navigator.clipboard.writeText(makePostHtml());
  window.open("https://blog.naver.com/PostWriteForm.naver?blogId=tint4", "_blank", "noopener");
  setStatus("본문 HTML을 복사하고 네이버 블로그 글쓰기 창을 열었습니다.");
});


printBtn.addEventListener("click", () => window.print());
