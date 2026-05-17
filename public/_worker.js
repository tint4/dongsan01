const BUSTAGO_ORIGIN = "https://www.bustago.or.kr";
const TMONEY_INTERCITY_ORIGIN = "https://txbus.t-money.co.kr";
const KOBUS_ORIGIN = "https://www.kobus.co.kr";
const TAGO_EXP_BUS_ORIGIN = "https://apis.data.go.kr/1613000/ExpBusInfo";
const GUMVIT_ORIGIN = "https://www.gumvit.com";
const BUSPIA_ORIGIN = "https://www.buspia.co.kr";
const NEWSMILE_ORIGIN = "http://www.newsmilebus.com";
const GWANGJU_BUS_ORIGIN = "https://bus.gwangju.go.kr";
const JEJU_BUS_ORIGIN = "https://bus.jeju.go.kr";
const BUSAN_BUS_ORIGIN = "https://bus.busan.go.kr";
const INCHEON_BUS_ORIGIN = "https://bus.incheon.go.kr";
const ULSAN_BUS_ORIGIN = "https://its.ulsan.kr";
const AIRPORT_LIMOUSINE_ORIGIN = "https://airportlimousine.co.kr";
const SEOUL_AIRBUS_ORIGIN = "https://www.seoulairbus.com";
const CALT_ORIGIN = "https://www.calt.co.kr";
const KLIMOUSINE_ORIGIN = "https://klimousine.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "kheotay24!";
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const Buffer = { from(value) { return value; } };
const path = { extname(value) { const clean = String(value || "").split(/[?#]/)[0]; const index = clean.lastIndexOf("."); return index >= 0 ? clean.slice(index) : ""; } };
let kobusRouteCache = null;
const adminSessions = globalThis.__adminSessions || (globalThis.__adminSessions = new Map());
const communityUsers = globalThis.__communityUsers || (globalThis.__communityUsers = []);
const communityRankings = globalThis.__communityRankings || (globalThis.__communityRankings = []);
const communityBreadSubcategories = [
  "단팥빵",
  "바게트",
  "베이글",
  "빵 오 쇼콜라",
  "브리오슈",
  "소금빵",
  "소보로",
  "앙버터",
  "치아바타",
  "카스테라",
  "크루아상",
  "크림빵",
  "호밀빵",
  "햄버거"
];
const communityPosts = globalThis.__communityPosts || (globalThis.__communityPosts = createCommunitySeedPosts());

function compactCookie(headers) {
  const raw = headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function bustagoFetch(endpoint, params = {}) {
  const entry = await fetch(`${BUSTAGO_ORIGIN}/newweb/kr/ticket/ticket.do`, {
    headers: { "user-agent": USER_AGENT }
  });
  const cookie = compactCookie(entry.headers);
  const body = new URLSearchParams(params);

  const response = await fetch(`${BUSTAGO_ORIGIN}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
      referer: `${BUSTAGO_ORIGIN}/newweb/kr/ticket/ticket.do`,
      cookie
    },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`버스타고 응답 오류 ${response.status}: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text.trim());
  } catch (error) {
    throw new Error(`버스타고 응답을 해석할 수 없습니다: ${text.slice(0, 200)}`);
  }
}

async function postForm(origin, endpoint, params = {}, referer = "/") {
  const response = await fetch(`${origin}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
      referer: `${origin}${referer}`
    },
    body: new URLSearchParams(params)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${origin} 응답 오류 ${response.status}: ${text.slice(0, 200)}`);
  return text;
}

function htmlText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#40;/g, "(")
    .replace(/&#41;/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTerminal(item) {
  return {
    id: item.TERMINAL_ID,
    name: item.TERMINAL_NM,
    area: item.TERMINAL_AREA,
    orderDays: Number(item.BUS_ORDER_CREATE_DAYS || 0),
    roundTicketCode: item.ROUND_TICKET_CD
  };
}

function terminalMatches(item, keyword) {
  const value = `${item.TERMINAL_NM || ""} ${item.TERMINAL_AREA || ""}`.toLowerCase();
  return value.includes(keyword.toLowerCase());
}

function formatTime(value) {
  if (!value || value.length < 4) return value || "";
  return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
}

function formatDuration(minutes) {
  const total = Number(minutes || 0);
  if (!total) return "확인 필요";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins}분`;
  return mins ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

function formatRouteType(item) {
  const busType = item.BUS_TYPE_NM || "";
  const routeType = Number(item.STATION_TOT_CNT || 0) <= 2 ? "직통" : "경유";
  return `${busType}(${routeType})`;
}

function normalizeTrip(item, depName, arrName) {
  return {
    departTime: formatTime(item.DEP_TIME),
    departTerminal: depName,
    arriveTerminal: arrName,
    company: item.TRANSP_BIZR_ABBR_NM || "",
    busGrade: formatRouteType(item),
    adultFare: Number(item.FARE0 || 0),
    studentFare: Number(item.FARE2 || 0),
    childFare: Number(item.FARE3 || 0),
    duration: formatDuration(item.DIST_TIME),
    durationMinutes: Number(item.DIST_TIME || 0),
    route: item.ROUTE_DATA || "",
    seatsTotal: item.TOT_SEAT_CNT || "",
    seatsRemain: item.REMAIN_CNT || "",
    raw: item
  };
}

function normalizeTmoneyTerminal(item) {
  return {
    id: item.trml_Cd,
    name: item.trml_Nm,
    area: item.cty_Bus_Area_Nm || item.cty_Bus_Area_Cd || ""
  };
}

function encodeDataGoKrServiceKey(serviceKey) {
  const key = String(serviceKey || "").trim();
  return key.includes("%") ? key : encodeURIComponent(key);
}

async function fetchDataGoKrJson(origin, endpoint, serviceKey, params = {}) {
  const query = new URLSearchParams({ ...params, _type: "json" });
  const url = `${origin}${endpoint}?serviceKey=${encodeDataGoKrServiceKey(serviceKey)}&${query.toString()}`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  const text = await response.text();
  if (!response.ok) throw new Error(`공공데이터 API 응답 오류 ${response.status}: ${text.slice(0, 200)}`);
  try {
    const data = JSON.parse(text);
    const header = data?.response?.header;
    if (header && header.resultCode && header.resultCode !== "00") {
      throw new Error(header.resultMsg || `공공데이터 API 오류 ${header.resultCode}`);
    }
    return data;
  } catch (error) {
    if (error.message && !error.message.includes("Unexpected")) throw error;
    throw new Error(`공공데이터 API 응답을 해석할 수 없습니다: ${htmlText(text).slice(0, 200)}`);
  }
}

function getDataGoKrServiceKey(req) {
  return String(req.env?.DATA_GO_KR_SERVICE_KEY || req.searchParams.get("serviceKey") || "").trim();
}

function toTagoExpressTerminalId(value) {
  const id = String(value || "").trim();
  if (!id) return "";
  return id.startsWith("NAEK") ? id : `NAEK${id.padStart(3, "0")}`;
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatTagoDateTime(value) {
  const raw = String(value || "").replace(/\D/g, "");
  if (raw.length < 12) return "";
  return `${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
}

function formatTagoDuration(depValue, arrValue) {
  const dep = String(depValue || "").replace(/\D/g, "");
  const arr = String(arrValue || "").replace(/\D/g, "");
  if (dep.length < 12 || arr.length < 12) return "-";
  const depDate = new Date(`${dep.slice(0, 4)}-${dep.slice(4, 6)}-${dep.slice(6, 8)}T${dep.slice(8, 10)}:${dep.slice(10, 12)}:00+09:00`);
  const arrDate = new Date(`${arr.slice(0, 4)}-${arr.slice(4, 6)}-${arr.slice(6, 8)}T${arr.slice(8, 10)}:${arr.slice(10, 12)}:00+09:00`);
  const minutes = Math.round((arrDate - depDate) / 60000);
  return minutes > 0 ? formatDuration(minutes) : "-";
}

function normalizeKobusApiTrip(item, depName, arrName) {
  const depPlandTime = item.depPlandTime || item.depplandtime || "";
  const arrPlandTime = item.arrPlandTime || item.arrplandtime || "";
  return {
    departTime: formatTagoDateTime(depPlandTime),
    departTerminal: item.depPlaceNm || item.depplacenm || depName,
    arriveTerminal: item.arrPlaceNm || item.arrplacenm || arrName,
    company: item.companyNm || item.comName || item.transitNm || "고속버스",
    busGrade: item.gradeNm || item.gradenm || item.busGradeNm || "",
    adultFare: Number(item.charge || item.adultCharge || item.fare || 0),
    studentFare: Number(item.studentCharge || 0),
    childFare: Number(item.childCharge || 0),
    duration: formatTagoDuration(depPlandTime, arrPlandTime),
    route: item.routeId || item.routeid || "",
    raw: item
  };
}

async function fetchGumvitPage(pathname, params = {}) {
  const url = new URL(pathname, GUMVIT_ORIGIN);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  const text = await response.text();
  if (!response.ok) throw new Error(`검빛 응답 오류 ${response.status}: ${text.slice(0, 200)}`);
  return text;
}

function parseGumvitRaceLinks(html, loc, type) {
  const seen = new Set();
  return [...html.matchAll(/chulma_detail\.html\?([^"']*race_no=(\d+)[^"']*)/g)]
    .map((match) => {
      const params = new URLSearchParams(match[1].replace(/&amp;/g, "&"));
      const raceNo = Number(params.get("race_no") || match[2]);
      const date = params.get("m_date") || "";
      const key = `${date}-${raceNo}`;
      if (!raceNo || seen.has(key)) return null;
      seen.add(key);
      return { raceNo, date, loc, type };
    })
    .filter(Boolean)
    .sort((a, b) => a.raceNo - b.raceNo);
}

function parseGumvitDetail(html, raceNo) {
  const scoreWeights = [3, 1, 1, 0, 2];
  const horseMeta = new Map();
  const entrySection = (html.match(/<td[^>]*>\s*마번\s*<\/td>[\s\S]*?<td[^>]*>\s*조교\s*<\/td>[\s\S]*?<\/table>/) || [])[0] || "";
  [...entrySection.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1].replace(/<!--[\s\S]*?-->/g, ""))
    .filter((row) => /goHorse\(/.test(row))
    .forEach((row) => {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => htmlText(match[1]));
      const horseName = htmlText((row.match(/goHorse\([^)]*\)[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || cells[2] || "");
      const jockeyName = htmlText((row.match(/goJockey\([^)]*\)[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || cells[8] || "");
      const cycleText = cells.find((cell) => /\d+\s*주/.test(cell)) || "";
      const cycleWeeks = Number((cycleText.match(/\d+/) || [])[0] || 0);
      if (horseName) horseMeta.set(horseName, { jockeyName, cycleWeeks });
    });

  const section = (html.match(/검빛전문위원[\s\S]*?<\/table>/) || [])[0] || "";
  const rows = [...section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .filter((row) => /goHorse\(/.test(row));

  const horses = rows.map((row) => {
    const cleanRow = row.replace(/<!--[\s\S]*?-->/g, "");
    const cells = [...cleanRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => htmlText(match[1]));
    const horseName = htmlText((cleanRow.match(/class=["']name["'][^>]*>([\s\S]*?)<\/a>/i) || [])[1] || cells[1] || "");
    const horseNo = Number(cells[0] || 0);
    const expertCounts = cells.slice(5, 10).map((value) => Number(String(value).replace(/\D/g, "")) || 0);
    const integratedCounts = cells.slice(11, 16).map((value) => Number(String(value).replace(/\D/g, "")) || 0);
    const score = scoreWeights.reduce((sum, weight, index) => {
      return sum + weight * ((expertCounts[index] || 0) + (integratedCounts[index] || 0));
    }, 0);
    const meta = horseMeta.get(horseName) || {};
    const notes = [];
    if (meta.cycleWeeks > 10) notes.push("10주이상");
    if ((expertCounts[4] || 0) + (integratedCounts[4] || 0) >= 5) notes.push("복병");
    return {
      horseNo,
      horseName,
      jockeyName: meta.jockeyName || "",
      cycleWeeks: meta.cycleWeeks || 0,
      note: notes.join(", "),
      expertCounts,
      integratedCounts,
      score
    };
  }).filter((horse) => horse.horseName);

  const ranked = horses
    .sort((a, b) => b.score - a.score || a.horseNo - b.horseNo)
    .map((horse, index) => ({
      ...horse,
      rank: index + 1,
      grade: index < 4 ? "A" : index < 8 ? "B" : "C"
    }));

  return { raceNo, horses: ranked };
}

async function handleGumvitScores(req, res) {
  try {
    const loc = String(req.searchParams.get("loc") || "S").trim().toUpperCase();
    const type = String(req.searchParams.get("type") || "6").replace(/\D/g, "") || "6";
    const listHtml = await fetchGumvitPage("/statv40/chulma.html", { type, loc });
    const races = parseGumvitRaceLinks(listHtml, loc, type);
    if (!races.length) return sendJson(res, 404, { error: "검빛 출마표 경주 목록을 찾지 못했습니다." });

    const results = await Promise.all(races.map(async (race) => {
      const detailHtml = await fetchGumvitPage("/statv40/chulma_detail.html", {
        m_date: race.date,
        race_no: race.raceNo,
        type,
        loc
      });
      return { ...race, ...parseGumvitDetail(detailHtml, race.raceNo) };
    }));

    sendJson(res, 200, {
      source: "검빛",
      officialUrl: `${GUMVIT_ORIGIN}/statv40/chulma.html?type=${encodeURIComponent(type)}&loc=${encodeURIComponent(loc)}`,
      loc,
      type,
      searchedAt: new Date().toISOString(),
      date: races[0].date || "",
      weights: { "★": 3, "◎": 1, "○": 1, "▲": 0, "※": 2 },
      races: results
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

function parseGumvitResultDays(html, loc) {
  const dayMap = new Map();
  for (const match of html.matchAll(/goView\('([0-9]{4}-[0-9]{2}-[0-9]{2})',\s*(\d+)\)/g)) {
    const date = match[1];
    const raceNo = Number(match[2] || 0);
    if (!raceNo) continue;
    if (!dayMap.has(date)) dayMap.set(date, new Set());
    dayMap.get(date).add(raceNo);
  }
  return [...dayMap.entries()]
    .map(([date, races]) => ({
      date,
      loc,
      races: [...races].sort((a, b) => a - b)
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function parseGumvitResultDetailTopThree(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => htmlText(cell[1])))
    .filter((cells) => cells.length >= 15 && /^\d+$/.test(cells[0] || "") && /^\d+$/.test(cells[2] || ""));

  return rows
    .map((cells) => ({
      rank: Number(cells[0]),
      horseNo: Number(cells[2]),
      horseName: cells[3] || ""
    }))
    .filter((item) => item.rank >= 1 && item.rank <= 3 && item.horseNo)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
}

function parseGumvitTrifectaPayout(html) {
  const text = htmlText(html);
  const matches = [...text.matchAll(/삼쌍승\s*:\s*(?:(?!합계).)*?([\d,]+(?:\.\d+)?)(?=\s|$)/g)];
  const match = matches[matches.length - 1];
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

async function handleGumvitResultDays(req, res) {
  try {
    const loc = String(req.searchParams.get("loc") || "S").trim().toUpperCase();
    const page = Math.max(1, Number(req.searchParams.get("page") || 1));
    const html = await fetchGumvitPage("/statv40/result.html", { loc, page });
    sendJson(res, 200, {
      source: "Gumvit",
      officialUrl: `${GUMVIT_ORIGIN}/statv40/result.html?loc=${encodeURIComponent(loc)}&page=${page}`,
      loc,
      page,
      days: parseGumvitResultDays(html, loc)
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleGumvitResultDate(req, res) {
  try {
    const loc = String(req.searchParams.get("loc") || "S").trim().toUpperCase();
    const date = String(req.searchParams.get("date") || "").trim();
    const races = String(req.searchParams.get("races") || "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Boolean)
      .slice(0, 20);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: "date is required." });
    if (!races.length) return sendJson(res, 400, { error: "races is required." });

    const results = await Promise.all(races.map(async (raceNo) => {
      const html = await fetchGumvitPage("/statv40/result_detail.html", { loc, racedate: date, race: raceNo });
      return {
        date,
        raceNo,
        topThree: parseGumvitResultDetailTopThree(html),
        trifectaPayout: parseGumvitTrifectaPayout(html)
      };
    }));

    sendJson(res, 200, {
      source: "Gumvit",
      officialUrl: `${GUMVIT_ORIGIN}/statv40/result.html?loc=${encodeURIComponent(loc)}`,
      loc,
      date,
      results
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

function absoluteBuspiaUrl(value) {
  if (!value) return "";
  return new URL(value, BUSPIA_ORIGIN).href;
}

function absoluteNewsmileUrl(value) {
  if (!value) return "";
  return new URL(value, NEWSMILE_ORIGIN).href;
}

function absoluteAirportLimousineUrl(value) {
  if (!value) return "";
  return new URL(value, AIRPORT_LIMOUSINE_ORIGIN).href;
}

function splitRouteTitle(value) {
  const parts = String(value || "")
    .split(/↔|<->|->|→|-|~/)
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    depName: parts[0] || "",
    arrName: parts.slice(1).join(" / ") || ""
  };
}

function parseBuspiaRoutes(html) {
  const routeBlocks = html.split(/<div\s+class="busLineTit">/).slice(1);
  return routeBlocks
    .map((block) => {
      const chunk = `<div class="busLineTit">${block}`;
      const routeNo = htmlText((chunk.match(/<span class="num">([\s\S]*?)<\/span>/) || [])[1]);
      const seq = (chunk.match(/AllService\('([^']+)'\)/) || [])[1] || "";
      const routeTitle = htmlText((chunk.match(/<span class="tit">([\s\S]*?)<\/span>/) || [])[1]);
      const companyText = htmlText((chunk.match(/<span class="telr">([\s\S]*?)<\/span>/) || [])[1]);
      const cells = [...chunk.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => htmlText(match[1]));
      const stopCandidates = cells
        .filter((cell) => cell && !["구분", "첫차", "막차"].includes(cell) && !/\d{1,2}:\d{2}/.test(cell) && !/☎/.test(cell));
      const titleParts = splitRouteTitle(routeTitle);
      const stops = [...new Set([titleParts.depName, ...stopCandidates, titleParts.arrName].filter(Boolean))].slice(0, 5);

      return {
        routeNo,
        seq,
        routeTitle,
        depName: titleParts.depName,
        arrName: titleParts.arrName,
        company: companyText,
        stops,
        timePageUrl: seq ? `${BUSPIA_ORIGIN}/subpage/bus/air_allTimePop.php?seq=${encodeURIComponent(seq)}` : "",
        sourceUrl: `${BUSPIA_ORIGIN}/subpage/bus/air_info.php`
      };
    })
    .filter((route) => route.routeNo && route.seq);
}

async function fetchBuspiaRoutes() {
  const response = await fetch(`${BUSPIA_ORIGIN}/subpage/bus/air_info.php`, {
    headers: { "user-agent": USER_AGENT }
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`버스피아 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return parseBuspiaRoutes(html);
}

async function getBuspiaTimeImage(seq) {
  const response = await fetch(`${BUSPIA_ORIGIN}/subpage/bus/air_allTimePop.php?seq=${encodeURIComponent(seq)}`, {
    headers: { "user-agent": USER_AGENT }
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`버스피아 운행시간 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  const imageSrc = (html.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || "";
  if (!imageSrc) throw new Error("운행시간 이미지 주소를 찾지 못했습니다.");
  return absoluteBuspiaUrl(imageSrc);
}

async function fetchNewsmileHtml(pathname, encoding = "utf-8") {
  const response = await fetch(`${NEWSMILE_ORIGIN}${pathname}`, {
    headers: { "user-agent": USER_AGENT, referer: `${NEWSMILE_ORIGIN}/sub01.asp` }
  });
  const buffer = await response.arrayBuffer();
  const html = new TextDecoder(encoding).decode(buffer);
  if (!response.ok) throw new Error(`새천년미소 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return html;
}

function parseNewsmileSearchRoutes(html) {
  const tables = [...html.matchAll(/<table[^>]*width="672"[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  return tables
    .map((table) => {
      const cells = [...table.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => htmlText(match[1]));
      const idx = (table.match(/bus\.asp\?idx=(\d+)/i) || [])[1] || "";
      return {
        routeTitle: cells[0] || "",
        routeNo: cells[1] || "",
        depName: cells[2] || "",
        arrName: cells[3] || "",
        firstTime: cells[4] || "",
        lastTime: cells[5] || "",
        returnDepName: cells[6] || "",
        returnArrName: cells[7] || "",
        returnFirstTime: cells[8] || "",
        returnLastTime: cells[9] || "",
        idx,
        company: "경주 새천년미소",
        sourceUrl: `${NEWSMILE_ORIGIN}/sub01/bus.asp?idx=${idx}`
      };
    })
    .filter((route) => route.routeNo && route.idx);
}

async function fetchNewsmileRoutes(keyword, limit = 20) {
  const params = /^\d/.test(keyword)
    ? new URLSearchParams({ ekeyword: keyword, keyword: "" })
    : new URLSearchParams({ ekeyword: "", keyword });
  const html = await fetchNewsmileHtml(`/sub01/05_01_new.asp?${params.toString()}`);
  return parseNewsmileSearchRoutes(html).slice(0, limit);
}

function parseNewsmileDetail(html, route) {
  const imageSources = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((src) => /\/prg_guma\/nosun_list\/data/i.test(src));
  const imageUrl = absoluteNewsmileUrl(imageSources.find((src) => /\/data\//i.test(src)) || imageSources[0] || "");
  const routeImageUrl = absoluteNewsmileUrl(imageSources.find((src) => /\/data2\//i.test(src)) || "");
  const stopNames = [...html.matchAll(/<td[^>]*height="17"[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((match) => htmlText(match[1]).replace(/\s*-\s*$/, "").trim())
    .filter((name) => name && !/km|\d/.test(name));
  const stops = [...new Set([route.depName, ...stopNames, route.arrName].filter(Boolean))].slice(0, 7);
  return {
    ...route,
    stops,
    imageUrl,
    routeImageUrl,
    downloadUrl: `/api/newsmile/download?idx=${encodeURIComponent(route.idx)}&routeNo=${encodeURIComponent(route.routeNo)}&kind=time`,
    routeDownloadUrl: routeImageUrl ? `/api/newsmile/download?idx=${encodeURIComponent(route.idx)}&routeNo=${encodeURIComponent(route.routeNo)}&kind=route` : ""
  };
}

async function getNewsmileRouteWithImage(route) {
  const detailHtml = await fetchNewsmileHtml(`/sub01/bus.asp?idx=${encodeURIComponent(route.idx)}`, "euc-kr");
  return parseNewsmileDetail(detailHtml, route);
}

async function gwangjuPost(pathname, params = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${GWANGJU_BUS_ORIGIN}${pathname}`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "user-agent": USER_AGENT,
          "x-requested-with": "XMLHttpRequest",
          referer: `${GWANGJU_BUS_ORIGIN}/busmap/lineSearch`
        },
        body: new URLSearchParams(params)
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`광주버스 응답 오류 ${response.status}: ${text.slice(0, 200)}`);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw new Error(`광주버스 응답 오류: ${lastError?.message || "알 수 없는 오류"}`);
}

async function gwangjuGet(pathname, params = {}) {
  const url = new URL(pathname, GWANGJU_BUS_ORIGIN);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          referer: `${GWANGJU_BUS_ORIGIN}/busmap/lineSearch`
        }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`광주버스 응답 오류 ${response.status}: ${text.slice(0, 200)}`);
      return text;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw new Error(`광주버스 응답 오류: ${lastError?.message || "알 수 없는 오류"}`);
}

function normalizeGwangjuRoute(item) {
  const kindMap = {
    1: "급행간선",
    2: "간선",
    3: "지선",
    4: "마을버스",
    5: "공항버스"
  };
  return {
    lineId: String(item.LINE_ID || ""),
    routeNo: String(item.LINE_NAME || ""),
    busType: kindMap[Number(item.LINE_KIND)] || "일반",
    lineKind: String(item.LINE_KIND || ""),
    depName: String(item.DIR_DOWN_NAME || ""),
    arrName: String(item.DIR_UP_NAME || ""),
    routeTitle: `${item.DIR_DOWN_NAME || ""} - ${item.DIR_UP_NAME || ""}`.replace(/^\s*-\s*|\s*-\s*$/g, ""),
    sourceUrl: `${GWANGJU_BUS_ORIGIN}/busmap/lineSearch`
  };
}

function parseGwangjuTimetable(html) {
  const headerItems = [...html.matchAll(/<li[^>]+class=['"]li_hd_[0-3]['"][^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => htmlText(match[1]));
  const groups = [...html.matchAll(/<ul>\s*([\s\S]*?<li[^>]+class=['"]li_hd1_3['"][\s\S]*?<\/li>)\s*<\/ul>/gi)];
  const rows = groups
    .map((match) => [...match[1].matchAll(/<li[^>]+class=['"]li_hd1_[0-3]['"][^>]*>([\s\S]*?)<\/li>/gi)].map((cell) => htmlText(cell[1])))
    .filter((cells) => cells.length >= 4)
    .map((cells) => ({
      upTime: cells[0] || "",
      upNote: cells[1] || "",
      downTime: cells[2] || "",
      downNote: cells[3] || ""
    }))
    .filter((row) => row.upTime || row.downTime);
  return {
    title: htmlText((html.match(/운행시간표[^<]*/i) || [])[0] || "운행시간표"),
    upName: headerItems[0] || "기점",
    upNoteHeader: headerItems[1] || "기점비고",
    downName: headerItems[2] || "종점",
    downNoteHeader: headerItems[3] || "종점비고",
    rows
  };
}

async function fetchGwangjuRoute(keyword, limit = 20) {
  const search = await gwangjuPost("/busmap/lineSearchListTemp2?auth=null", {
    LINE_NAME: keyword,
    LINE_KIND: ""
  });
  const routes = (search.list || []).map(normalizeGwangjuRoute).slice(0, limit);
  const enriched = [];
  for (const route of routes) {
    try {
      const baseParams = { LINE_ID: route.lineId, LINE_NAME: route.routeNo, LINE_KIND: route.lineKind };
      const [detailData, stationData, timetableHtml] = await Promise.all([
        gwangjuPost("/busmap/lineDetailTemp2", baseParams),
        gwangjuPost("/busmap/lineDetailStationListTemp2", baseParams),
        gwangjuGet("/busmap/busRunTimeTable", { LINE_ID: route.lineId })
      ]);
      const detail = detailData.detail || {};
      const stops = (stationData.list || [])
        .sort((a, b) => Number(a.SEQ || 0) - Number(b.SEQ || 0))
        .map((item) => String(item.BUSSTOP_NAME || "").trim())
        .filter(Boolean);
      enriched.push({
        ...route,
        depName: route.depName || stops[0] || "",
        arrName: route.arrName || stops[stops.length - 1] || "",
        company: detail.COMP_NAME || "광주광역시 버스",
        phone: detail.TEL_NO || "",
        firstTime: detail.FIRST_RUN_TIME || "",
        lastTime: detail.LAST_RUN_TIME || "",
        interval: detail.RUN_INTERVAL || "",
        duration: detail.RUN_TIME || "",
        remark: detail.REMK || "",
        stops: [...new Set(stops)].slice(0, 10),
        timetable: parseGwangjuTimetable(timetableHtml)
      });
    } catch (error) {
      enriched.push({ ...route, company: "광주광역시 버스", stops: [], timetable: { rows: [] }, imageError: error.message });
    }
  }
  return enriched;
}

function parseAirportLimousineRoutes(html) {
  const menu = (html.match(/<div class="path-menu">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/) || [])[1] || html;
  const matches = [...menu.matchAll(/<a href="[^"]*cat_no=(\d+)">([\s\S]*?)<\/a>/g)];
  const routes = new Map();
  matches.forEach((match) => {
    const catNo = match[1];
    const label = htmlText(match[2]);
    const busNo = (label.match(/\bN?\d{4}\b/i) || [])[0] || "";
    if (!busNo || routes.has(busNo)) return;
    routes.set(busNo, {
      busNo,
      baseCatNo: catNo,
      label,
      sourceUrl: `${AIRPORT_LIMOUSINE_ORIGIN}/sub/sub01.php?cat_no=${encodeURIComponent(catNo)}`
    });
  });
  return [...routes.values()];
}

function parseAirportLimousineDirections(html) {
  const direction = (html.match(/<div class="direction">([\s\S]*?)<\/div>/) || [])[1] || "";
  const links = [...direction.matchAll(/<a href="[^"]*cat_no=(\d+)">([\s\S]*?)<\/a>/g)].map((match) => ({
    catNo: match[1],
    label: htmlText(match[2])
  }));
  return {
    airportCatNo: (links.find((link) => link.label.includes("공항")) || links[0] || {}).catNo || "",
    cityCatNo: (links.find((link) => link.label.includes("시내")) || links[1] || {}).catNo || ""
  };
}

function parseAirportLimousineStops(html) {
  const routeBlock = (html.match(/<div class="bus-route"[\s\S]*?<!-- mobile -->/) || [])[0] || html;
  const stops = [...routeBlock.matchAll(/go_zido\('([^']+)'[^)]*\)">\s*<span>([\s\S]*?)<\/span>/g)].map((match) => ({
    id: match[1],
    name: htmlText(match[2])
  }));
  return stops.filter((stop, index, array) => array.findIndex((item) => item.id === stop.id) === index);
}

function parseAirportLimousineFare(html) {
  const fareText = htmlText(((html.match(/<h4 class="col-tit ver3">요금<\/h4>\s*<div class="col ver3">([\s\S]*?)<\/div>/) || [])[1]) || "");
  return {
    adultFare: (fareText.match(/성인\s*:\s*([^/]+)/) || [])[1]?.trim() || "",
    childFare: (fareText.match(/어린이\s*:\s*([^/]+)/) || [])[1]?.trim() || ""
  };
}

function parseAirportLimousineTimes(html) {
  const spot = (html.match(/<div class="spot">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="col">/) || [])[1] || html;
  const stationName = htmlText((spot.match(/<div class="tit">([\s\S]*?)<\/div>/) || [])[1]);
  const times = [...spot.matchAll(/\b\d{1,2}:\d{2}\b/g)].map((match) => match[0]);
  return { stationName, times: [...new Set(times)] };
}

async function fetchAirportLimousinePage(catNo) {
  const response = await fetch(`${AIRPORT_LIMOUSINE_ORIGIN}/sub/sub01.php?cat_no=${encodeURIComponent(catNo)}`, {
    headers: { "user-agent": USER_AGENT }
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`공항리무진 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return html;
}

async function fetchAirportLimousineStationTime(stopId) {
  const response = await fetch(`${AIRPORT_LIMOUSINE_ORIGIN}/route/time_tables_ajax.php`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
      referer: `${AIRPORT_LIMOUSINE_ORIGIN}/sub/sub01.php`
    },
    body: new URLSearchParams({ idx: stopId })
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`공항리무진 시간표 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return html;
}

function buildAirportLimousineSchedule({ html, stop, arrName, company, adultFare, childFare }) {
  const parsedTimes = parseAirportLimousineTimes(html);
  const depName = parsedTimes.stationName || stop.name;
  return parsedTimes.times.map((time) => ({
    departTime: time,
    departTerminal: depName,
    arriveTerminal: arrName,
    company,
    adultFare,
    childFare
  }));
}

async function fetchSeoulAirbusPage(pathname = "/bus") {
  const response = await fetch(`${SEOUL_AIRBUS_ORIGIN}${pathname}`, {
    headers: { "user-agent": USER_AGENT }
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`서울공항리무진 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return html;
}

function parseSeoulAirbusRoutes(html) {
  const matches = [...html.matchAll(/<a href="(?:https?:\/\/www\.seoulairbus\.com)?\/bus\/([^"]+)"[^>]*>\s*<strong class="busNoF">([\s\S]*?)<\/strong>\s*<small>([\s\S]*?)<\/small>/g)];
  const routes = new Map();
  matches.forEach((match) => {
    const busNo = htmlText(match[2]);
    if (!busNo || routes.has(busNo)) return;
    routes.set(busNo, {
      busNo,
      label: `${busNo} ${htmlText(match[3])}`,
      sourceUrl: `${SEOUL_AIRBUS_ORIGIN}/bus/${encodeURIComponent(match[1])}`
    });
  });
  return [...routes.values()];
}

function parseSeoulAirbusRoutePage(html, busNo) {
  const summaryBlock = (html.match(/<span class="routeSummary">([\s\S]*?)<\/span>/) || [])[1] || "";
  const summary = [...summaryBlock.matchAll(/<strong>([\s\S]*?)<\/strong>/g)].map((match) => htmlText(match[1]));
  const fareText = htmlText((html.match(/<div class="item">\s*<h4>요금<\/h4>\s*<p>([\s\S]*?)<\/p>/) || [])[1] || "");
  const routeId = (html.match(/showTimeTableAll\(event,'([^']+)'/) || html.match(/\/timetableAll\/([^/]+)\//) || [])[1] || "";
  const stationMatches = [...html.matchAll(/<a href="\/timetable\/([^/]+)\/([^"]+)"[\s\S]*?<strong>([\s\S]*?)<\/strong>/g)];
  const stations = stationMatches.map((match) => ({
    routeId: match[1],
    id: match[2],
    name: htmlText(match[3])
  }));
  return {
    busNo,
    routeId,
    depName: summary[0] || stations[0]?.name || "",
    arrName: summary[1] || "인천국제공항 T1, T2",
    adultFare: (fareText.match(/([\d,]+원)/) || [])[1] || "",
    childFare: (fareText.match(/어린이\s*([\d,]+원)/) || [])[1] || "",
    stations: stations.filter((station, index, array) => array.findIndex((item) => item.id === station.id) === index)
  };
}

function parseSeoulAirbusWholeTimetable(html) {
  const table = (html.match(/<table class="table">([\s\S]*?)<\/table>/) || [])[1] || "";
  const headerRow = (table.match(/<thead>[\s\S]*?<tr>([\s\S]*?)<\/tr>/) || [])[1] || "";
  const headers = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((match) => htmlText(match[1]));
  const bodyRows = [...table.matchAll(/<tbody>[\s\S]*?<\/tbody>/g)][0]?.[0] || "";
  const rows = [...bodyRows.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) =>
    [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => htmlText(cell[1]))
  );
  return { headers, rows };
}

function buildSeoulAirbusSchedules({ headers, rows, company, adultFare, childFare, depName, arrName }) {
  const regularStationIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter((item) => item.index > 0 && item.header && !/도착|출발/.test(item.header));
  const firstStation = regularStationIndexes[0] || { header: depName, index: 1 };
  const lastStation = regularStationIndexes[regularStationIndexes.length - 1] || { header: depName, index: 1 };
  const t2Index = headers.findIndex((header) => /T2\s*출발/.test(header));
  const t1Index = headers.findIndex((header) => /T1\s*출발/.test(header));

  const toRows = (columnIndex, departTerminal, arriveTerminal) =>
    rows
      .map((row) => row[columnIndex])
      .filter(Boolean)
      .map((time) => ({
        departTime: time,
        departTerminal,
        arriveTerminal,
        company,
        adultFare,
        childFare
      }));

  return {
    airportDirection: toRows(firstStation.index, firstStation.header, arrName),
    cityDirectionT2: t2Index >= 0 ? toRows(t2Index, "인천공항 T2", lastStation.header) : [],
    cityDirectionT1: t1Index >= 0 ? toRows(t1Index, "인천공항 T1", lastStation.header) : []
  };
}

function parseSimpleTable(tableHtml) {
  const headerRow = (tableHtml.match(/<thead>[\s\S]*?<tr>([\s\S]*?)<\/tr>/) || [])[1] || "";
  const headers = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((match) => htmlText(match[1]));
  const body = (tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1] || "";
  const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) =>
    [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => htmlText(cell[1]))
  );
  return { headers, rows };
}

function rowsFromColumn({ headers, rows, columnIndex, departTerminal, arriveTerminal, company, adultFare, childFare }) {
  if (columnIndex < 0) return [];
  return rows
    .map((row) => row[columnIndex])
    .filter((time) => /^\d{1,2}:\d{2}$/.test(time))
    .map((time) => ({ departTime: time, departTerminal, arriveTerminal, company, adultFare, childFare }));
}

async function fetchCaltPage(pathname = "/limousine/01.php") {
  const response = await fetch(`${CALT_ORIGIN}${pathname}`, { headers: { "user-agent": USER_AGENT } });
  const html = await response.text();
  if (!response.ok) throw new Error(`한국도심공항 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return html;
}

function parseCaltRoutes(html) {
  const matches = [...html.matchAll(/<a href="(\/limousine\/[^"]+\.php)">(\d{4}(?:-\d)?)\s*\(([^<]+)\)<\/a>/g)];
  const routes = new Map();
  matches.forEach((match) => {
    const busNo = match[2];
    if (routes.has(busNo)) return;
    routes.set(busNo, {
      busNo,
      label: `${busNo} (${match[3]})`,
      path: match[1],
      sourceUrl: `${CALT_ORIGIN}${match[1]}`
    });
  });
  return [...routes.values()];
}

function parseCaltStops(html) {
  return [...html.matchAll(/map_show2?\([^)]*,'([^']+)','[^']+','([^']+)'[^)]*\);"><i><\/i><span>([\s\S]*?)<\/span>/g)]
    .map((match) => ({ name: htmlText(match[3]) || match[2] }))
    .filter((stop, index, array) => stop.name && array.findIndex((item) => item.name === stop.name) === index);
}

function parseCaltSchedules(html, company, depName, arrName, adultFare, childFare) {
  const timeTableBlock = (html.match(/<div id="timeTable"[\s\S]*?<\/section>/) || [html])[0];
  const tables = [...timeTableBlock.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)].map((match) => match[0]);
  const airportTable = tables[0] || "";
  const cityTable = tables[1] || "";
  const airport = parseSimpleTable(airportTable);
  const city = parseSimpleTable(cityTable);
  const firstCityCol = airport.headers.findIndex((header, index) => index > 0 && !/공항|T1|T2/.test(header));
  const t1Col = city.headers.findIndex((header) => /T1|1/.test(header));
  const t2Col = city.headers.findIndex((header) => /T2|2/.test(header));
  return {
    airportDirection: rowsFromColumn({ ...airport, columnIndex: firstCityCol, departTerminal: airport.headers[firstCityCol] || depName, arriveTerminal: arrName, company, adultFare, childFare }),
    cityDirectionT2: rowsFromColumn({ ...city, columnIndex: t2Col, departTerminal: "인천공항 T2", arriveTerminal: depName, company, adultFare, childFare }),
    cityDirectionT1: rowsFromColumn({ ...city, columnIndex: t1Col, departTerminal: "인천공항 T1", arriveTerminal: depName, company, adultFare, childFare })
  };
}

function parseKlimousineRoutes(html) {
  const matches = [...html.matchAll(/<a href="\/bus\/limousine\.php\?bus_no=([^"#]+)#inner">\s*<p class="num">([\s\S]*?)<\/p>\s*<p class="region">([\s\S]*?)<\/p>/g)];
  return matches.map((match) => ({
    busNo: htmlText(match[2]).replace(/\(.*?\)/g, ""),
    label: `${htmlText(match[2])} ${htmlText(match[3])}`,
    sourceUrl: `${KLIMOUSINE_ORIGIN}/bus/limousine.php?bus_no=${encodeURIComponent(match[1])}#inner`
  }));
}

async function fetchKlimousinePage(pathname = "/bus/limousine.php") {
  const response = await fetch(`${KLIMOUSINE_ORIGIN}${pathname}`, { headers: { "user-agent": USER_AGENT } });
  const html = await response.text();
  if (!response.ok) throw new Error(`K리무진 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return { html, cookie: (response.headers.get("set-cookie") || "").split(";")[0] };
}

function parseKlimousineRoutePage(html, busNo) {
  const fareText = htmlText((html.match(/<dt>탑승요금<\/dt>\s*<dd>([\s\S]*?)<\/dd>/) || [])[1] || "");
  const stops = [...html.matchAll(/station_Times\('([^']+)','([^']+)','([^']+)','([^']+)'\);[\s\S]*?<p class="course-name">([\s\S]*?)<\/p>/g)].map((match) => ({
    busNo: match[1],
    id: match[2],
    direction: match[3],
    no: match[4],
    name: htmlText(match[5])
  }));
  const incheonStops = stops.filter((stop) => stop.direction === "incheon");
  const seoulStops = stops.filter((stop) => stop.direction === "seoul");
  return {
    adultFare: (fareText.match(/성인\s*([\d,]+원)/) || [])[1] || "",
    childFare: (fareText.match(/소아\s*([\d,]+원)/) || [])[1] || "",
    depName: incheonStops[0]?.name || "",
    arrName: incheonStops[incheonStops.length - 1]?.name || "인천공항",
    stops,
    incheonStops,
    seoulStops,
    companyUrl: `${KLIMOUSINE_ORIGIN}/bus/limousine.php?bus_no=${encodeURIComponent(busNo)}#inner`
  };
}

async function fetchKlimousineStationTime({ busNo, stationId, direction, no, cookie }) {
  const response = await fetch(`${KLIMOUSINE_ORIGIN}/inc/ajax.php`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      "user-agent": USER_AGENT,
      referer: `${KLIMOUSINE_ORIGIN}/bus/limousine.php?bus_no=${encodeURIComponent(busNo)}`,
      cookie
    },
    body: new URLSearchParams({ mode: "find_station_TimesMode", bus_num: busNo, station_id: stationId, gbn: direction, no, LANG: "KOR" })
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`K리무진 시간표 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return html;
}

function parseHourMinuteSchedule(html, stop, arriveTerminal, company, adultFare, childFare) {
  const rows = [];
  [...html.matchAll(/<dl>\s*<dt>(\d{1,2})<\/dt>\s*<dd>([\s\S]*?)<\/dd>\s*<\/dl>/g)].forEach((match) => {
    const hour = match[1].padStart(2, "0");
    const minutes = [...match[2].matchAll(/\b\d{1,2}\b/g)].map((m) => m[0].padStart(2, "0"));
    minutes.forEach((minute) => rows.push({ departTime: `${hour}:${minute}`, departTerminal: stop.name, arriveTerminal, company, adultFare, childFare }));
  });
  return rows;
}

function parseCaltSchedulesClean(html, company, depName, arrName, adultFare, childFare) {
  const timeTableIndex = html.indexOf('id="timeTable"');
  const timeTableBlock = timeTableIndex >= 0 ? html.slice(timeTableIndex) : html;
  const tables = [...timeTableBlock.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)].map((match) => match[0]);
  const airport = parseSimpleTable(tables[0] || "");
  const city = parseSimpleTable(tables[1] || "");
  const firstCityCol = airport.headers.findIndex((header, index) => index > 0 && !/공항|T1|T2/.test(header));
  const t1Col = city.headers.findIndex((header) => /T1|1/.test(header));
  const t2Col = city.headers.findIndex((header) => /T2|2/.test(header));

  return {
    airportDirection: rowsFromColumn({
      ...airport,
      columnIndex: firstCityCol,
      departTerminal: airport.headers[firstCityCol] || depName,
      arriveTerminal: arrName,
      company,
      adultFare,
      childFare
    }),
    cityDirectionT2: rowsFromColumn({
      ...city,
      columnIndex: t2Col,
      departTerminal: "인천공항 T2",
      arriveTerminal: depName,
      company,
      adultFare,
      childFare
    }),
    cityDirectionT1: rowsFromColumn({
      ...city,
      columnIndex: t1Col,
      departTerminal: "인천공항 T1",
      arriveTerminal: depName,
      company,
      adultFare,
      childFare
    })
  };
}

function parseKlimousineRoutePageClean(html, busNo) {
  const fareText = htmlText((html.match(/<dt>\s*탑승요금\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/) || [])[1] || "");
  const stops = [...html.matchAll(/station_Times\('([^']+)','([^']+)','([^']+)','([^']+)'\);[\s\S]*?<p class="course-name">([\s\S]*?)<\/p>/g)].map((match) => ({
    busNo: match[1],
    id: match[2],
    direction: match[3],
    no: match[4],
    name: htmlText(match[5])
  }));
  const incheonStops = stops.filter((stop) => stop.direction === "incheon");
  const seoulStops = stops.filter((stop) => stop.direction === "seoul");

  return {
    adultFare: (fareText.match(/성인\s*([\d,]+원)/) || [])[1] || "",
    childFare: (fareText.match(/소아\s*([\d,]+원)/) || [])[1] || "",
    depName: incheonStops[0]?.name || "",
    arrName: incheonStops[incheonStops.length - 1]?.name || "인천공항",
    stops,
    incheonStops,
    seoulStops,
    companyUrl: `${KLIMOUSINE_ORIGIN}/bus/limousine.php?bus_no=${encodeURIComponent(busNo)}#inner`
  };
}

function schedulesDiffer(left = [], right = []) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function pickDifferentWeekendSchedules(weekday, weekend) {
  return {
    weekendAirportDirection: schedulesDiffer(weekday.airportDirection, weekend.airportDirection) ? weekend.airportDirection : [],
    weekendCityDirectionT2: schedulesDiffer(weekday.cityDirectionT2, weekend.cityDirectionT2) ? weekend.cityDirectionT2 : [],
    weekendCityDirectionT1: schedulesDiffer(weekday.cityDirectionT1, weekend.cityDirectionT1) ? weekend.cityDirectionT1 : []
  };
}

function parseTmoneyTrips(html, depName, arrName) {
  const rows = [...html.matchAll(/<tr>\s*<td><div class="td_wrap1">([\s\S]*?)<\/tr>/g)].map((match) => match[0]);
  return rows
    .map((row) => {
      const cells = [...row.matchAll(/<td[\s\S]*?<div class="td_wrap1">([\s\S]*?)<\/div>\s*<\/td>/g)].map((match) => match[1]);
      if (cells.length < 7) return null;
      const company = htmlText((cells[1].match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || cells[1]);
      const duration = (htmlText(cells[1]).match(/(\d+:\d+|\d+시간\s*\d*분?)\s*소요/) || [])[1] || "";
      const seats = htmlText(cells[6]).match(/(\d+)석.*?(\d+)석/);
      return {
        departTime: htmlText(cells[0]),
        departTerminal: depName,
        arriveTerminal: arrName,
        company,
        busGrade: htmlText(cells[2]),
        adultFare: Number(htmlText(cells[3]).replace(/\D/g, "")) || 0,
        childFare: Number(htmlText(cells[4]).replace(/\D/g, "")) || 0,
        studentFare: Number(htmlText(cells[5]).replace(/\D/g, "")) || 0,
        duration: duration || "-",
        seatsRemain: seats ? seats[1] : "",
        seatsTotal: seats ? seats[2] : "",
        route: ""
      };
    })
    .filter(Boolean);
}

async function getKobusRoutes() {
  if (kobusRouteCache) return kobusRouteCache;
  const text = await postForm(KOBUS_ORIGIN, "/mrs/readRotLinInf.ajax", {}, "/main.do");
  const data = JSON.parse(text);
  kobusRouteCache = data.rotInfList || [];
  return kobusRouteCache;
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    String(cookieHeader)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function randomToken() {
  const values = new Uint8Array(32);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function isAdminRequest(request) {
  const token = parseCookies(request.headers.get("cookie") || "")["admin-session"];
  const expiresAt = token ? adminSessions.get(token) : 0;
  if (!token || !expiresAt) return false;
  if (expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
  return true;
}

async function handleAdminLoginWorker(request, res) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    const password = String(body.password || "");
    if (userId !== ADMIN_ID || password !== ADMIN_PASSWORD) {
      return sendJson(res, 401, { ok: false, error: "관리자 아이디 또는 비밀번호가 올바르지 않습니다." });
    }
    const token = randomToken();
    adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
    return sendJson(res, 200, { ok: true }, {
      "set-cookie": `admin-session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function handleAdminLogoutWorker(request, res) {
  const token = parseCookies(request.headers.get("cookie") || "")["admin-session"];
  if (token) adminSessions.delete(token);
  return sendJson(res, 200, { ok: true }, {
    "set-cookie": "admin-session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
  });
}

async function handleAdminStatusWorker(request, res) {
  if (!isAdminRequest(request)) return sendJson(res, 200, { loggedIn: false });
  return sendJson(res, 200, {
    loggedIn: true,
    userId: ADMIN_ID,
    counts: {
      users: communityUsers.length,
      posts: communityPosts.length,
      comments: communityPosts.reduce((sum, post) => sum + (post.comments || []).length, 0)
    }
  });
}

function createCommunitySeedPosts() {
  return communityBreadSubcategories.map((name, index) => ({
    id: Date.now() - index,
    category: "빵류",
    subcategory: name,
    title: `${name} 이야기 모음`,
    body: `${name} 게시판입니다. 비회원도 글을 읽고 댓글을 남길 수 있습니다.`,
    author: "운영자",
    views: 12 + index * 3,
    comments: [{ id: Date.now() + index, name: "비회원", body: "첫 댓글입니다.", createdAt: new Date().toISOString() }],
    createdAt: new Date(Date.now() - index * 86400000).toISOString()
  }));
}

function normalizeCommunityUserId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

async function hashCommunityPasswordWorker(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function handleCommunitySignupWorker(request, res) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = normalizeCommunityUserId(body.userId);
    const displayName = String(body.displayName || body.userId || "").trim().slice(0, 20);
    const password = String(body.password || "");
    if (userId.length < 4) return sendJson(res, 400, { error: "아이디는 영문/숫자 4자 이상으로 입력해주세요." });
    if (password.length < 6) return sendJson(res, 400, { error: "비밀번호는 6자 이상으로 입력해주세요." });
    if (communityUsers.some((user) => user.userId === userId)) return sendJson(res, 409, { error: "이미 사용 중인 아이디입니다." });
    const salt = randomToken().slice(0, 32);
    const passwordHash = await hashCommunityPasswordWorker(password, salt);
    const user = { userId, displayName: displayName || userId, salt, passwordHash, createdAt: new Date().toISOString() };
    communityUsers.push(user);
    return sendJson(res, 200, { ok: true, user: { userId: user.userId, displayName: user.displayName } });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function handleCommunityLoginWorker(request, res) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = normalizeCommunityUserId(body.userId);
    const password = String(body.password || "");
    const user = communityUsers.find((item) => item.userId === userId);
    if (!user) return sendJson(res, 404, { code: "INVALID_ID", error: "아이디를 확인해주세요." });
    const passwordHash = await hashCommunityPasswordWorker(password, user.salt);
    if (passwordHash !== user.passwordHash) return sendJson(res, 401, { code: "INVALID_PASSWORD", error: "비밀번호를 다시 확인해주세요." });
    return sendJson(res, 200, { ok: true, user: { userId: user.userId, displayName: user.displayName } });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function handleCommunityPostsWorker(req, res) {
  const category = String(req.searchParams.get("category") || "").trim();
  const subcategory = String(req.searchParams.get("subcategory") || "").trim();
  const posts = communityPosts
    .filter((post) => !category || post.category === category)
    .filter((post) => !subcategory || post.subcategory === subcategory)
    .sort((a, b) => Number(b.id) - Number(a.id));
  return sendJson(res, 200, { posts });
}

async function handleCommunityPostWorker(req, res) {
  const id = Number(req.searchParams.get("id"));
  const post = communityPosts.find((item) => Number(item.id) === id);
  if (!post) return sendJson(res, 404, { error: "게시글을 찾을 수 없습니다." });
  post.views = Number(post.views || 0) + 1;
  return sendJson(res, 200, { post });
}

async function handleCommunityCreatePostWorker(request, res) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    const content = String(body.body || "").trim();
    const category = String(body.category || "").trim();
    const subcategory = String(body.subcategory || category).trim();
    if (!title || !content || !category || !subcategory) return sendJson(res, 400, { error: "게시글 제목과 내용을 입력해주세요." });
    const post = {
      id: Date.now(),
      category,
      subcategory,
      title: title.slice(0, 80),
      body: content,
      author: String(body.author || "회원").trim().slice(0, 20) || "회원",
      views: 0,
      comments: [],
      createdAt: new Date().toISOString()
    };
    communityPosts.push(post);
    return sendJson(res, 200, { ok: true, post });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function handleCommunityAddCommentWorker(request, res) {
  try {
    const body = await request.json().catch(() => ({}));
    const post = communityPosts.find((item) => Number(item.id) === Number(body.postId));
    const commentBody = String(body.body || "").trim();
    if (!post) return sendJson(res, 404, { error: "게시글을 찾을 수 없습니다." });
    if (!commentBody) return sendJson(res, 400, { error: "댓글 내용을 입력해주세요." });
    post.comments.push({
      id: Date.now(),
      name: String(body.name || "비회원").trim().slice(0, 20) || "비회원",
      body: commentBody,
      createdAt: new Date().toISOString()
    });
    return sendJson(res, 200, { ok: true, post });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

function sortCommunityRankingsWorker(items) {
  return items
    .slice()
    .sort((a, b) => b.totalScore - a.totalScore || b.voteCount - a.voteCount || a.shopName.localeCompare(b.shopName, "ko"))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function getKstWeekRangeWorker(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = today.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

function getSixMonthCutoffWorker(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 7, Number(parts.day)));
}

function buildCommunityRankingChartWorker(items, now = new Date()) {
  const cutoff = getSixMonthCutoffWorker(now);
  return items
    .map((item) => {
      const votes = Array.isArray(item.votes) ? item.votes : [];
      const activeVotes = votes.filter((vote) => new Date(vote.votedAt) >= cutoff);
      return {
        id: item.id,
        category: item.category,
        subcategory: item.subcategory,
        shopName: item.shopName,
        mapUrl: item.mapUrl || "",
        tasteScore: activeVotes.reduce((sum, vote) => sum + Number(vote.tasteScore ?? vote.score ?? 0), 0),
        priceScore: activeVotes.reduce((sum, vote) => sum + Number(vote.priceScore || 0), 0),
        totalScore: activeVotes.reduce((sum, vote) => {
          return sum + Number(vote.tasteScore ?? vote.score ?? 0) + Number(vote.priceScore || 0);
        }, 0),
        voteCount: activeVotes.length,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    })
    .filter((item) => item.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore || b.voteCount - a.voteCount || a.shopName.localeCompare(b.shopName, "ko"))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function normalizeNaverMapUrlWorker(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return "";
    const host = url.hostname.toLowerCase();
    if (!/(^|\.)naver\.com$|(^|\.)naver\.me$/.test(host)) return "";
    return url.href;
  } catch (error) {
    return "";
  }
}

function cleanNaverMapTitleWorker(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s*[:|-]?\s*네이버\s*지도\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

async function resolveNaverMapShopNameWorker(mapUrl) {
  const safeUrl = normalizeNaverMapUrlWorker(mapUrl);
  if (!safeUrl) return "";
  const fromUrl = (() => {
    try {
      const url = new URL(safeUrl);
      const match = decodeURIComponent(url.pathname).match(/\/search\/([^/?#]+)/);
      return match ? cleanNaverMapTitleWorker(match[1]) : "";
    } catch (error) {
      return "";
    }
  })();
  try {
    const response = await fetch(safeUrl, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
    const text = await response.text();
    const title = [
      (text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1],
      (text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]
    ].map(cleanNaverMapTitleWorker).filter(Boolean)[0];
    return title || fromUrl;
  } catch (error) {
    return fromUrl;
  }
}

async function handleCommunityRankingsWorker(req, res) {
  const category = String(req.searchParams.get("category") || "빵류").trim();
  const subcategory = String(req.searchParams.get("subcategory") || "단팥빵").trim();
  const rankings = buildCommunityRankingChartWorker(
    communityRankings.filter((item) => item.category === category && item.subcategory === subcategory)
  ).slice(0, 100);
  return sendJson(res, 200, { rankings });
}

async function handleCommunityRankingScoreWorker(request, res) {
  try {
    const body = await request.json().catch(() => ({}));
    const category = String(body.category || "빵류").trim();
    const subcategory = String(body.subcategory || "단팥빵").trim();
    let shopName = String(body.shopName || "").trim().slice(0, 60);
    const mapUrl = normalizeNaverMapUrlWorker(body.mapUrl || "");
    const tasteScore = Number(body.tasteScore || 0);
    const priceScore = Number(body.priceScore || 0);
    const voterId = normalizeCommunityUserId(body.userId);
    if (!category || !subcategory) return sendJson(res, 400, { error: "분류를 확인해주세요." });
    if (!voterId) return sendJson(res, 401, { error: "로그인한 회원만 투표할 수 있습니다." });
    if (!shopName && mapUrl) shopName = await resolveNaverMapShopNameWorker(mapUrl);
    if (!shopName) return sendJson(res, 400, { error: "상점명을 입력하거나 네이버 지도 URL을 입력해주세요." });
    if (!Number.isInteger(tasteScore) || tasteScore < 1 || tasteScore > 10) return sendJson(res, 400, { error: "맛 점수는 1점부터 10점까지 입력해주세요." });
    if (!Number.isInteger(priceScore) || priceScore < 1 || priceScore > 10) return sendJson(res, 400, { error: "가격 점수는 1점부터 10점까지 입력해주세요." });

    const { start, end } = getKstWeekRangeWorker();
    const normalizedName = shopName.replace(/\s+/g, "").toLowerCase();
    const weeklyVotes = communityRankings
      .filter((item) => item.category === category && item.subcategory === subcategory)
      .flatMap((item) => (item.votes || []).map((vote) => ({
        vote,
        shopKey: item.shopName.replace(/\s+/g, "").toLowerCase()
      })))
      .filter(({ vote }) => {
        const votedAt = new Date(vote.votedAt);
        return vote.userId === voterId && votedAt >= start && votedAt < end;
      });
    const existing = communityRankings.find((item) => (
      item.category === category &&
      item.subcategory === subcategory &&
      item.shopName.replace(/\s+/g, "").toLowerCase() === normalizedName
    ));
    if (weeklyVotes.some((item) => item.shopKey === normalizedName)) {
      if (existing && mapUrl && !existing.mapUrl) {
        existing.mapUrl = mapUrl;
        existing.updatedAt = new Date().toISOString();
        const rankings = buildCommunityRankingChartWorker(
          communityRankings.filter((item) => item.category === category && item.subcategory === subcategory)
        ).slice(0, 100);
        return sendJson(res, 200, { ok: true, mapOnly: true, rankings, message: "이미 점수를 준 상점이라 점수는 추가하지 않고 지도 URL만 저장했습니다." });
      }
      return sendJson(res, 409, { error: "이번 주에 이미 점수를 준 상점입니다. 같은 상점에는 다시 점수를 줄 수 없습니다." });
    }
    if (weeklyVotes.length >= 3) {
      if (existing && mapUrl && !existing.mapUrl) {
        existing.mapUrl = mapUrl;
        existing.updatedAt = new Date().toISOString();
        const rankings = buildCommunityRankingChartWorker(
          communityRankings.filter((item) => item.category === category && item.subcategory === subcategory)
        ).slice(0, 100);
        return sendJson(res, 200, { ok: true, mapOnly: true, rankings, message: "이번 주 투표 횟수는 초과되어 점수는 추가하지 않고 지도 URL만 저장했습니다." });
      }
      return sendJson(res, 409, { error: "이번 주에는 해당 소분류에 3번까지 점수를 줄 수 있습니다. 다음 주에 다시 투표해주세요." });
    }
    const now = new Date().toISOString();
    if (existing) {
      existing.votes = Array.isArray(existing.votes) ? existing.votes : [];
      existing.votes.push({ userId: voterId, tasteScore, priceScore, votedAt: now });
      if (mapUrl) existing.mapUrl = mapUrl;
      existing.updatedAt = now;
    } else {
      communityRankings.push({
        id: Date.now(),
        category,
        subcategory,
        shopName,
        mapUrl,
        votes: [{ userId: voterId, tasteScore, priceScore, votedAt: now }],
        createdAt: now,
        updatedAt: now
      });
    }
    const rankings = buildCommunityRankingChartWorker(
      communityRankings.filter((item) => item.category === category && item.subcategory === subcategory)
    ).slice(0, 100);
    return sendJson(res, 200, { ok: true, rankings });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function handleTerminals(req, res) {
  try {
    const keyword = String(req.searchParams.get("q") || "").trim();
    const includeAll = req.searchParams.get("all") === "1";
    if (!keyword && !includeAll) return sendJson(res, 200, { terminals: [] });

    const data = await bustagoFetch("/newweb/kr/common/terminalListAjax.do", {
      area: "",
      searchTerminalNm: keyword
    });
    const terminals = (data.terminalList || [])
      .filter((item) => includeAll || terminalMatches(item, keyword))
      .map(normalizeTerminal)
      .slice(0, includeAll ? 1000 : 30);

    sendJson(res, 200, { terminals });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleDestinations(req, res) {
  try {
    const depTerId = String(req.searchParams.get("depTerId") || "").trim();
    const keyword = String(req.searchParams.get("q") || "").trim();
    const includeAll = req.searchParams.get("all") === "1";
    if (!depTerId) return sendJson(res, 400, { error: "출발지 터미널 코드가 필요합니다." });

    const data = await bustagoFetch("/newweb/kr/common/terminalEndListAjax.do", {
      area: "",
      country: "",
      terCode: depTerId
    });
    const destinations = (data.terminalEndList || [])
      .filter((item) => !keyword || terminalMatches(item, keyword))
      .map(normalizeTerminal)
      .slice(0, includeAll ? 1000 : 50);

    sendJson(res, 200, { destinations });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleSearch(req, res) {
  try {
    const depTerId = String(req.searchParams.get("depTerId") || "").trim();
    const arrTerId = String(req.searchParams.get("arrTerId") || "").trim();
    const date = String(req.searchParams.get("date") || "").replace(/\D/g, "");
    const depName = String(req.searchParams.get("depName") || "");
    const arrName = String(req.searchParams.get("arrName") || "");

    if (!depTerId || !arrTerId || !/^\d{8}$/.test(date)) {
      return sendJson(res, 400, { error: "출발지, 도착지, 날짜를 모두 선택해 주세요." });
    }

    const data = await bustagoFetch("/newweb/kr/ticket/ticketListJson3.do", {
      startType: "S",
      orderDate: date,
      orderBackDate: date,
      depTerId,
      arrTerId,
      depTime: "00:00",
      arrTime: "00:00",
      goBusGrade: "",
      goBackBusGrade: ""
    });

    const trips = (data.ticketSingleList || []).map((item) => normalizeTrip(item, depName, arrName));
    sendJson(res, 200, {
      source: "버스타고",
      searchedAt: new Date().toISOString(),
      date,
      depTerId,
      arrTerId,
      depName,
      arrName,
      trips
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleTmoneyIntercityTerminals(req, res) {
  try {
    const keyword = String(req.searchParams.get("q") || "").trim();
    const includeAll = req.searchParams.get("all") === "1";
    if (!keyword && !includeAll) return sendJson(res, 200, { terminals: [] });
    const text = await postForm(
      TMONEY_INTERCITY_ORIGIN,
      "/otck/readTrmlList.do",
      { cty_Bus_Area_Cd: "", trml_Nm: keyword, pre_Trml_Cd: "", rtnGbn: "01" },
      "/main.do"
    );
    const data = JSON.parse(text);
    sendJson(res, 200, { terminals: data.map(normalizeTmoneyTerminal).slice(0, includeAll ? 1000 : 30) });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleTmoneyIntercityDestinations(req, res) {
  try {
    const depTerId = String(req.searchParams.get("depTerId") || "").trim();
    const keyword = String(req.searchParams.get("q") || "").trim();
    const includeAll = req.searchParams.get("all") === "1";
    if (!depTerId) return sendJson(res, 400, { error: "출발지 터미널 코드가 필요합니다." });
    const text = await postForm(
      TMONEY_INTERCITY_ORIGIN,
      "/otck/readTrmlList.do",
      { cty_Bus_Area_Cd: "", trml_Nm: keyword, pre_Trml_Cd: depTerId, rtnGbn: "02" },
      "/main.do"
    );
    const data = JSON.parse(text);
    sendJson(res, 200, { destinations: data.map(normalizeTmoneyTerminal).slice(0, includeAll ? 1000 : 50) });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleTmoneyIntercitySearch(req, res) {
  try {
    const depTerId = String(req.searchParams.get("depTerId") || "").trim();
    const arrTerId = String(req.searchParams.get("arrTerId") || "").trim();
    const date = String(req.searchParams.get("date") || "").replace(/\D/g, "");
    const depName = String(req.searchParams.get("depName") || "");
    const arrName = String(req.searchParams.get("arrName") || "");
    if (!depTerId || !arrTerId || !/^\d{8}$/.test(date)) {
      return sendJson(res, 400, { error: "출발지, 도착지, 날짜를 모두 선택해 주세요." });
    }
    const html = await postForm(
      TMONEY_INTERCITY_ORIGIN,
      "/otck/readAlcnList.do",
      {
        depr_Trml_Cd: depTerId,
        arvl_Trml_Cd: arrTerId,
        depr_Dt: date,
        depr_Time: "000000",
        bef_Aft_Dvs: "D",
        req_Rec_Num: "10"
      },
      "/main.do"
    );
    sendJson(res, 200, {
      source: "티머니 시외버스",
      officialUrl: "https://intercitybus.tmoney.co.kr/",
      searchedAt: new Date().toISOString(),
      date,
      depTerId,
      arrTerId,
      depName,
      arrName,
      trips: parseTmoneyTrips(html, depName, arrName)
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleKobusTerminals(req, res) {
  try {
    const keyword = String(req.searchParams.get("q") || "").trim().toLowerCase();
    const includeAll = req.searchParams.get("all") === "1";
    const routes = await getKobusRoutes();
    const map = new Map();
    for (const route of routes) {
      if (keyword && !String(`${route.deprNm} ${route.deprArea}`).toLowerCase().includes(keyword)) continue;
      map.set(route.deprCd, { id: route.deprCd, name: route.deprNm, area: route.deprArea || "" });
    }
    sendJson(res, 200, { terminals: [...map.values()].slice(0, includeAll ? 1000 : 30) });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleKobusDestinations(req, res) {
  try {
    const depTerId = String(req.searchParams.get("depTerId") || "").trim();
    const keyword = String(req.searchParams.get("q") || "").trim().toLowerCase();
    const includeAll = req.searchParams.get("all") === "1";
    const routes = await getKobusRoutes();
    const map = new Map();
    for (const route of routes) {
      if (route.deprCd !== depTerId) continue;
      if (keyword && !String(`${route.arvlNm} ${route.arvlArea}`).toLowerCase().includes(keyword)) continue;
      map.set(route.arvlCd, {
        id: route.arvlCd,
        name: route.arvlNm,
        area: route.arvlArea || "",
        durationMinutes: Number(route.takeTime || 0)
      });
    }
    sendJson(res, 200, { destinations: [...map.values()].slice(0, includeAll ? 1000 : 50) });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleKobusSearch(req, res) {
  const date = String(req.searchParams.get("date") || "").replace(/\D/g, "");
  sendJson(res, 200, {
    source: "티머니 고속버스",
    officialUrl: "https://www.kobus.co.kr/main.do",
    searchedAt: new Date().toISOString(),
    date,
    depTerId: String(req.searchParams.get("depTerId") || ""),
    arrTerId: String(req.searchParams.get("arrTerId") || ""),
    depName: String(req.searchParams.get("depName") || ""),
    arrName: String(req.searchParams.get("arrName") || ""),
    trips: [],
    notice: "코버스 배차 조회는 공식 사이트 웹방화벽에서 서버 자동 조회가 차단되어, 같은 형식의 글 틀과 공식 예매 사이트 링크를 제공합니다."
  });
}

async function handleKobusPublicApiSearch(req, res) {
  try {
    const depTerId = String(req.searchParams.get("depTerId") || "").trim();
    const arrTerId = String(req.searchParams.get("arrTerId") || "").trim();
    const date = String(req.searchParams.get("date") || "").replace(/\D/g, "");
    const depName = String(req.searchParams.get("depName") || "");
    const arrName = String(req.searchParams.get("arrName") || "");
    const serviceKey = getDataGoKrServiceKey(req);

    if (!depTerId || !arrTerId || !/^\d{8}$/.test(date)) {
      return sendJson(res, 400, { error: "출발지, 도착지, 날짜를 모두 선택해 주세요." });
    }
    if (!serviceKey) {
      return sendJson(res, 400, {
        error: "티머니 고속버스 시간표는 공공데이터포털 서비스키가 필요합니다. DATA_GO_KR_SERVICE_KEY 환경변수로 설정하거나 화면의 공공데이터 API 키 칸에 입력해 주세요."
      });
    }

    const data = await fetchDataGoKrJson(TAGO_EXP_BUS_ORIGIN, "/GetStrtpntAlocFndExpbusInfo", serviceKey, {
      pageNo: "1",
      numOfRows: "200",
      depTerminalId: toTagoExpressTerminalId(depTerId),
      arrTerminalId: toTagoExpressTerminalId(arrTerId),
      depPlandTime: date
    });
    const items = normalizeArray(data?.response?.body?.items?.item);
    const trips = items.map((item) => normalizeKobusApiTrip(item, depName, arrName));

    sendJson(res, 200, {
      source: "코버스",
      officialUrl: "https://www.kobus.co.kr/main.do",
      searchedAt: new Date().toISOString(),
      date,
      depTerId,
      arrTerId,
      depName,
      arrName,
      trips,
      notice: "공공데이터포털 국토교통부(TAGO) 고속버스정보 API 기준으로 조회했습니다. 중고생·아동 요금은 API에서 제공될 때만 표시됩니다."
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleBuspiaSearch(req, res) {
  try {
    const keyword = String(req.searchParams.get("q") || "").trim().toLowerCase();
    if (!keyword) return sendJson(res, 200, { routes: [] });
    const limit = Math.max(1, Math.min(36, Number(req.searchParams.get("limit") || 20)));

    const routes = await fetchBuspiaRoutes();
    const matches = routes
      .filter((route) => {
        const target = `${route.routeNo} ${route.routeTitle} ${route.depName} ${route.arrName} ${route.company} ${route.stops.join(" ")}`.toLowerCase();
        return target.includes(keyword);
      })
      .slice(0, limit);

    const routesWithImages = await Promise.all(
      matches.map(async (route) => {
        try {
          const imageUrl = await getBuspiaTimeImage(route.seq);
          return {
            ...route,
            imageUrl,
            downloadUrl: `/api/buspia/download?seq=${encodeURIComponent(route.seq)}&routeNo=${encodeURIComponent(route.routeNo)}`
          };
        } catch (error) {
          return { ...route, imageUrl: "", downloadUrl: "", imageError: error.message };
        }
      })
    );

    sendJson(res, 200, {
      source: "버스피아 공항버스",
      officialUrl: `${BUSPIA_ORIGIN}/subpage/bus/air_info.php`,
      searchedAt: new Date().toISOString(),
      routes: routesWithImages
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleBuspiaDownload(req, res) {
  try {
    const seq = String(req.searchParams.get("seq") || "").trim();
    const routeNo = String(req.searchParams.get("routeNo") || "buspia-airport").replace(/[^\w가-힣-]/g, "");
    if (!seq) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("seq is required");
      return;
    }

    const imageUrl = await getBuspiaTimeImage(seq);
    const imageResponse = await fetch(imageUrl, { headers: { "user-agent": USER_AGENT, referer: BUSPIA_ORIGIN } });
    if (!imageResponse.ok) {
      throw new Error(`이미지 다운로드 오류 ${imageResponse.status}`);
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
    res.writeHead(200, {
      "content-type": imageResponse.headers.get("content-type") || "image/jpeg",
      "content-disposition": `attachment; filename=\"buspia-${encodeURIComponent(routeNo)}${ext}\"`
    });
    res.end(buffer);
  } catch (error) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
}

async function handleNewsmileSearch(req, res) {
  try {
    const keyword = String(req.searchParams.get("q") || "").trim();
    if (!keyword) return sendJson(res, 200, { routes: [] });
    const limit = Math.max(1, Math.min(36, Number(req.searchParams.get("limit") || 20)));
    const routes = await fetchNewsmileRoutes(keyword, limit);
    const routesWithImages = await Promise.all(
      routes.map(async (route) => {
        try {
          return await getNewsmileRouteWithImage(route);
        } catch (error) {
          return { ...route, stops: [route.depName, route.arrName].filter(Boolean), imageUrl: "", routeImageUrl: "", downloadUrl: "", imageError: error.message };
        }
      })
    );

    sendJson(res, 200, {
      source: "경주 새천년미소",
      officialUrl: `${NEWSMILE_ORIGIN}/sub01.asp`,
      searchedAt: new Date().toISOString(),
      routes: routesWithImages
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleNewsmileDownload(req, res) {
  try {
    const idx = String(req.searchParams.get("idx") || "").trim();
    const routeNo = String(req.searchParams.get("routeNo") || "newsmile").replace(/[^\w가-힣-]/g, "");
    const kind = String(req.searchParams.get("kind") || "time").trim();
    if (!idx) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("idx is required");
      return;
    }

    const detailHtml = await fetchNewsmileHtml(`/sub01/bus.asp?idx=${encodeURIComponent(idx)}`, "euc-kr");
    const detail = parseNewsmileDetail(detailHtml, { routeNo, idx });
    const imageUrl = kind === "route" ? detail.routeImageUrl : detail.imageUrl;
    if (!imageUrl) throw new Error("시간표 이미지 주소를 찾지 못했습니다.");
    const imageResponse = await fetch(imageUrl, { headers: { "user-agent": USER_AGENT, referer: NEWSMILE_ORIGIN } });
    if (!imageResponse.ok) throw new Error(`이미지 다운로드 오류 ${imageResponse.status}`);

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
    res.writeHead(200, {
      "content-type": imageResponse.headers.get("content-type") || "image/jpeg",
      "content-disposition": `attachment; filename=\"newsmile-${encodeURIComponent(routeNo)}-${kind === "route" ? "route" : "time"}${ext}\"`
    });
    res.end(buffer);
  } catch (error) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
}

async function handleGwangjuBusSearch(req, res) {
  try {
    const keyword = String(req.searchParams.get("q") || "").trim();
    if (!keyword) return sendJson(res, 200, { routes: [] });
    const limit = Math.max(1, Math.min(36, Number(req.searchParams.get("limit") || 20)));
    const routes = await fetchGwangjuRoute(keyword, limit);
    sendJson(res, 200, {
      source: "광주버스",
      officialUrl: `${GWANGJU_BUS_ORIGIN}/busmap/lineSearch`,
      searchedAt: new Date().toISOString(),
      routes
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function jejuPost(pathname, params) {
  const text = await postForm(JEJU_BUS_ORIGIN, pathname, params, "/publicTrafficInformation/generalBusSchedule?viewtype=2");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`제주버스 응답을 해석하지 못했습니다: ${text.slice(0, 200)}`);
  }
}

async function fetchJejuRouteGroups() {
  const types = ["1", "2", "3", "4", "5", "6"];
  const groups = await Promise.all(types.map((type) => jejuPost("/publicTrafficInformation/getBusRouteNum", { GROUTE_TYPE: type })));
  return groups.flat();
}

function jejuBusKind(route) {
  const detailType = String(route.ROUTE_BUS_DETAIL_TP || "");
  const routeType = String(route.ROUTE_BUS_TP || "");
  if (detailType === "4") return "급행버스";
  if (detailType === "6") return "공항버스";
  if (detailType === "5") return "읍면지선버스";
  if (detailType === "3") return routeType === "1" ? "간선버스" : "지선버스";
  if (detailType === "2") return "지선버스";
  return routeType === "1" ? "간선버스" : "일반버스";
}

function slimJejuColumns(headers) {
  const stopIndexes = headers.map((_, index) => index).filter((index) => index > 0);
  if (stopIndexes.length <= 5) return headers.map((_, index) => index);
  const keepStops = stopIndexes.filter((_, index) => index % 2 === 0);
  const last = stopIndexes[stopIndexes.length - 1];
  if (!keepStops.includes(last)) keepStops.push(last);
  return [0, ...keepStops];
}

function summarizeInterval(times) {
  const minutes = [...new Set(times)]
    .filter((time) => /^\d{1,2}:\d{2}$/.test(time))
    .map((time) => {
      const [hour, minute] = time.split(":").map(Number);
      return hour * 60 + minute;
    })
    .sort((a, b) => a - b);
  const gaps = minutes.slice(1).map((value, index) => value - minutes[index]).filter((gap) => gap > 0);
  if (!gaps.length) return "-";
  return `약 ${Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)}분`;
}

function jejuRouteEndpoints(sheetTitle, fallbackNumber) {
  const clean = String(sheetTitle || "").replace(new RegExp(`^${fallbackNumber}\\s*`), "");
  const parts = clean.split("-").map((part) => part.trim()).filter(Boolean);
  return { origin: parts[0] || "", destination: parts[parts.length - 1] || "" };
}

async function fetchJejuScheduleDetail(scheduleId) {
  const response = await fetch(`${JEJU_BUS_ORIGIN}/mobile/schedule/detailSchedule?scheduleId=${encodeURIComponent(scheduleId)}`, {
    headers: { "user-agent": USER_AGENT, referer: `${JEJU_BUS_ORIGIN}/mobile/schedule/listScheduleNew` }
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`제주버스 상세시간표 조회 오류 ${response.status}`);
  return html;
}

function parseJejuScheduleDetailInfo(html) {
  const via = htmlText((html.match(/<td[^>]*class="rotue-via[^"]*"[^>]*>([\s\S]*?)<\/td>/) || [])[1] || "");
  const waypoint = htmlText((html.match(/<td[^>]*class="route-waypoint[^"]*"[^>]*>([\s\S]*?)<\/td>/) || [])[1] || "");
  const desc = htmlText((html.match(/<td[^>]*class="route-desc"[^>]*colspan="3"[^>]*>([\s\S]*?)<\/td>/) || [])[1] || "");
  const companyMatch = desc.match(/,\s*([^,()]+)\(([^)]+)\)\s*$/);
  const intervalMatch = desc.match(/배차간격\s*([^,]+)/);
  const stops = via.split("-").map((item) => item.trim()).filter(Boolean);
  return {
    company: companyMatch ? `${companyMatch[1].trim()}(${companyMatch[2].trim()})` : "",
    interval: intervalMatch ? intervalMatch[1].trim() : "",
    stops,
    endpoints: jejuRouteEndpoints(waypoint.replace(/→/g, "-"), "")
  };
}

async function fetchJejuScheduleTable(scheduleId, title, detailInfo) {
  const data = await jejuPost("/data/schedule/getScheduleTableInfo", { scheduleId });
  const maxCol = Math.max(...data.map((item) => Number(item.MAX_COL || item.COLUMN_SEQ || 0)), 0);
  const maxRow = Math.max(...data.map((item) => Number(item.MAX_ROW || item.ROW_SEQ || 0)), 0);
  const matrix = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(""));
  data.forEach((item) => {
    const row = Number(item.ROW_SEQ || 0);
    const col = Number(item.COLUMN_SEQ || 0);
    matrix[row][col] = htmlText(item.COLUMN_NM || "");
  });

  const headers = ["구분", ...matrix[0].slice(1)];
  const tableRows = matrix.slice(1).filter((row) => row.some((cell) => /^\d{1,2}:\d{2}$/.test(cell))).map((row, index) => [String(index + 1), ...row.slice(1)]);
  const keepColumns = slimJejuColumns(headers);
  return {
    title,
    headers: keepColumns.map((index) => headers[index]).filter(Boolean),
    rows: tableRows.map((row) => keepColumns.map((index) => row[index] || "")).slice(0, 80),
    allStops: headers.slice(1),
    interval: detailInfo.interval || summarizeInterval(tableRows.map((row) => row[1] || row[2] || "").filter(Boolean))
  };
}

async function handleJejuBusSearch(req, res) {
  try {
    const busNo = String(req.searchParams.get("busNo") || "").trim();
    if (!busNo) return sendJson(res, 400, { error: "버스번호가 필요합니다." });

    const groups = await fetchJejuRouteGroups();
    const route = groups.find((item) =>
      String(item.GSCHEDULE_NM || "")
        .split(",")
        .map((part) => part.trim().replace(/\(.*?\)/g, ""))
        .includes(busNo)
    );
    if (!route) return sendJson(res, 404, { error: `${busNo}번 제주버스 시간표를 찾지 못했습니다.` });

    const sheetInfo = await jejuPost("/data/schedule/getGroupScheduleInfo", { gscheduleId: route.GSCHEDULE_ID });
    const details = await Promise.all(sheetInfo.map((sheet) => fetchJejuScheduleDetail(sheet.SCHEDULE_ID).then(parseJejuScheduleDetailInfo)));
    const schedules = await Promise.all(sheetInfo.map((sheet, index) => fetchJejuScheduleTable(sheet.SCHEDULE_ID, `${sheet.SHEET_NUM} ${sheet.SHEET_NM}`, details[index] || {})));
    const firstDetail = details[0] || {};
    const endpoints = firstDetail.endpoints?.origin ? firstDetail.endpoints : jejuRouteEndpoints(sheetInfo[0]?.SHEET_NM || route.GSCHEDULE_NM, busNo);
    const allStops = [...new Set((firstDetail.stops?.length ? firstDetail.stops : schedules.flatMap((sheet) => sheet.allStops)).filter(Boolean))];

    sendJson(res, 200, {
      source: "제주버스",
      officialUrl: `${JEJU_BUS_ORIGIN}/publicTrafficInformation/generalBusSchedule?viewtype=2`,
      searchedAt: new Date().toISOString(),
      busNo,
      company: firstDetail.company || "제주버스",
      origin: endpoints.origin,
      destination: endpoints.destination,
      busKind: jejuBusKind(route),
      interval: firstDetail.interval || schedules[0]?.interval || "-",
      majorStops: allStops.slice(0, 10),
      schedules
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function fetchBusanMobileHtml(pathname, params = null) {
  const response = await fetch(`${BUSAN_BUS_ORIGIN}${pathname}`, {
    method: params ? "POST" : "GET",
    headers: {
      "user-agent": USER_AGENT,
      "content-type": "application/x-www-form-urlencoded",
      referer: `${BUSAN_BUS_ORIGIN}/busanBIMS/mobile/webApp/page/busInfo/busNumbList.asp`
    },
    body: params ? new URLSearchParams(params) : undefined
  });
  const html = new TextDecoder("euc-kr").decode(await response.arrayBuffer());
  if (!response.ok) throw new Error(`부산버스 응답 오류 ${response.status}: ${html.slice(0, 200)}`);
  return html;
}

function busanBusKind(className) {
  if (/sred/.test(className)) return "심야버스";
  if (/red/.test(className)) return "급행버스";
  if (/green/.test(className)) return "마을버스";
  return "일반버스";
}

function parseBusanRoutes(html) {
  return [...html.matchAll(/<li class=['"]bus_type\s+([^'"]+)['"][\s\S]*?<a href="javascript:find_line_info\((\d+),'([^']+)'\);"[\s\S]*?<p class="bus_name">([\s\S]*?)<\/p>[\s\S]*?<span class="bus_route">([\s\S]*?)<\/span>/gi)]
    .map((match) => ({
      className: match[1],
      lineId: match[2],
      lineName: htmlText(match[3]),
      busNo: htmlText(match[4]).replace(/번$/, ""),
      routeText: htmlText(match[5]),
      busKind: busanBusKind(match[1])
    }));
}

function firstTextAfter(label, html) {
  const match = html.match(new RegExp(`${label}[\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>`, "i"));
  return htmlText((match || [])[1] || "");
}

function parseBusanStops(listHtml) {
  return [...listHtml.matchAll(/<li[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/li>/gi)]
    .map((match) => {
      const item = match[1].replace(/<div class="real_time"[\s\S]*?<\/div>/gi, "");
      const stationId = ((item.match(/search_stationinfo\('([^']+)'\)/) || [])[1] || "").trim();
      const timeText = htmlText((item.match(/<span class="cl_gray">([\s\S]*?)<\/span>/i) || [])[1] || "");
      const timeMatch = timeText.match(/(\d{2,5})?\s*\(?(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})\)?/);
      const stopName = htmlText(item.replace(/<span class="cl_gray">[\s\S]*?<\/span>/i, ""));
      return {
        stationId,
        stopName,
        stationNo: timeMatch?.[1] || "",
        firstTime: timeMatch?.[2] || "",
        lastTime: timeMatch?.[3] || ""
      };
    })
    .filter((stop) => stop.stopName);
}

function parseBusanRouteDetail(html, route) {
  const routeText = htmlText((html.match(/<p class="bus_route cl_black">([\s\S]*?)<\/p>/i) || [])[1] || route.routeText);
  const [origin = "", destination = ""] = routeText.split(/\s*-\s*/).map((part) => part.trim());
  const firstTime = firstTextAfter("첫차", html);
  const lastTime = firstTextAfter("막차", html);
  const intervalBlock = htmlText((html.match(/배차간격([\s\S]*?)<\/p>/i) || [])[1] || "");
  const company = htmlText((html.match(/<b>운수회사<\/b>[\s\S]*?<span class="cl_gray">([\s\S]*?)<\/span>/i) || [])[1] || "");
  const tabLabels = [...html.matchAll(/<a href="#" class="tab_(?:start|arrive)[^"]*">([\s\S]*?)<\/a>/gi)].map((match) => htmlText(match[1]));
  const listMatches = [...html.matchAll(/<ul class="route_list\s+(con_(?:start|arrive))"[^>]*>([\s\S]*?)<\/ul>/gi)];
  const schedules = listMatches.map((match, index) => {
    const stops = parseBusanStops(match[2]);
    return {
      title: tabLabels[index] || (index === 0 ? `${destination || route.busNo} 방향` : `${origin || route.busNo} 방향`),
      headers: ["정류소", "정류소번호", "첫차", "막차"],
      rows: stops.map((stop) => [stop.stopName, stop.stationNo || stop.stationId, stop.firstTime || "-", stop.lastTime || "-"]),
      allStops: stops.map((stop) => stop.stopName)
    };
  }).filter((schedule) => schedule.rows.length);

  return {
    source: "부산버스",
    officialUrl: `${BUSAN_BUS_ORIGIN}/busanBIMS/mobile/webApp/page/busInfo/busNumbList.asp`,
    searchedAt: new Date().toISOString(),
    busNo: route.busNo,
    company: company || "부산버스",
    origin,
    destination,
    busKind: route.busKind,
    interval: intervalBlock || `${firstTime || "-"} ~ ${lastTime || "-"}`,
    majorStops: schedules[0]?.allStops.slice(0, 10) || [],
    schedules
  };
}

async function handleBusanBusSearch(req, res) {
  try {
    const busNo = String(req.searchParams.get("busNo") || "").trim();
    if (!busNo) return sendJson(res, 400, { error: "버스번호가 필요합니다." });
    const listHtml = await fetchBusanMobileHtml("/busanBIMS/mobile/webApp/page/busInfo/busNumbList.asp", { keyword: busNo });
    const routes = parseBusanRoutes(listHtml);
    const normalized = busNo.replace(/\s+/g, "");
    const route = routes.find((item) => item.busNo.replace(/\s+/g, "") === normalized) || routes[0];
    if (!route) return sendJson(res, 404, { error: `${busNo}번 부산버스 노선을 찾지 못했습니다.` });
    const detailHtml = await fetchBusanMobileHtml("/busanBIMS/mobile/webApp/page/busInfo/busNumbResult.asp", {
      line_id: route.lineId,
      line_name: route.lineName
    });
    sendJson(res, 200, parseBusanRouteDetail(detailHtml, route));
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function incheonPost(pathname, params) {
  const text = await postForm(INCHEON_BUS_ORIGIN, pathname, params, "/bis/search1.view");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`인천버스 응답을 해석하지 못했습니다: ${text.slice(0, 200)}`);
  }
}

function incheonBusKind(routeType) {
  switch (String(routeType || "")) {
    case "1":
    case "9":
      return "지선버스";
    case "2":
      return "간선버스";
    case "3":
    case "10":
      return "좌석버스";
    case "4":
      return "광역버스";
    case "5":
      return "공항버스";
    case "6":
      return "마을버스";
    case "8":
      return "급행버스";
    default:
      return "일반버스";
  }
}

function formatIncheonCompany(route) {
  const names = String(route.compnm || "").split(",").map((item) => item.trim()).filter(Boolean);
  const tels = String(route.telephone || "").split(",").map((item) => item.trim());
  if (!names.length) return "인천버스";
  return names.map((name, index) => (tels[index] ? `${name}(${tels[index]})` : name)).join(" / ");
}

function formatIncheonInterval(route) {
  const day = route.day_busdispt ? `평일 ${route.day_busdispt}분` : "";
  const sat = route.satday_busdispt ? `토요일 ${route.satday_busdispt}분` : "";
  const holi = route.holiyday_busdispt ? `공휴일 ${route.holiyday_busdispt}분` : "";
  return [day, sat, holi].filter(Boolean).join(" / ") || "-";
}

async function handleIncheonBusSearch(req, res) {
  try {
    const busNo = String(req.searchParams.get("busNo") || "").trim();
    if (!busNo) return sendJson(res, 400, { error: "버스번호가 필요합니다." });
    const searchData = await incheonPost("/inq/selectRouteSearchList.do", { searchWord: busNo, routeid: "" });
    const routes = searchData.routeList || [];
    const normalized = busNo.replace(/\s+/g, "");
    const route = routes.find((item) => String(item.routeno || "").replace(/\s+/g, "") === normalized) || routes[0];
    if (!route) return sendJson(res, 404, { error: `${busNo}번 인천버스 노선을 찾지 못했습니다.` });
    const detail = await incheonPost("/inq/selectRouteDetailInfo.do", { routeid: route.routeid, isPc: "true" });
    const stops = (detail.viaStopList || []).map((stop) => stop.nodenm).filter(Boolean);
    sendJson(res, 200, {
      source: "인천버스",
      officialUrl: `${INCHEON_BUS_ORIGIN}/bis/main.view`,
      realTimeUrl: `https://map.naver.com/p/search/${encodeURIComponent(`인천 ${route.routeno || busNo}번 버스`)}`,
      searchedAt: new Date().toISOString(),
      busNo: route.routeno || busNo,
      company: formatIncheonCompany(route),
      origin: route.originbstopkr || "",
      destination: route.destbstopkr || "",
      busKind: incheonBusKind(route.routetpcd),
      interval: formatIncheonInterval(route),
      firstTime: route.first_tm || "-",
      lastTime: route.last_tm || "-",
      majorStops: [...new Set(stops)].slice(0, 10)
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function ulsanPost(params) {
  let lastText = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${ULSAN_BUS_ORIGIN}/mpng/getList.json`, {
      method: "POST",
      headers: {
        "user-agent": USER_AGENT,
        "content-type": "application/json;charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
        referer: `${ULSAN_BUS_ORIGIN}/route/timetable.do`
      },
      body: JSON.stringify(params)
    });
    const text = await response.text();
    lastText = text;
    lastStatus = response.status;
    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(`울산버스 응답을 해석하지 못했습니다: ${text.slice(0, 200)}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(`울산버스 응답 오류 ${lastStatus}: ${lastText.slice(0, 200)}`);
}

function cleanUlsanBusNo(name) {
  return String(name || "").split("(")[0].trim();
}

function parseUlsanRouteName(name) {
  const match = String(name || "").match(/\(([\s\S]*?)\)$/);
  const parts = (match?.[1] || "").split(/\s*~\s*/).map((part) => part.replace(/\(.+?\)/g, "").trim()).filter(Boolean);
  return { origin: parts[0] || "", destination: parts[parts.length - 1] || "" };
}

function formatUlsanTime(value) {
  const clean = String(value || "").trim();
  if (/^\d{4}/.test(clean)) return `${clean.slice(0, 2)}:${clean.slice(2, 4)}${clean.slice(4)}`;
  return clean || "-";
}

function summarizeUlsanInterval(times) {
  const minutes = times
    .map((time) => String(time || "").match(/^(\d{2}):(\d{2})/))
    .filter(Boolean)
    .map((match) => Number(match[1]) * 60 + Number(match[2]))
    .sort((a, b) => a - b);
  const gaps = minutes.slice(1).map((value, index) => value - minutes[index]).filter((gap) => gap > 0);
  if (!gaps.length) return "-";
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  return min === max ? `${min}분` : `${min}~${max}분`;
}

function buildUlsanRows(fiducialTitle, fiducialTimes, terminalTitle, terminalTimes) {
  const max = Math.max(fiducialTimes.length, terminalTimes.length);
  return Array.from({ length: max }, (_, index) => [String(index + 1), fiducialTimes[index] || "", terminalTimes[index] || ""]);
}

async function fetchUlsanSchedule(option, label, dywkVal) {
  const parts = String(option.brtNo || "").split(":");
  const busNo = cleanUlsanBusNo(option.bnodeName);
  const data = await ulsanPost({
    postData: {
      serviceName: "routeBusService",
      methodName: "getBusTimeTableInfo",
      brtId: parts[0],
      brtNo: busNo,
      dywkVal,
      brtClass: parts[2],
      bttDirection: parts[4]
    }
  });
  const row = data.rows?.[0] || {};
  const isCircular = String(parts[4]) === "3";
  const fiducialTitle = isCircular ? row.circularTitle?.[0] : row.fiducialTitle?.[0];
  const fiducialInfo = isCircular ? row.circularInfo || [] : row.fiducialInfo || [];
  const terminalTitle = row.terminalTitle?.[0];
  const terminalInfo = isCircular ? [] : row.terminalInfo || [];
  const fiducialName = fiducialTitle ? `${fiducialTitle.stStopName} → ${fiducialTitle.edStopName}` : "기점방향";
  const terminalName = terminalTitle ? `${terminalTitle.stStopName} → ${terminalTitle.edStopName}` : "종점방향";
  const fiducialTimes = fiducialInfo.map((item) => formatUlsanTime(item.bttStarttime)).filter(Boolean);
  const terminalTimes = terminalInfo.map((item) => formatUlsanTime(item.bttStarttime)).filter(Boolean);
  return {
    title: label,
    headers: ["순번", fiducialName, terminalTimes.length ? terminalName : ""].filter(Boolean),
    rows: buildUlsanRows(fiducialName, fiducialTimes, terminalName, terminalTimes).map((row) => terminalTimes.length ? row : row.slice(0, 2)),
    firstTime: fiducialTimes[0] || terminalTimes[0] || "-",
    lastTime: [...fiducialTimes, ...terminalTimes].filter(Boolean).slice(-1)[0] || "-",
    interval: summarizeUlsanInterval([...fiducialTimes, ...terminalTimes])
  };
}

async function fetchUlsanRouteStops(brtId) {
  const data = await ulsanPost({
    postData: { serviceName: "routeStationService", methodName: "getGridList", paging: false },
    record: { routeId: brtId },
    sorting: [{ column: "pntSqno", order: "asc" }]
  });
  return (data.rows || []).map((stop) => stop.stopname).filter(Boolean);
}

async function handleUlsanBusSearch(req, res) {
  try {
    const busNo = String(req.searchParams.get("busNo") || "").trim();
    if (!busNo) return sendJson(res, 400, { error: "버스번호가 필요합니다." });
    const options = await ulsanPost({ postData: { serviceName: "routeBusService", methodName: "getOptionList" } });
    const normalized = busNo.replace(/\s+/g, "");
    const route = (options.rows || []).find((item) => cleanUlsanBusNo(item.bnodeName).replace(/\s+/g, "") === normalized)
      || (options.rows || []).find((item) => cleanUlsanBusNo(item.bnodeName).replace(/\s+/g, "").includes(normalized));
    if (!route) return sendJson(res, 404, { error: `${busNo}번 울산버스 시간표를 찾지 못했습니다.` });
    const schedules = await Promise.all([
      fetchUlsanSchedule(route, "평일", 0),
      fetchUlsanSchedule(route, "토요일", 7),
      fetchUlsanSchedule(route, "일/공휴일", 1)
    ]);
    const brtId = String(route.brtNo || "").split(":")[0];
    const routeStops = await fetchUlsanRouteStops(brtId);
    const endpoints = parseUlsanRouteName(route.bnodeName);
    sendJson(res, 200, {
      source: "울산버스",
      officialUrl: `${ULSAN_BUS_ORIGIN}/route/timetable.do`,
      realTimeUrl: `https://map.naver.com/p/search/${encodeURIComponent(`울산 ${cleanUlsanBusNo(route.bnodeName) || busNo}번 버스`)}`,
      searchedAt: new Date().toISOString(),
      busNo: cleanUlsanBusNo(route.bnodeName) || busNo,
      company: "울산광역시 시내버스",
      origin: endpoints.origin,
      destination: endpoints.destination,
      busKind: "시내버스",
      interval: schedules[0]?.interval || "-",
      firstTime: schedules[0]?.firstTime || "-",
      lastTime: schedules[0]?.lastTime || "-",
      majorStops: [...new Set(routeStops)].slice(0, 10),
      schedules
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleAirportLimousineSearch(req, res) {
  try {
    const busNo = String(req.searchParams.get("busNo") || "").trim().toUpperCase();
    if (!busNo) return sendJson(res, 400, { error: "버스번호가 필요합니다." });

    const indexHtml = await fetchAirportLimousinePage("1");
    const routes = parseAirportLimousineRoutes(indexHtml);
    const route = routes.find((item) => item.busNo.toUpperCase() === busNo);
    if (!route) return sendJson(res, 404, { error: `${busNo}번 공항리무진 노선을 찾지 못했습니다.` });

    const baseHtml = await fetchAirportLimousinePage(route.baseCatNo);
    const directions = parseAirportLimousineDirections(baseHtml);
    const airportCatNo = directions.airportCatNo || route.baseCatNo;
    const cityCatNo = directions.cityCatNo || route.baseCatNo;
    const [airportHtml, cityHtml] = await Promise.all([
      fetchAirportLimousinePage(airportCatNo),
      fetchAirportLimousinePage(cityCatNo)
    ]);

    const airportStops = parseAirportLimousineStops(airportHtml);
    const cityStops = parseAirportLimousineStops(cityHtml);
    const airportDep = airportStops[0] || { id: "", name: "" };
    const airportArr = airportStops[airportStops.length - 1] || { id: "", name: "" };
    const t2Stop = cityStops.find((stop) => /2터미널|T2/i.test(stop.name)) || cityStops[0] || { id: "", name: "" };
    const t1Stop = cityStops.find((stop) => /1터미널|T1/i.test(stop.name)) || cityStops[1] || cityStops[0] || { id: "", name: "" };
    const cityArr = cityStops[cityStops.length - 1] || { id: "", name: "" };

    const [airportTimeHtml, cityT2TimeHtml, cityT1TimeHtml] = await Promise.all([
      airportDep.id ? fetchAirportLimousineStationTime(airportDep.id) : Promise.resolve(""),
      t2Stop.id ? fetchAirportLimousineStationTime(t2Stop.id) : Promise.resolve(""),
      t1Stop.id ? fetchAirportLimousineStationTime(t1Stop.id) : Promise.resolve("")
    ]);
    const fare = parseAirportLimousineFare(airportTimeHtml || cityT2TimeHtml || cityT1TimeHtml);
    const company = "공항리무진";
    const companyUrl = `${AIRPORT_LIMOUSINE_ORIGIN}/sub/sub01.php?cat_no=${encodeURIComponent(route.baseCatNo)}`;

    sendJson(res, 200, {
      source: "공항리무진",
      searchedAt: new Date().toISOString(),
      busNo: route.busNo,
      routeLabel: route.label,
      company,
      companyUrl,
      depName: airportDep.name,
      arrName: airportArr.name,
      majorStops: airportStops.slice(0, 7).map((stop) => stop.name),
      airportDirection: buildAirportLimousineSchedule({
        html: airportTimeHtml,
        stop: airportDep,
        arrName: airportArr.name,
        company,
        ...fare
      }),
      cityDirectionT2: buildAirportLimousineSchedule({
        html: cityT2TimeHtml,
        stop: t2Stop,
        arrName: cityArr.name,
        company,
        ...fare
      }),
      cityDirectionT1: buildAirportLimousineSchedule({
        html: cityT1TimeHtml,
        stop: t1Stop,
        arrName: cityArr.name,
        company,
        ...fare
      })
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleAirportLimousineRoutes(req, res) {
  try {
    const indexHtml = await fetchAirportLimousinePage("1");
    const routes = parseAirportLimousineRoutes(indexHtml);
    sendJson(res, 200, { routes });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleSeoulAirbusRoutes(req, res) {
  try {
    const html = await fetchSeoulAirbusPage("/bus");
    sendJson(res, 200, { routes: parseSeoulAirbusRoutes(html) });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleSeoulAirbusSearch(req, res) {
  try {
    const busNo = String(req.searchParams.get("busNo") || "").trim().toUpperCase();
    if (!busNo) return sendJson(res, 400, { error: "버스번호가 필요합니다." });

    const routeHtml = await fetchSeoulAirbusPage(`/bus/${encodeURIComponent(busNo)}`);
    const info = parseSeoulAirbusRoutePage(routeHtml, busNo);
    if (!info.routeId) return sendJson(res, 404, { error: `${busNo}번 서울공항리무진 시간표를 찾지 못했습니다.` });
    const [weekdayTimetableHtml, weekendTimetableHtml] = await Promise.all([
      fetchSeoulAirbusPage(`/timetableAll/${encodeURIComponent(info.routeId)}/0`),
      fetchSeoulAirbusPage(`/timetableAll/${encodeURIComponent(info.routeId)}/1`)
    ]);
    const weekdaySchedules = buildSeoulAirbusSchedules({
      ...parseSeoulAirbusWholeTimetable(weekdayTimetableHtml),
      company: "서울공항리무진",
      adultFare: info.adultFare,
      childFare: info.childFare,
      depName: info.depName,
      arrName: info.arrName
    });
    const weekendSchedules = buildSeoulAirbusSchedules({
      ...parseSeoulAirbusWholeTimetable(weekendTimetableHtml),
      company: "서울공항리무진",
      adultFare: info.adultFare,
      childFare: info.childFare,
      depName: info.depName,
      arrName: info.arrName
    });

    sendJson(res, 200, {
      source: "서울공항리무진",
      searchedAt: new Date().toISOString(),
      busNo,
      company: "서울공항리무진",
      companyUrl: `${SEOUL_AIRBUS_ORIGIN}/bus/${encodeURIComponent(busNo)}`,
      depName: info.depName,
      arrName: info.arrName,
      majorStops: info.stations.slice(0, 7).map((station) => station.name),
      ...weekdaySchedules,
      ...pickDifferentWeekendSchedules(weekdaySchedules, weekendSchedules)
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleCaltRoutes(req, res) {
  try {
    const html = await fetchCaltPage("/limousine/01.php");
    sendJson(res, 200, { routes: parseCaltRoutes(html) });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleCaltSearch(req, res) {
  try {
    const busNo = String(req.searchParams.get("busNo") || "").trim().toUpperCase();
    if (!busNo) return sendJson(res, 400, { error: "버스번호가 필요합니다." });

    const indexHtml = await fetchCaltPage("/limousine/01.php");
    const route = parseCaltRoutes(indexHtml).find((item) => item.busNo.toUpperCase() === busNo);
    if (!route) return sendJson(res, 404, { error: `${busNo}번 한국도심공항 시간표를 찾지 못했습니다.` });

    const html = await fetchCaltPage(route.path);
    const stops = parseCaltStops(html);
    const company = "한국도심공항";
    const adultFare = (htmlText((html.match(/일반\(성인\):\s*([\s\S]*?)<\/p>/) || [])[1] || "").match(/[\d,]+원/) || [])[0] || "";
    const childFare = (htmlText((html.match(/어린이:\s*([\s\S]*?)<\/p>/) || [])[1] || "").match(/[\d,]+원/) || [])[0] || "";
    const depName = stops[0]?.name || "";
    const arrName = stops[stops.length - 1]?.name || "인천공항";

    sendJson(res, 200, {
      source: company,
      searchedAt: new Date().toISOString(),
      busNo: route.busNo,
      routeLabel: route.label,
      company,
      companyUrl: route.sourceUrl,
      depName,
      arrName,
      majorStops: stops.slice(0, 7).map((stop) => stop.name),
      ...parseCaltSchedulesClean(html, company, depName, arrName, adultFare, childFare),
      weekendAirportDirection: [],
      weekendCityDirectionT2: [],
      weekendCityDirectionT1: []
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleKlimousineRoutes(req, res) {
  try {
    const { html } = await fetchKlimousinePage("/bus/limousine.php");
    sendJson(res, 200, { routes: parseKlimousineRoutes(html) });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleKlimousineSearch(req, res) {
  try {
    const busNo = String(req.searchParams.get("busNo") || "").trim().toUpperCase();
    if (!busNo) return sendJson(res, 400, { error: "버스번호가 필요합니다." });

    const { html, cookie } = await fetchKlimousinePage(`/bus/limousine.php?bus_no=${encodeURIComponent(busNo)}`);
    const info = parseKlimousineRoutePageClean(html, busNo);
    if (!info.stops.length) return sendJson(res, 404, { error: `${busNo}번 K리무진 시간표를 찾지 못했습니다.` });

    const company = "K리무진";
    const airportStop = info.incheonStops[0] || info.stops[0];
    const airportArr = info.incheonStops[info.incheonStops.length - 1] || { name: "인천공항" };
    const t2Stop = info.seoulStops.find((stop) => /2터미널|T2/i.test(stop.name)) || info.seoulStops[0] || info.stops[0];
    const t1Stop = info.seoulStops.find((stop) => /1터미널|T1/i.test(stop.name)) || info.seoulStops[1] || t2Stop;
    const cityArr = info.seoulStops[info.seoulStops.length - 1] || { name: info.depName };

    const [airportTimeHtml, cityT2TimeHtml, cityT1TimeHtml] = await Promise.all([
      airportStop?.id ? fetchKlimousineStationTime({ busNo, stationId: airportStop.id, direction: airportStop.direction, no: airportStop.no, cookie }) : Promise.resolve(""),
      t2Stop?.id ? fetchKlimousineStationTime({ busNo, stationId: t2Stop.id, direction: t2Stop.direction, no: t2Stop.no, cookie }) : Promise.resolve(""),
      t1Stop?.id ? fetchKlimousineStationTime({ busNo, stationId: t1Stop.id, direction: t1Stop.direction, no: t1Stop.no, cookie }) : Promise.resolve("")
    ]);

    sendJson(res, 200, {
      source: company,
      searchedAt: new Date().toISOString(),
      busNo,
      company,
      companyUrl: info.companyUrl,
      depName: info.depName,
      arrName: info.arrName,
      majorStops: info.incheonStops.slice(0, 7).map((stop) => stop.name),
      airportDirection: parseHourMinuteSchedule(airportTimeHtml, airportStop, airportArr.name, company, info.adultFare, info.childFare),
      cityDirectionT2: parseHourMinuteSchedule(cityT2TimeHtml, t2Stop, cityArr.name, company, info.adultFare, info.childFare),
      cityDirectionT1: parseHourMinuteSchedule(cityT1TimeHtml, t1Stop, cityArr.name, company, info.adultFare, info.childFare),
      weekendAirportDirection: [],
      weekendCityDirectionT2: [],
      weekendCityDirectionT1: []
    });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}



async function handleNaverPostWorker(request, res) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = String(body.accessToken || "").trim();
    const title = String(body.title || "").trim();
    const contents = String(body.contents || "").trim();
    const categoryNo = String(body.categoryNo || "").trim();
    if (!accessToken) return sendJson(res, 400, { error: "??? ?? ??? ?????." });
    if (!title || !contents) return sendJson(res, 400, { error: "??? ??? ?????." });
    const params = new URLSearchParams({ title, contents });
    if (categoryNo) params.set("categoryNo", categoryNo);
    const response = await fetch("https://openapi.naver.com/blog/writePost.json", { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: params });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (error) { data = { raw: text }; }
    if (!response.ok) return sendJson(res, response.status, { error: "??? ??? ?? ??? ??????.", detail: data });
    return sendJson(res, 200, data);
  } catch (error) {
    return sendJson(res, 502, { error: error.message });
  }
}

async function runApi(handler, req, request) {
  let status = 200;
  let headers = { "content-type": "application/json; charset=utf-8" };
  let body = "";
  const res = { writeHead(nextStatus, nextHeaders = {}) { status = nextStatus; headers = { ...headers, ...nextHeaders }; }, end(nextBody = "") { body = nextBody; } };
  await handler(request || req, res);
  return new Response(body, { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const req = { pathname: url.pathname, searchParams: url.searchParams, env };
    if (url.pathname === "/admin") {
      return env.ASSETS.fetch(new Request(new URL("/admin/index.html", url), request));
    }
    if (url.pathname === "/api/naver/post" && request.method === "POST") return runApi(handleNaverPostWorker, req, request);
    if (url.pathname === "/api/admin/login" && request.method === "POST") return runApi(handleAdminLoginWorker, req, request);
    if (url.pathname === "/api/admin/logout" && request.method === "POST") return runApi(handleAdminLogoutWorker, req, request);
    if (url.pathname === "/api/community/signup" && request.method === "POST") return runApi(handleCommunitySignupWorker, req, request);
    if (url.pathname === "/api/community/login" && request.method === "POST") return runApi(handleCommunityLoginWorker, req, request);
    if (url.pathname === "/api/community/posts" && request.method === "POST") return runApi(handleCommunityCreatePostWorker, req, request);
    if (url.pathname === "/api/community/comments" && request.method === "POST") return runApi(handleCommunityAddCommentWorker, req, request);
    if (url.pathname === "/api/community/rankings/score" && request.method === "POST") return runApi(handleCommunityRankingScoreWorker, req, request);
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    if (url.pathname === "/api/admin/status") return runApi(handleAdminStatusWorker, req, request);
    if (url.pathname === "/api/community/rankings") return runApi(handleCommunityRankingsWorker, req);
    if (url.pathname === "/api/community/posts") return runApi(handleCommunityPostsWorker, req);
    if (url.pathname === "/api/community/post") return runApi(handleCommunityPostWorker, req);
    if (url.pathname === "/api/terminals") return runApi(handleTerminals, req);
    if (url.pathname === "/api/destinations") return runApi(handleDestinations, req);
    if (url.pathname === "/api/search") return runApi(handleSearch, req);
    if (url.pathname === "/api/tmoney-intercity/terminals") return runApi(handleTmoneyIntercityTerminals, req);
    if (url.pathname === "/api/tmoney-intercity/destinations") return runApi(handleTmoneyIntercityDestinations, req);
    if (url.pathname === "/api/tmoney-intercity/search") return runApi(handleTmoneyIntercitySearch, req);
    if (url.pathname === "/api/kobus/terminals") return runApi(handleKobusTerminals, req);
    if (url.pathname === "/api/kobus/destinations") return runApi(handleKobusDestinations, req);
    if (url.pathname === "/api/kobus/search") return runApi(handleKobusPublicApiSearch, req);
    if (url.pathname === "/api/gumvit/scores") return runApi(handleGumvitScores, req);
    if (url.pathname === "/api/gumvit/result-days") return runApi(handleGumvitResultDays, req);
    if (url.pathname === "/api/gumvit/result-date") return runApi(handleGumvitResultDate, req);
    if (url.pathname === "/api/buspia/search") return runApi(handleBuspiaSearch, req);
    if (url.pathname === "/api/buspia/download") return runApi(handleBuspiaDownload, req);
    if (url.pathname === "/api/newsmile/search") return runApi(handleNewsmileSearch, req);
    if (url.pathname === "/api/newsmile/download") return runApi(handleNewsmileDownload, req);
    if (url.pathname === "/api/gwangju-bus/search") return runApi(handleGwangjuBusSearch, req);
    if (url.pathname === "/api/jeju-bus/search") return runApi(handleJejuBusSearch, req);
    if (url.pathname === "/api/busan-bus/search") return runApi(handleBusanBusSearch, req);
    if (url.pathname === "/api/incheon-bus/search") return runApi(handleIncheonBusSearch, req);
    if (url.pathname === "/api/ulsan-bus/search") return runApi(handleUlsanBusSearch, req);
    if (url.pathname === "/api/airport-limousine/search") return runApi(handleAirportLimousineSearch, req);
    if (url.pathname === "/api/airport-limousine/routes") return runApi(handleAirportLimousineRoutes, req);
    if (url.pathname === "/api/seoul-airbus/search") return runApi(handleSeoulAirbusSearch, req);
    if (url.pathname === "/api/seoul-airbus/routes") return runApi(handleSeoulAirbusRoutes, req);
    if (url.pathname === "/api/calt/search") return runApi(handleCaltSearch, req);
    if (url.pathname === "/api/calt/routes") return runApi(handleCaltRoutes, req);
    if (url.pathname === "/api/klimousine/search") return runApi(handleKlimousineSearch, req);
    if (url.pathname === "/api/klimousine/routes") return runApi(handleKlimousineRoutes, req);
    return env.ASSETS.fetch(request);
  }
};
