const http = require("http");
const { readFile, writeFile, mkdir } = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 3021);
const DB_FILE = path.join(__dirname, "data", "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const AMPLITUDE_DROP_THRESHOLD = 20;

/* ----------------------------- 演示数据（种子） ----------------------------- */

function buildSeed(now = new Date()) {
  const iso = (offsetMinutes) => new Date(now.getTime() - offsetMinutes * 60000).toISOString();

  // 1) 沿用既有演示钟表/调校/复测，再追加一条降幅 29 度的复测 -> 未确认预警
  const clockA = {
    id: "clock_demo",
    code: "CLK-1890-07",
    escapementType: "瑞士杠杆式",
    balanceFrequency: "18000vph",
    targetDailyRateSeconds: 20,
    note: "怀表机芯，走时偏快",
    createdAt: "2026-06-16T00:00:00.000Z"
  };
  const adjA = {
    id: "adjustment_demo",
    clockId: "clock_demo",
    currentDailyRateSeconds: 68,
    direction: "慢针方向",
    amount: "游丝快慢针向慢侧微调0.4格",
    note: "初次调校，先保守处理",
    createdAt: "2026-06-16T00:00:00.000Z"
  };
  const retestA1 = {
    id: "retest_demo",
    clockId: "clock_demo",
    adjustmentId: "adjustment_demo",
    testedAt: iso(48 * 60),
    dailyRateSeconds: 31,
    amplitude: 248,
    qualified: false,
    note: "仍偏快，振幅尚可"
  };
  const retestA2 = {
    id: "retest_demo_2",
    clockId: "clock_demo",
    adjustmentId: "adjustment_demo",
    testedAt: iso(3 * 60),
    dailyRateSeconds: 29,
    amplitude: 219,
    qualified: false,
    note: "摆幅明显下跌，疑似发条力矩不足"
  };
  const warnA = {
    id: "warning_demo_a",
    clockId: "clock_demo",
    retestId: "retest_demo_2",
    prevRetestId: "retest_demo",
    adjustmentId: "adjustment_demo",
    prevAmplitude: 248,
    amplitude: 219,
    amplitudeDrop: 29,
    createdAt: retestA2.testedAt,
    status: "open",
    confirmedAt: null,
    handler: "",
    note: "",
    clearedAt: null,
    clearAdjustmentId: null
  };

  // 2) 已确认预警的样例
  const clockB = {
    id: "clock_demo_b",
    code: "AT-7750-22",
    escapementType: "凸轮导柱轮计时码表",
    balanceFrequency: "28800vph",
    targetDailyRateSeconds: 15,
    note: "计时码表，保养后监测",
    createdAt: iso(96 * 60)
  };
  const adjB = {
    id: "adjustment_demo_b",
    clockId: "clock_demo_b",
    currentDailyRateSeconds: 22,
    direction: "快慢针方向",
    amount: "快慢针向快侧微调0.2格并检查摆夹板",
    note: "洗油保养后首次调校",
    createdAt: iso(96 * 60)
  };
  const retestB1 = {
    id: "retest_demo_b1",
    clockId: "clock_demo_b",
    adjustmentId: "adjustment_demo_b",
    testedAt: iso(72 * 60),
    dailyRateSeconds: 12,
    amplitude: 301,
    qualified: true,
    note: "状态良好"
  };
  const retestB2 = {
    id: "retest_demo_b2",
    clockId: "clock_demo_b",
    adjustmentId: "adjustment_demo_b",
    testedAt: iso(26 * 60),
    dailyRateSeconds: 14,
    amplitude: 272,
    qualified: true,
    note: "摆幅回落，继续观察"
  };
  const warnB = {
    id: "warning_demo_b",
    clockId: "clock_demo_b",
    retestId: "retest_demo_b2",
    prevRetestId: "retest_demo_b1",
    adjustmentId: "adjustment_demo_b",
    prevAmplitude: 301,
    amplitude: 272,
    amplitudeDrop: 29,
    createdAt: retestB2.testedAt,
    status: "confirmed",
    confirmedAt: iso(25 * 60),
    handler: "周师傅",
    note: "已检查发条盒，力矩输出正常，列入重点观察",
    clearedAt: null,
    clearAdjustmentId: null
  };

  // 3) 新调校后旧预警被清除（历史可查）、重新监测的样例
  const clockC = {
    id: "clock_demo_c",
    code: "PP-240Q-03",
    escapementType: "Gyromax 摆轮",
    balanceFrequency: "21600vph",
    targetDailyRateSeconds: 10,
    note: "珍珠陀机芯",
    createdAt: iso(120 * 60)
  };
  const adjC1 = {
    id: "adjustment_demo_c1",
    clockId: "clock_demo_c",
    currentDailyRateSeconds: 41,
    direction: "慢针方向",
    amount: "微调偏心螺丝 1/8 圈",
    note: "首轮调校",
    createdAt: iso(120 * 60)
  };
  const retestC1 = {
    id: "retest_demo_c1",
    clockId: "clock_demo_c",
    adjustmentId: "adjustment_demo_c1",
    testedAt: iso(110 * 60),
    dailyRateSeconds: 18,
    amplitude: 288,
    qualified: false,
    note: "摆幅正常"
  };
  const retestC2 = {
    id: "retest_demo_c2",
    clockId: "clock_demo_c",
    adjustmentId: "adjustment_demo_c1",
    testedAt: iso(90 * 60),
    dailyRateSeconds: 16,
    amplitude: 255,
    qualified: false,
    note: "摆幅大跌，检查轮系"
  };
  const warnC = {
    id: "warning_demo_c",
    clockId: "clock_demo_c",
    retestId: "retest_demo_c2",
    prevRetestId: "retest_demo_c1",
    adjustmentId: "adjustment_demo_c1",
    prevAmplitude: 288,
    amplitude: 255,
    amplitudeDrop: 33,
    createdAt: retestC2.testedAt,
    status: "cleared",
    confirmedAt: iso(88 * 60),
    handler: "李技师",
    note: "发现中心轮轴轻微磨损，安排更换后重新调校",
    clearedAt: iso(40 * 60),
    clearAdjustmentId: "adjustment_demo_c2"
  };
  const adjC2 = {
    id: "adjustment_demo_c2",
    clockId: "clock_demo_c",
    currentDailyRateSeconds: 16,
    direction: "快慢针方向",
    amount: "更换中心轮后重新洗油调校",
    note: "上一轮预警处理：更换磨损轮轴",
    createdAt: iso(40 * 60)
  };
  const retestC3 = {
    id: "retest_demo_c3",
    clockId: "clock_demo_c",
    adjustmentId: "adjustment_demo_c2",
    testedAt: iso(20 * 60),
    dailyRateSeconds: 7,
    amplitude: 296,
    qualified: true,
    note: "新调校周期：摆幅恢复，日差达标"
  };

  return {
    clocks: [clockA, clockB, clockC],
    adjustments: [adjA, adjB, adjC1, adjC2],
    retests: [retestA1, retestA2, retestB1, retestB2, retestC1, retestC2, retestC3],
    warnings: [warnA, warnB, warnC]
  };
}

const initialData = buildSeed();

const routes = [
  "GET /health",
  "GET /clocks",
  "POST /clocks",
  "GET /clocks/not-qualified",
  "GET /clocks/:id/history",
  "POST /clocks/:id/adjustments",
  "POST /clocks/:id/retests",
  "GET /clocks/:id/latest-retest",
  "GET /adjustments",
  "GET /retests",
  "GET /warnings",
  "POST /warnings/:id/confirm"
];

/* -------------------------------- 持久化层 -------------------------------- */

async function ensureDb() {
  await mkdir(path.dirname(DB_FILE), { recursive: true });
  try {
    const db = JSON.parse(await readFile(DB_FILE, "utf8"));
    if (!Array.isArray(db.warnings)) db.warnings = [];
    return db;
  } catch {
    await writeFile(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
}

async function readDb() {
  return ensureDb();
}

async function writeDb(data) {
  await writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

/* --------------------------------- 工具函数 -------------------------------- */

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

async function parseBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("请求体必须是合法JSON");
    error.status = 400;
    throw error;
  }
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function required(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === "");
  if (missing.length) {
    const error = new Error(`缺少字段：${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

function findClock(db, clockId) {
  const clock = db.clocks.find((item) => item.id === clockId);
  if (!clock) {
    const error = new Error("钟表不存在");
    error.status = 404;
    throw error;
  }
  return clock;
}

function retestsOf(db, clockId) {
  return db.retests
    .filter((item) => item.clockId === clockId)
    .sort((a, b) => new Date(a.testedAt) - new Date(b.testedAt) || a.id.localeCompare(b.id));
}

function latestRetest(db, clockId) {
  return retestsOf(db, clockId).at(-1) || null;
}

function latestAdjustment(db, clockId) {
  return db.adjustments
    .filter((item) => item.clockId === clockId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

function warningsOf(db, clockId) {
  return db.warnings.filter((item) => item.clockId === clockId);
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}天${hours}小时${mins}分`;
  if (hours > 0) return `${hours}小时${mins}分`;
  return `${mins}分钟`;
}

/**
 * 预警视图：所有对外结论都经过这里派生，保证列表/历史/刷新结论一致。
 * 排序：未确认(open) 在最前，其次已确认(confirmed)，最后已清除(cleared)；
 * 同状态内按触发时间倒序（新的在前）。
 */
function serializeWarning(db, warning, now = Date.now()) {
  const clock = db.clocks.find((item) => item.id === warning.clockId) || null;
  const retest = db.retests.find((item) => item.id === warning.retestId) || null;
  const prevRetest = db.retests.find((item) => item.id === warning.prevRetestId) || null;
  const clearAdjustment = warning.clearAdjustmentId
    ? db.adjustments.find((item) => item.id === warning.clearAdjustmentId) || null
    : null;

  let waitingMs = null;
  let waitingText = null;
  if (warning.status === "open") {
    waitingMs = Math.max(0, now - new Date(warning.createdAt).getTime());
    waitingText = formatDuration(waitingMs);
  }

  return {
    ...warning,
    clock: clock
      ? { id: clock.id, code: clock.code, escapementType: clock.escapementType, balanceFrequency: clock.balanceFrequency }
      : null,
    retest,
    prevRetest,
    clearAdjustment: clearAdjustment
      ? { id: clearAdjustment.id, amount: clearAdjustment.amount, createdAt: clearAdjustment.createdAt }
      : null,
    waitingMs,
    waitingText
  };
}

const WARNING_STATUS_RANK = { open: 0, confirmed: 1, cleared: 2 };

function warningList(db, { status, clockId, q } = {}) {
  const now = Date.now();
  const keyword = (q || "").trim().toLowerCase();
  return db.warnings
    .filter((warning) => {
      if (clockId && warning.clockId !== clockId) return false;
      if (status === "open" && warning.status !== "open") return false;
      if (status === "confirmed" && warning.status !== "confirmed") return false;
      if (status === "cleared" && warning.status !== "cleared") return false;
      // status=current（默认）：当期预警 = 未确认 + 已确认（尚未被新调校清除）
      if (!status || status === "current") {
        if (warning.status === "cleared") return false;
      }
      if (keyword) {
        const clock = db.clocks.find((item) => item.id === warning.clockId);
        const haystack = [
          clock?.code || "",
          warning.handler || "",
          warning.note || ""
        ].join(" ").toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const rankDiff = WARNING_STATUS_RANK[a.status] - WARNING_STATUS_RANK[b.status];
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .map((warning) => serializeWarning(db, warning, now));
}

function warningCounters(db) {
  const counters = { open: 0, confirmed: 0, cleared: 0 };
  for (const warning of db.warnings) counters[warning.status] += 1;
  return { ...counters, current: counters.open + counters.confirmed, total: db.warnings.length };
}

/**
 * 复测写入后的预警判定：
 * 与同一调校周期（adjustmentId 相同）内时间最近的上一次复测比较，
 * 最新复测振幅比前一次下降“超过”阈值（严格大于 20 度）即生成未确认预警。
 */
function maybeCreateWarning(db, clock, retest, prevRetest) {
  if (!prevRetest || prevRetest.adjustmentId !== retest.adjustmentId) return null;
  const drop = prevRetest.amplitude - retest.amplitude;
  if (!(drop > AMPLITUDE_DROP_THRESHOLD)) return null;
  const warning = {
    id: makeId("warning"),
    clockId: clock.id,
    retestId: retest.id,
    prevRetestId: prevRetest.id,
    adjustmentId: retest.adjustmentId,
    prevAmplitude: prevRetest.amplitude,
    amplitude: retest.amplitude,
    amplitudeDrop: drop,
    createdAt: retest.testedAt,
    status: "open",
    confirmedAt: null,
    handler: "",
    note: "",
    clearedAt: null,
    clearAdjustmentId: null
  };
  db.warnings.push(warning);
  return warning;
}

function clockSummary(db, clock) {
  const retest = latestRetest(db, clock.id);
  const adjustment = latestAdjustment(db, clock.id);
  const warnings = warningsOf(db, clock.id);
  const openWarnings = warnings.filter((item) => item.status === "open");
  const currentWarning = warningList(db, { clockId: clock.id })[0] || null;
  return {
    ...clock,
    latestAdjustment: adjustment,
    latestRetest: retest,
    qualified: retest ? retest.qualified : false,
    openWarningCount: openWarnings.length,
    currentWarningStatus: currentWarning ? currentWarning.status : null,
    warningCount: warnings.length
  };
}

/* --------------------------------- 路由处理 -------------------------------- */

async function handleApi(req, res, url, pathname) {
  const db = await readDb();

  if (req.method === "GET" && pathname === "/health") {
    return send(res, 200, { ok: true, service: "clock-stability-warning-console", routes });
  }

  if (req.method === "GET" && pathname === "/clocks") {
    const qualified = url.searchParams.get("qualified");
    let data = db.clocks.map((clock) => clockSummary(db, clock));
    if (qualified !== null) {
      const expected = qualified === "true";
      data = data.filter((clock) => clock.qualified === expected);
    }
    return send(res, 200, { data });
  }

  if (req.method === "POST" && pathname === "/clocks") {
    const body = await parseBody(req);
    required(body, ["code", "escapementType", "balanceFrequency"]);
    const clock = {
      id: makeId("clock"),
      code: body.code,
      escapementType: body.escapementType,
      balanceFrequency: body.balanceFrequency,
      targetDailyRateSeconds: Number(body.targetDailyRateSeconds ?? 30),
      note: body.note || "",
      createdAt: new Date().toISOString()
    };
    db.clocks.push(clock);
    await writeDb(db);
    return send(res, 201, { data: clockSummary(db, clock) });
  }

  if (req.method === "GET" && pathname === "/clocks/not-qualified") {
    const data = db.clocks.map((clock) => clockSummary(db, clock)).filter((clock) => !clock.qualified);
    return send(res, 200, { data });
  }

  const historyMatch = pathname.match(/^\/clocks\/([^/]+)\/history$/);
  if (historyMatch && req.method === "GET") {
    const clock = findClock(db, historyMatch[1]);
    const adjustments = db.adjustments
      .filter((item) => item.clockId === clock.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const retests = retestsOf(db, clock.id).reverse();
    const warnings = warningList(db, { clockId: clock.id, status: "all" });
    return send(res, 200, {
      data: {
        clock: clockSummary(db, clock),
        adjustments,
        retests,
        warnings,
        latestRetest: latestRetest(db, clock.id)
      }
    });
  }

  const adjustmentMatch = pathname.match(/^\/clocks\/([^/]+)\/adjustments$/);
  if (adjustmentMatch && req.method === "POST") {
    const clock = findClock(db, adjustmentMatch[1]);
    const body = await parseBody(req);
    required(body, ["currentDailyRateSeconds", "direction", "amount"]);
    const adjustment = {
      id: makeId("adjustment"),
      clockId: clock.id,
      currentDailyRateSeconds: Number(body.currentDailyRateSeconds),
      direction: body.direction,
      amount: body.amount,
      note: body.note || "",
      createdAt: body.createdAt || new Date().toISOString()
    };
    db.adjustments.push(adjustment);

    // 新调校写入：当期预警立即清除（旧预警保留为历史），从此进入新的监测周期
    const clearedWarnings = [];
    for (const warning of db.warnings) {
      if (warning.clockId === clock.id && warning.status !== "cleared") {
        warning.status = "cleared";
        warning.clearedAt = adjustment.createdAt;
        warning.clearAdjustmentId = adjustment.id;
        clearedWarnings.push(warning.id);
      }
    }

    await writeDb(db);
    return send(res, 201, {
      data: adjustment,
      clock: clockSummary(db, clock),
      clearedWarningIds: clearedWarnings
    });
  }

  const retestMatch = pathname.match(/^\/clocks\/([^/]+)\/retests$/);
  if (retestMatch && req.method === "POST") {
    const clock = findClock(db, retestMatch[1]);
    const body = await parseBody(req);
    required(body, ["dailyRateSeconds", "amplitude"]);
    const adjustmentId = body.adjustmentId || latestAdjustment(db, clock.id)?.id || null;
    const qualified = body.qualified !== undefined
      ? Boolean(body.qualified)
      : Math.abs(Number(body.dailyRateSeconds)) <= Number(clock.targetDailyRateSeconds);
    const retest = {
      id: makeId("retest"),
      clockId: clock.id,
      adjustmentId,
      testedAt: body.testedAt || new Date().toISOString(),
      dailyRateSeconds: Number(body.dailyRateSeconds),
      amplitude: Number(body.amplitude),
      qualified,
      note: body.note || ""
    };
    db.retests.push(retest);

    // 同周期上一次复测（以测试时间排序）
    const periodRetests = retestsOf(db, clock.id).filter((item) => item.adjustmentId === adjustmentId);
    const idx = periodRetests.findIndex((item) => item.id === retest.id);
    const prevRetest = idx > 0 ? periodRetests[idx - 1] : null;
    const warning = maybeCreateWarning(db, clock, retest, prevRetest);

    await writeDb(db);
    return send(res, 201, {
      data: retest,
      previousRetest: prevRetest,
      warning: warning ? serializeWarning(db, warning) : null,
      clock: clockSummary(db, clock)
    });
  }

  const latestMatch = pathname.match(/^\/clocks\/([^/]+)\/latest-retest$/);
  if (latestMatch && req.method === "GET") {
    findClock(db, latestMatch[1]);
    return send(res, 200, { data: latestRetest(db, latestMatch[1]) });
  }

  if (req.method === "GET" && pathname === "/adjustments") {
    const clockId = url.searchParams.get("clockId");
    return send(res, 200, { data: db.adjustments.filter((item) => !clockId || item.clockId === clockId) });
  }

  if (req.method === "GET" && pathname === "/retests") {
    const clockId = url.searchParams.get("clockId");
    const qualified = url.searchParams.get("qualified");
    const data = db.retests.filter((item) => {
      const matchClock = !clockId || item.clockId === clockId;
      const matchQualified = qualified === null || item.qualified === (qualified === "true");
      return matchClock && matchQualified;
    });
    return send(res, 200, { data });
  }

  // 预警列表：status=current(默认)/open/confirmed/cleared/all，支持 clockId 与关键字 q
  if (req.method === "GET" && pathname === "/warnings") {
    const status = url.searchParams.get("status") || "current";
    const clockId = url.searchParams.get("clockId");
    const q = url.searchParams.get("q");
    return send(res, 200, {
      data: warningList(db, { status, clockId, q }),
      counters: warningCounters(db)
    });
  }

  // 确认预警：同一预警只能确认一次
  const confirmMatch = pathname.match(/^\/warnings\/([^/]+)\/confirm$/);
  if (confirmMatch && req.method === "POST") {
    const warning = db.warnings.find((item) => item.id === confirmMatch[1]);
    if (!warning) {
      return send(res, 404, { error: "预警不存在" });
    }
    if (warning.status === "cleared") {
      return send(res, 409, { error: "该预警已随新调校清除，只能在历史中查看", data: serializeWarning(db, warning) });
    }
    if (warning.status === "confirmed") {
      return send(res, 409, { error: "该预警已确认，同一预警只能确认一次", data: serializeWarning(db, warning) });
    }
    const body = await parseBody(req);
    required(body, ["handler"]);
    warning.status = "confirmed";
    warning.handler = String(body.handler).trim();
    warning.note = body.note || "";
    warning.confirmedAt = new Date().toISOString();
    await writeDb(db);
    return send(res, 200, { data: serializeWarning(db, warning) });
  }

  return send(res, 404, { error: "接口不存在", routes });
}

/* ------------------------------- 静态页面托管 ------------------------------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("页面不存在");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  if (pathname.startsWith("/api")) {
    handleApi(req, res, url, pathname.replace(/^\/api/, "") || "/").catch((error) =>
      send(res, error.status || 500, { error: error.message || "服务器错误" })
    );
    return;
  }
  if (
    pathname === "/health" ||
    pathname.startsWith("/clocks") ||
    pathname.startsWith("/adjustments") ||
    pathname.startsWith("/retests") ||
    pathname.startsWith("/warnings")
  ) {
    handleApi(req, res, url, pathname).catch((error) =>
      send(res, error.status || 500, { error: error.message || "服务器错误" })
    );
    return;
  }
  serveStatic(req, res, pathname);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`钟表稳定性预警台运行中：http://127.0.0.1:${PORT}`);
  });
}

module.exports = { buildSeed, AMPLITUDE_DROP_THRESHOLD };
