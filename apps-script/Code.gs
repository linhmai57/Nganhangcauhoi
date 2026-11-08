/**
 * KHOA Y – LUYỆN THI ĐÁNH GIÁ NĂNG LỰC (bản Google Apps Script)
 *
 * Dữ liệu nằm trong Google Sheet chứa script này:
 *   CauHoi  – ngân hàng câu hỏi (mỗi câu một dòng)
 *   TrongSo – trọng số QĐ 22/QĐ-HĐYKQG theo hệ cơ quan (HE) và miền năng lực (NANGLUC)
 *   CaiDat  – số câu, thời gian, tên miền email, giới hạn số đề/ngày
 *   TienDo  – (tự tạo) bài đang làm, câu đã gặp của từng sinh viên
 *   KetQua  – (tự tạo) kết quả và phân tích năng lực mỗi đợt
 *
 * Bảo mật: trình duyệt chỉ nhận câu hỏi KHÔNG kèm đáp án. Đáp án/giải thích chỉ được gửi
 * sau khi nộp câu (Practice) hoặc nộp bài (Real-time). Chỉ email thuộc tên miền trường dùng được.
 */

const SHEET_Q = 'CauHoi';
const SHEET_W = 'TrongSo';
const SHEET_CFG = 'CaiDat';
const SHEET_P = 'TienDo';
const SHEET_R = 'KetQua';
const CACHE_TTL = 21600; // 6 giờ (tối đa của CacheService)
const LETTERS = 'ABCD';

const SUBS = {
  KHCB: [['KHCB', 'Áp dụng khái niệm Khoa học cơ bản']],
  CD: [['BS', 'Bệnh sử / Thăm khám thực thể'], ['CLS', 'Cận lâm sàng / XN chẩn đoán'],
       ['CDX', 'Chẩn đoán'], ['TL', 'Tiên lượng / Kết cục']],
  XT: [['PB', 'Duy trì sức khỏe / Phòng bệnh'], ['THUOC', 'Liệu pháp thuốc'],
       ['CT', 'Can thiệp lâm sàng'], ['PH', 'Xử trí phối hợp']],
  HTCT: [['HTCT', 'Học tập và cải thiện dựa trên thực hành']],
  GT: [['GT', 'Giao tiếp và tính chuyên nghiệp']],
  HT: [['HT', 'Thực hành dựa trên hệ thống và an toàn bệnh nhân']]
};

/* ======================= Trang web & menu ======================= */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Khoa Y – Luyện thi đánh giá năng lực')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Luyện thi')
    .addItem('Làm mới dữ liệu sau khi sửa câu hỏi', 'clearBankCache')
    .addItem('Kiểm tra ngân hàng câu hỏi', 'checkBank')
    .addToUi();
}

// Sửa trực tiếp trên các trang CauHoi/TrongSo/CaiDat thì xóa bộ nhớ đệm để web dùng dữ liệu mới
function onEdit(e) {
  try {
    const name = e && e.range && e.range.getSheet().getName();
    if ([SHEET_Q, SHEET_W, SHEET_CFG].indexOf(name) >= 0) clearBankCache();
  } catch (err) { /* bỏ qua */ }
}

function clearBankCache() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('bank_n') || 0);
  const keys = ['bank_n'];
  for (let i = 0; i < n; i++) keys.push('bank_' + i);
  cache.removeAll(keys);
  BANK_MEMO = null;
}

function checkBank() {
  clearBankCache();
  const b = getBank_();
  const plan = planCounts_(b, b.cfg.examTotal);
  const msg = 'Đã đọc ' + b.list.length + ' câu hỏi.\n' +
    'Đề Real-time ' + b.cfg.examTotal + ' câu: ' + (plan.exact ? 'đủ câu để khớp tỉ lệ QĐ 22.' : 'KHÔNG đủ câu để khớp tuyệt đối tỉ lệ.') +
    (b.errors.length ? '\n\nDòng lỗi (bị bỏ qua):\n' + b.errors.slice(0, 20).join('\n') : '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/* ======================= Đọc dữ liệu ======================= */

let BANK_MEMO = null;

function getBank_() {
  if (BANK_MEMO) return BANK_MEMO;
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('bank_n') || 0);
  if (n) {
    const keys = [];
    for (let i = 0; i < n; i++) keys.push('bank_' + i);
    const parts = cache.getAll(keys);
    if (keys.every(function (k) { return parts[k] != null; })) {
      BANK_MEMO = indexBank_(JSON.parse(keys.map(function (k) { return parts[k]; }).join('')));
      return BANK_MEMO;
    }
  }
  const raw = readBankFromSheet_();
  const json = JSON.stringify(raw);
  const CH = 25000; // mỗi khóa cache tối đa 100KB
  const put = {};
  let i = 0;
  for (let p = 0; p < json.length; p += CH, i++) put['bank_' + i] = json.slice(p, p + CH);
  try {
    cache.putAll(put, CACHE_TTL);
    cache.put('bank_n', String(i), CACHE_TTL);
  } catch (e) { /* cache đầy: vẫn chạy bình thường */ }
  BANK_MEMO = indexBank_(raw);
  return BANK_MEMO;
}

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh && header) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  }
  if (!sh) throw new Error('Không tìm thấy trang "' + name + '" trong Google Sheet.');
  return sh;
}

function readBankFromSheet_() {
  // Cài đặt
  const cfgRows = sheet_(SHEET_CFG).getDataRange().getValues().slice(1);
  const kv = {};
  cfgRows.forEach(function (r) { if (r[0]) kv[String(r[0]).trim()] = r[1]; });
  const num = function (k, d) { const v = Number(kv[k]); return isFinite(v) && kv[k] !== '' ? v : d; };
  const cfg = {
    examTotal: num('SO_CAU_REALTIME', 120),
    minutes: num('THOI_GIAN_PHUT', 180),
    practiceTotal: num('SO_CAU_PRACTICE', 40),
    domain: String(kv.TEN_MIEN_EMAIL || '').trim().toLowerCase().replace(/^@/, ''),
    examPerDay: num('GIOI_HAN_REALTIME_NGAY', 0),
    practicePerDay: num('GIOI_HAN_PRACTICE_NGAY', 0)
  };
  // Trọng số
  const systems = [], comps = [];
  sheet_(SHEET_W).getDataRange().getValues().slice(1).forEach(function (r) {
    const type = String(r[0]).trim().toUpperCase();
    const item = { id: String(r[1]).trim(), name: String(r[2]).trim(), min: Number(r[3]), max: Number(r[4]) };
    if (!item.id) return;
    if (type === 'HE') systems.push(item);
    else if (type === 'NANGLUC') comps.push(item);
  });
  // Câu hỏi
  const values = sheet_(SHEET_Q).getDataRange().getValues();
  const head = values[0].map(function (h) { return String(h).trim(); });
  const col = {};
  head.forEach(function (h, i) { col[h] = i; });
  ['ID', 'Nhom', 'NangLuc', 'TinhHuong', 'A', 'B', 'DapAn'].forEach(function (h) {
    if (col[h] == null) throw new Error('Trang CauHoi thiếu cột "' + h + '".');
  });
  const get = function (r, h) { return col[h] == null ? '' : String(r[col[h]] == null ? '' : r[col[h]]).trim(); };
  const list = [], errors = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    let id = get(r, 'ID');
    if (!id) continue;
    if (/^\d+$/.test(id)) id = ('0000' + id).slice(-Math.max(4, id.length));
    const options = LETTERS.split('').map(function (L) { return get(r, L); }).filter(function (x) { return x; });
    const answer = get(r, 'DapAn').toUpperCase().charAt(0);
    if (options.length < 2 || LETTERS.indexOf(answer) < 0 || LETTERS.indexOf(answer) >= options.length) {
      errors.push('Dòng ' + (i + 1) + ' (ID ' + id + '): thiếu phương án hoặc đáp án.');
      continue;
    }
    const d = {};
    LETTERS.split('').slice(0, options.length).forEach(function (L) {
      if (L !== answer) d[L] = get(r, 'LyDo_' + L);
    });
    list.push({
      id: id, g: get(r, 'Nhom'), p: get(r, 'SoVanDe'), pn: get(r, 'VanDe'),
      c: get(r, 'NangLuc').toUpperCase(), s: get(r, 'TieuMuc').toUpperCase(),
      stem: get(r, 'TinhHuong').split(/\n+/).filter(function (x) { return x.trim(); }),
      options: options, answer: answer, ex: { r: get(r, 'LapLuan'), d: d }
    });
  }
  return { cfg: cfg, systems: systems, comps: comps, list: list, errors: errors };
}

function indexBank_(raw) {
  const byId = {}, pool = {};
  raw.list.forEach(function (q) {
    byId[q.id] = q;
    const key = q.g + '|' + q.c;
    (pool[key] = pool[key] || []).push(q.id);
  });
  raw.byId = byId;
  raw.pool = pool;
  return raw;
}

/* ======================= Tạo đề theo QĐ 22 ======================= */

// Chia total câu theo trọng số trung bình (min+max)/2, nằm trong [min%, max%];
// đề ngắn: khoảng nới về số nguyên gần nhất, mục có min > 0 luôn có ít nhất 1 câu.
function apportion_(items, total) {
  const mids = items.map(function (it) { return (it.min + it.max) / 2; });
  const sumMid = mids.reduce(function (a, b) { return a + b; }, 0) || 1;
  const quota = mids.map(function (m) { return m / sumMid * total; });
  const floor1 = items.map(function (it) { return it.min > 0 ? 1 : 0; });
  const lo = [], hi = [];
  items.forEach(function (it, i) {
    let l = Math.ceil(it.min * total / 100 - 1e-9), h = Math.floor(it.max * total / 100 + 1e-9);
    if (l > h) { l = Math.floor(it.min * total / 100); h = Math.ceil(it.max * total / 100); }
    lo.push(Math.max(floor1[i], l));
    hi.push(Math.max(floor1[i], h));
  });
  const counts = quota.map(function (q, i) { return Math.min(hi[i], Math.max(lo[i], Math.floor(q))); });
  let diff = total - counts.reduce(function (a, b) { return a + b; }, 0);
  let guard = 1000;
  while (diff !== 0 && guard--) {
    const up = diff > 0;
    const score = function (i) { return up ? quota[i] - counts[i] : counts[i] - quota[i]; };
    let best = -1;
    for (let i = 0; i < items.length; i++) {
      if ((up ? counts[i] < hi[i] : counts[i] > lo[i]) && (best < 0 || score(i) > score(best))) best = i;
    }
    if (best < 0) {
      for (let i = 0; i < items.length; i++) {
        if (!up && counts[i] <= floor1[i]) continue;
        if (best < 0 || score(i) > score(best)) best = i;
      }
    }
    if (best < 0) break;
    counts[best] += up ? 1 : -1;
    diff += up ? -1 : 1;
  }
  return counts;
}

function shuffle_(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Luồng cực đại: số câu mỗi ô (hệ, năng lực) khớp đồng thời tổng hàng và tổng cột
function planCounts_(b, total) {
  const S = b.systems, C = b.comps;
  const sys = apportion_(S, total), comp = apportion_(C, total);
  const n = S.length + C.length + 2, src = 0, sink = n - 1;
  const cap = [];
  for (let i = 0; i < n; i++) { cap.push([]); for (let j = 0; j < n; j++) cap[i].push(0); }
  S.forEach(function (s, i) {
    cap[src][1 + i] = sys[i];
    C.forEach(function (c, j) { cap[1 + i][1 + S.length + j] = (b.pool[s.id + '|' + c.id] || []).length; });
  });
  C.forEach(function (c, j) { cap[1 + S.length + j][sink] = comp[j]; });
  const orig = cap.map(function (r) { return r.slice(); });
  const nodes = []; for (let i = 0; i < n; i++) nodes.push(i);
  let flow = 0;
  for (;;) {
    const prev = nodes.map(function () { return -1; });
    prev[src] = src;
    const queue = [src];
    while (queue.length && prev[sink] < 0) {
      const u = queue.shift();
      shuffle_(nodes).forEach(function (v) { if (prev[v] < 0 && cap[u][v] > 0) { prev[v] = u; queue.push(v); } });
    }
    if (prev[sink] < 0) break;
    let f = Infinity;
    for (let v = sink; v !== src; v = prev[v]) f = Math.min(f, cap[prev[v]][v]);
    for (let v = sink; v !== src; v = prev[v]) { cap[prev[v]][v] -= f; cap[v][prev[v]] += f; }
    flow += f;
  }
  const x = S.map(function (s, i) {
    return C.map(function (c, j) { return orig[1 + i][1 + S.length + j] - cap[1 + i][1 + S.length + j]; });
  });
  S.forEach(function (s, i) { // kho không đủ: vẫn giữ đúng số câu theo hệ
    let rem = sys[i] - x[i].reduce(function (a, b2) { return a + b2; }, 0);
    shuffle_(C.map(function (c, j) { return j; })).forEach(function (j) {
      while (rem > 0 && x[i][j] < orig[1 + i][1 + S.length + j]) { x[i][j]++; rem--; }
    });
  });
  return { sys: sys, comp: comp, x: x, exact: flow === total };
}

function buildTest_(b, total, seenList) {
  const plan = planCounts_(b, total);
  const seen = {};
  (seenList || []).forEach(function (id) { seen[id] = 1; });
  let ids = [];
  b.systems.forEach(function (s, i) {
    b.comps.forEach(function (c, j) {
      const k = plan.x[i][j];
      if (!k) return;
      const pool = shuffle_(b.pool[s.id + '|' + c.id] || []);
      pool.sort(function (a, z) { return (seen[a] ? 1 : 0) - (seen[z] ? 1 : 0); }); // ưu tiên câu chưa gặp
      ids = ids.concat(pool.slice(0, k));
    });
  });
  ids = shuffle_(ids);
  let newSeen = (seenList || []).concat(ids.filter(function (id) { return !seen[id]; }));
  if (newSeen.length >= b.list.length) newSeen = ids.slice();
  return { ids: ids, seen: newSeen };
}

/* ======================= Người dùng & lưu trữ ======================= */

const P_HEAD = ['Email', 'RealTime', 'Practice', 'DaGap', 'DemDe', 'CapNhat'];
const R_HEAD = ['Thời gian', 'Email', 'Chế độ', 'Số câu', 'Đã làm', 'Đúng', 'Sai', 'Bỏ trống', 'Điểm (thang 10)',
  'Thời gian làm (phút)', 'Tự nộp do hết giờ'];

function requireUser_(b) {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw new Error('Không xác định được tài khoản. Vui lòng đăng nhập bằng email trường.');
  if (b.cfg.domain && !email.endsWith('@' + b.cfg.domain)) {
    throw new Error('Tài khoản ' + email + ' không được phép. Vui lòng đăng nhập bằng email @' + b.cfg.domain + '.');
  }
  return email;
}

function loadUser_(email) {
  const sh = sheet_(SHEET_P, P_HEAD);
  let row = 0;
  const found = sh.getRange('A:A').createTextFinder(email).matchEntireCell(true).findNext();
  if (found) row = found.getRow();
  const u = { email: email, row: row, exam: null, practice: null, seen: [], count: {} };
  if (row) {
    const v = sh.getRange(row, 1, 1, P_HEAD.length).getValues()[0];
    const parse = function (s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
    u.exam = parse(v[1], null);
    u.practice = parse(v[2], null);
    u.seen = parse(v[3], []);
    u.count = parse(v[4], {});
  }
  return u;
}

function saveUser_(u) {
  const sh = sheet_(SHEET_P, P_HEAD);
  const vals = [[u.email, JSON.stringify(u.exam || null), JSON.stringify(u.practice || null),
    JSON.stringify(u.seen || []), JSON.stringify(u.count || {}), new Date()]];
  if (!u.row) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const found = sh.getRange('A:A').createTextFinder(u.email).matchEntireCell(true).findNext();
      if (found) u.row = found.getRow();
      else { sh.appendRow(vals[0]); u.row = sh.getLastRow(); return; }
    } finally { lock.releaseLock(); }
  }
  sh.getRange(u.row, 1, 1, P_HEAD.length).setValues(vals);
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
}

function quotaLeft_(b, u, mode) {
  const limit = mode === 'exam' ? b.cfg.examPerDay : b.cfg.practicePerDay;
  if (!limit) return null;
  const used = u.count.d === today_() ? (u.count[mode] || 0) : 0;
  return Math.max(0, limit - used);
}

function useQuota_(b, u, mode) {
  const left = quotaLeft_(b, u, mode);
  if (left === 0) {
    throw new Error('Bạn đã dùng hết số ' + (mode === 'exam' ? 'đề Real-time' : 'đợt Practice') +
      ' cho hôm nay. Vui lòng quay lại vào ngày mai.');
  }
  if (u.count.d !== today_()) u.count = { d: today_() };
  u.count[mode] = (u.count[mode] || 0) + 1;
}

/* ======================= Dữ liệu gửi cho trình duyệt ======================= */

// Câu hỏi KHÔNG kèm đáp án/giải thích
function publicQ_(q) {
  return { id: q.id, stem: q.stem, options: q.options };
}

function fullQ_(b, q) {
  const sys = b.systems.filter(function (s) { return s.id === q.g; })[0];
  return {
    id: q.id, stem: q.stem, options: q.options, answer: q.answer, ex: q.ex,
    g: q.g, gName: sys ? sys.name : q.g, pName: q.pn, c: q.c, s: q.s
  };
}

function statusOf_(state, mode, q) {
  const done = mode === 'exam' ? !!state.answers[q.id] : !!(state.submitted && state.submitted[q.id]);
  if (!done) return 'blank';
  return state.answers[q.id] === q.answer ? 'correct' : 'wrong';
}

function review_(b, state, mode) {
  const items = state.ids.filter(function (id) { return b.byId[id]; }).map(function (id) {
    const q = b.byId[id];
    const it = fullQ_(b, q);
    it.chosen = state.answers[id] || null;
    it.status = statusOf_(state, mode, q);
    return it;
  });
  return { mode: mode, items: items, result: state.result || null };
}

function finishResult_(b, u, state, mode, timeout) {
  const ids = state.ids.filter(function (id) { return b.byId[id]; });
  let correct = 0, wrong = 0, blank = 0;
  ids.forEach(function (id) {
    const st = statusOf_(state, mode, b.byId[id]);
    if (st === 'correct') correct++; else if (st === 'wrong') wrong++; else blank++;
  });
  const now = Date.now();
  const finishedAt = mode === 'exam' ? Math.min(now, state.endAt) : now;
  state.result = {
    total: ids.length, correct: correct, wrong: wrong, blank: blank,
    finishedAt: finishedAt, usedMs: finishedAt - state.startAt, timeout: !!timeout
  };
  // Ghi kết quả + tỉ lệ đúng theo miền năng lực
  const dom = {};
  ids.forEach(function (id) {
    const q = b.byId[id];
    const st = statusOf_(state, mode, q);
    const r = dom[q.c] = dom[q.c] || { n: 0, correct: 0, done: 0 };
    r.n++;
    if (st !== 'blank') r.done++;
    if (st === 'correct') r.correct++;
  });
  const sh = sheet_(SHEET_R, R_HEAD.concat(b.comps.map(function (c) { return c.name + ' (%)'; })));
  const row = [new Date(finishedAt), u.email, mode === 'exam' ? 'Real-time' : 'Practice', ids.length,
    correct + wrong, correct, wrong, blank, ids.length ? Math.round(correct / ids.length * 1000) / 100 : 0,
    Math.round(state.result.usedMs / 600) / 100, timeout ? 'Có' : ''];
  b.comps.forEach(function (c) {
    const r = dom[c.id];
    const denom = r ? (mode === 'exam' ? r.n : r.done) : 0;
    row.push(denom ? Math.round(r.correct / denom * 1000) / 10 : '');
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { sh.appendRow(row); } finally { lock.releaseLock(); }
}

/* ======================= API cho trang web ======================= */

function api_home() {
  const b = getBank_();
  const email = requireUser_(b);
  const u = loadUser_(email);
  let changed = false;
  if (u.exam && !u.exam.submitted && Date.now() >= u.exam.endAt) { // hết giờ khi đang rời trang
    u.exam.submitted = true;
    finishResult_(b, u, u.exam, 'exam', true);
    changed = true;
  }
  if (changed) saveUser_(u);
  const big = planCounts_(b, b.cfg.examTotal), small = planCounts_(b, b.cfg.practiceTotal);
  const ex = u.exam, pr = u.practice;
  return {
    email: email,
    bankSize: b.list.length,
    cfg: { examTotal: b.cfg.examTotal, minutes: b.cfg.minutes, practiceTotal: b.cfg.practiceTotal },
    systems: b.systems, comps: b.comps, subs: SUBS,
    plan: { examSys: big.sys, examComp: big.comp, practiceSys: small.sys, practiceComp: small.comp },
    exam: !ex ? { status: 'none' } : ex.submitted
      ? { status: 'done', result: ex.result }
      : { status: 'running', leftMs: ex.endAt - Date.now() },
    practice: !pr ? { status: 'none' } : pr.finished
      ? { status: 'done', result: pr.result }
      : { status: 'running', done: Object.keys(pr.submitted || {}).length, total: pr.ids.length },
    quota: { exam: quotaLeft_(b, u, 'exam'), practice: quotaLeft_(b, u, 'practice') }
  };
}

/* ----- Real-time ----- */

function examView_(b, u) {
  const s = u.exam;
  return {
    questions: s.ids.filter(function (id) { return b.byId[id]; }).map(function (id) { return publicQ_(b.byId[id]); }),
    answers: s.answers, flags: s.flags || {}, current: s.current || 0,
    endAt: s.endAt, now: Date.now()
  };
}

function api_startExam() {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  useQuota_(b, u, 'exam');
  const t = buildTest_(b, b.cfg.examTotal, u.seen);
  const now = Date.now();
  u.seen = t.seen;
  u.exam = { ids: t.ids, answers: {}, flags: {}, current: 0, startAt: now,
    endAt: now + b.cfg.minutes * 60000, submitted: false };
  saveUser_(u);
  return examView_(b, u);
}

function api_getExam() {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  if (!u.exam || u.exam.submitted) return { finished: true };
  if (Date.now() >= u.exam.endAt) return api_submitExam(null, null, null);
  return examView_(b, u);
}

function cleanAnswers_(b, state, answers) {
  const out = {};
  Object.keys(answers || {}).forEach(function (id) {
    const q = b.byId[id];
    const L = String(answers[id] || '').toUpperCase();
    if (q && state.ids.indexOf(id) >= 0 && LETTERS.indexOf(L) >= 0 && LETTERS.indexOf(L) < q.options.length) out[id] = L;
  });
  return out;
}

function api_saveExam(answers, flags, current) {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  const s = u.exam;
  if (!s || s.submitted) return { finished: true };
  if (Date.now() > s.endAt + 30000) return { expired: true }; // quá giờ: không nhận thêm đáp án
  s.answers = cleanAnswers_(b, s, answers);
  s.flags = flags || {};
  s.current = Number(current) || 0;
  saveUser_(u);
  return { ok: true, now: Date.now() };
}

function api_submitExam(answers, flags, current) {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  const s = u.exam;
  if (!s) throw new Error('Không có bài thi.');
  if (!s.submitted) {
    // Chỉ nhận đáp án gửi kèm nếu còn trong thời gian (cho phép trễ 30 giây do đường truyền)
    if (answers && Date.now() <= s.endAt + 30000) s.answers = cleanAnswers_(b, s, answers);
    if (flags) s.flags = flags;
    s.submitted = true;
    finishResult_(b, u, s, 'exam', Date.now() >= s.endAt);
    saveUser_(u);
  }
  return review_(b, s, 'exam');
}

/* ----- Practice ----- */

function practiceView_(b, u) {
  const s = u.practice;
  const id = s.ids[s.current];
  const q = b.byId[id];
  const view = {
    index: s.current, total: s.ids.length,
    question: publicQ_(q),
    statuses: s.ids.map(function (x) {
      if (!s.submitted[x] || !b.byId[x]) return '';
      return s.answers[x] === b.byId[x].answer ? 'c' : 'w';
    })
  };
  if (s.submitted[id]) { // đã nộp câu này (tải lại trang): trả kèm đáp án
    view.chosen = s.answers[id];
    view.answer = q.answer;
    view.ex = q.ex;
  }
  return view;
}

function api_startPractice() {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  useQuota_(b, u, 'practice');
  const t = buildTest_(b, b.cfg.practiceTotal, u.seen);
  u.seen = t.seen;
  u.practice = { ids: t.ids, answers: {}, submitted: {}, current: 0, startAt: Date.now(), finished: false };
  saveUser_(u);
  return practiceView_(b, u);
}

function api_getPractice() {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  if (!u.practice || u.practice.finished) return { finished: true };
  u.practice.ids = u.practice.ids.filter(function (id) { return b.byId[id]; });
  return practiceView_(b, u);
}

function api_submitPractice(index, choice) {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  const s = u.practice;
  if (!s || s.finished) throw new Error('Đợt luyện tập đã kết thúc.');
  if (Number(index) !== s.current) throw new Error('Câu hỏi không hợp lệ. Vui lòng tải lại trang.');
  const id = s.ids[s.current];
  const q = b.byId[id];
  const L = String(choice || '').toUpperCase();
  if (!s.submitted[id]) {
    if (LETTERS.indexOf(L) < 0 || LETTERS.indexOf(L) >= q.options.length) throw new Error('Vui lòng chọn một đáp án.');
    s.answers[id] = L;
    s.submitted[id] = true;
    saveUser_(u);
  }
  return practiceView_(b, u);
}

function api_nextPractice() {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  const s = u.practice;
  if (!s || s.finished) return { finished: true, review: s ? review_(b, s, 'practice') : null };
  if (!s.submitted[s.ids[s.current]]) throw new Error('Vui lòng nộp câu hiện tại trước.');
  if (s.current >= s.ids.length - 1) return api_finishPractice();
  s.current++;
  saveUser_(u);
  return practiceView_(b, u);
}

function api_finishPractice() {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  const s = u.practice;
  if (!s) throw new Error('Không có đợt luyện tập.');
  if (!s.finished) {
    s.finished = true;
    finishResult_(b, u, s, 'practice', false);
    saveUser_(u);
  }
  return { finished: true, review: review_(b, s, 'practice') };
}

/* ----- Xem lại kết quả gần nhất ----- */

function api_review(mode) {
  const b = getBank_();
  const u = loadUser_(requireUser_(b));
  const s = mode === 'exam' ? u.exam : u.practice;
  if (!s || !(mode === 'exam' ? s.submitted : s.finished)) throw new Error('Chưa có kết quả.');
  return review_(b, s, mode);
}
