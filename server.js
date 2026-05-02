const fs = require("fs/promises");
const http = require("http");
const path = require("path");

const PORT = process.env.PORT || 3000;
const BUSTAGO_ORIGIN = "https://www.bustago.or.kr";
const PUBLIC_DIR = path.join(__dirname, "public");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        request.destroy();
        reject(new Error("요청 본문이 너무 큽니다."));
      }
    });
    request.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("JSON 요청만 처리할 수 있습니다."));
      }
    });
    request.on("error", reject);
  });
}

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
  const response = await fetch(`${BUSTAGO_ORIGIN}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
      referer: `${BUSTAGO_ORIGIN}/newweb/kr/ticket/ticket.do`,
      cookie
    },
    body: new URLSearchParams(params)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`버스타고 응답 오류 ${response.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text.trim());
  } catch (error) {
    throw new Error(`버스타고 응답을 해석할 수 없습니다: ${text.slice(0, 200)}`);
  }
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function handleTerminals(req, res) {
  try {
    const keyword = String(req.searchParams.get("q") || "").trim();
    if (!keyword) return sendJson(res, 200, { terminals: [] });
    const data = await bustagoFetch("/newweb/kr/common/terminalListAjax.do", {
      area: "",
      searchTerminalNm: keyword
    });
    const terminals = (data.terminalList || [])
      .filter((item) => terminalMatches(item, keyword))
      .map(normalizeTerminal)
      .slice(0, 30);
    sendJson(res, 200, { terminals });
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleDestinations(req, res) {
  try {
    const depTerId = String(req.searchParams.get("depTerId") || "").trim();
    const keyword = String(req.searchParams.get("q") || "").trim();
    if (!depTerId) return sendJson(res, 400, { error: "출발지 터미널 코드가 필요합니다." });
    const data = await bustagoFetch("/newweb/kr/common/terminalEndListAjax.do", {
      area: "",
      country: "",
      terCode: depTerId
    });
    const destinations = (data.terminalEndList || [])
      .filter((item) => !keyword || terminalMatches(item, keyword))
      .map(normalizeTerminal)
      .slice(0, 50);
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

async function handleNaverPost(request, res) {
  try {
    const body = await readJsonBody(request);
    const accessToken = String(body.accessToken || process.env.NAVER_ACCESS_TOKEN || "").trim();
    const title = String(body.title || "").trim();
    const contents = String(body.contents || "").trim();
    const categoryNo = String(body.categoryNo || "").trim();
    if (!accessToken) return sendJson(res, 400, { error: "네이버 접근 토큰이 필요합니다." });
    if (!title || !contents) return sendJson(res, 400, { error: "제목과 본문이 필요합니다." });
    const params = new URLSearchParams({ title, contents });
    if (categoryNo) params.set("categoryNo", categoryNo);
    const response = await fetch("https://openapi.naver.com/blog/writePost.json", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: params
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { raw: text };
    }
    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "네이버 블로그 자동 게시가 실패했습니다. 토큰 권한 또는 API 제공 여부를 확인해 주세요.",
        detail: data
      });
    }
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function handleNaverStaticMap(req, res) {
  try {
    const keyId = String(req.searchParams.get("keyId") || process.env.NAVER_MAP_CLIENT_ID || "").trim();
    const keySecret = String(req.searchParams.get("keySecret") || process.env.NAVER_MAP_CLIENT_SECRET || "").trim();
    const center = String(req.searchParams.get("center") || "").trim();
    const level = String(req.searchParams.get("level") || "11").trim();
    const dep = String(req.searchParams.get("dep") || "").trim();
    const arr = String(req.searchParams.get("arr") || "").trim();
    if (!keyId || !keySecret) return sendJson(res, 400, { error: "네이버 지도 Client ID와 Client Secret이 필요합니다." });
    if (!center || !dep || !arr) return sendJson(res, 400, { error: "지도 중심 좌표와 출발/도착 좌표가 필요합니다." });
    const params = new URLSearchParams({
      w: "900",
      h: "520",
      center,
      level,
      format: "png",
      scale: "1",
      maptype: "basic"
    });
    params.append("markers", `type:n|size:mid|label:S|pos:${dep}|color:blue`);
    params.append("markers", `type:n|size:mid|label:E|pos:${arr}|color:red`);
    const response = await fetch(`https://naveropenapi.apigw.ntruss.com/map-static/v2/raster?${params.toString()}`, {
      headers: {
        "x-ncp-apigw-api-key-id": keyId,
        "x-ncp-apigw-api-key": keySecret
      }
    });
    if (!response.ok) {
      const text = await response.text();
      return sendJson(res, response.status, {
        error: "네이버 지도 이미지를 가져오지 못했습니다.",
        detail: text.slice(0, 300)
      });
    }
    const arrayBuffer = await response.arrayBuffer();
    res.writeHead(200, {
      "content-type": response.headers.get("content-type") || "image/png",
      "cache-control": "no-store"
    });
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    sendJson(res, 502, { error: error.message });
  }
}

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(req.pathname === "/" ? "/index.html" : req.pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const content = await fs.readFile(filePath);
    const type = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(content);
  } catch (error) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const req = { pathname: url.pathname, searchParams: url.searchParams };
  if (url.pathname === "/api/naver/post" && request.method === "POST") return handleNaverPost(request, response);
  if (request.method !== "GET") {
    response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }
  if (url.pathname === "/api/terminals") return handleTerminals(req, response);
  if (url.pathname === "/api/destinations") return handleDestinations(req, response);
  if (url.pathname === "/api/search") return handleSearch(req, response);
  if (url.pathname === "/api/naver/static-map") return handleNaverStaticMap(req, response);
  return serveStatic(req, response);
});

server.listen(PORT, () => {
  console.log(`Bustago blog helper is running on http://localhost:${PORT}`);
});
