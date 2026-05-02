const state = {
  dep: null,
  arr: null,
  lastResult: null
};

const depInput = document.querySelector("#depInput");
const arrInput = document.querySelector("#arrInput");
const dateInput = document.querySelector("#dateInput");
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
const naverTokenInput = document.querySelector("#naverTokenInput");
const naverCategoryInput = document.querySelector("#naverCategoryInput");
const publishNaverBtn = document.querySelector("#publishNaverBtn");

dateInput.valueAsDate = new Date();
naverTokenInput.value = localStorage.getItem("naverAccessToken") || "";
naverCategoryInput.value = localStorage.getItem("naverCategoryNo") || "";

const MAIN_TERMINALS = [
  { id: "0001", name: "동서울", area: "서울" },
  { id: "0004", name: "서울남부", area: "서울" },
  { id: "0002", name: "상봉", area: "서울" },
  { id: "0010", name: "김포공항", area: "서울" },
  { id: "0009", name: "잠실역", area: "서울" }
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

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "조회 중 오류가 발생했습니다.");
  return data;
}

async function apiPost(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청 중 오류가 발생했습니다.");
  return data;
}

function closeSuggestions() {
  depList.classList.remove("open");
  arrList.classList.remove("open");
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
    button.classList.toggle("selected", button.dataset.id === terminal.id);
  });
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
        `${index + 1}. ${trip.departTime} / ${trip.departTerminal} → ${trip.arriveTerminal} / ${trip.company} / 일반 ${money(trip.adultFare)} / 중고생 ${money(trip.studentFare)} / 아동 ${money(trip.childFare)} / 약 ${trip.duration}`
    )
    .join("\n");

  return `${result.depName}에서 ${result.arrName} 가는 버스 시간표\n${prettyDate(result.date)} 기준\n\n${rows || "조회된 배차가 없습니다."}\n\n자료: 버스타고`;
}

function makeBlogTitle(result) {
  return `${result.depName}에서 ${result.arrName} 가는 버스 시간표`;
}

function makePostHtml() {
  return blogPost.innerHTML.trim();
}

function renderBlogPost(result) {
  const firstTrip = result.trips[0];
  const rows = result.trips
    .map(
      (trip) => `
        <tr>
          <td>${trip.departTime}</td>
          <td>${trip.departTerminal}</td>
          <td>${trip.arriveTerminal}</td>
          <td>${trip.company}</td>
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

    <div class="summary-box">
      <div class="summary-item"><strong>노선</strong><span>${result.depName} → ${result.arrName}</span></div>
      <div class="summary-item"><strong>첫차</strong><span>${firstTrip ? firstTrip.departTime : "-"}</span></div>
      <div class="summary-item"><strong>배차</strong><span>${result.trips.length}건</span></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>출발시간</th>
            <th>출발지</th>
            <th>도착지</th>
            <th>버스회사</th>
            <th>일반요금</th>
            <th>중고생요금</th>
            <th>아동요금</th>
            <th>예상소요시간</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="8">조회된 배차가 없습니다.</td></tr>`}
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
    publishNaverBtn.disabled = false;
    setStatus(`${result.trips.length}건의 배차를 블로그용 표로 만들었습니다.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

depInput.addEventListener("input", searchDepartures);
arrInput.addEventListener("input", searchArrivals);
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

publishNaverBtn.addEventListener("click", async () => {
  if (!state.lastResult) return;

  const accessToken = naverTokenInput.value.trim();
  const categoryNo = naverCategoryInput.value.trim();
  localStorage.setItem("naverAccessToken", accessToken);
  localStorage.setItem("naverCategoryNo", categoryNo);

  try {
    publishNaverBtn.disabled = true;
    setStatus("네이버 블로그에 자동 게시를 시도하고 있습니다.");
    const data = await apiPost("/api/naver/post", {
      accessToken,
      categoryNo,
      title: makeBlogTitle(state.lastResult),
      contents: makePostHtml()
    });
    const result = data.message && data.message.result ? data.message.result : data;
    const postUrl = result.postUrl || result.url || "";
    setStatus(postUrl ? `자동 게시가 완료되었습니다: ${postUrl}` : "자동 게시가 완료되었습니다.");
    if (postUrl) window.open(postUrl, "_blank", "noopener");
  } catch (error) {
    setStatus(`${error.message} 글쓰기 창으로 붙여넣기할 수 있게 HTML은 복사해 둘게요.`, true);
    await navigator.clipboard.writeText(makePostHtml());
  } finally {
    publishNaverBtn.disabled = false;
  }
});

printBtn.addEventListener("click", () => window.print());
