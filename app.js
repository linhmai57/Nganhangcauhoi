/* =========================================================
 * Luyện thi đánh giá năng lực – Khoa Y
 *  - Mỗi đề được tạo theo đúng cấu trúc QĐ 22/QĐ-HĐYKQG:
 *    số câu theo 17 hệ cơ quan (4.1) và 6 miền năng lực (4.2)
 *  - Real-time: 120 câu / 180 phút, đáp án chỉ hiện sau khi nộp bài
 *  - Practice : 40 câu, không giới hạn thời gian, nộp từng câu -> hiện đáp án + giải thích,
 *               không quay lại câu trước, tự động lưu để làm tiếp
 *  - Sau mỗi đợt: bảng phân tích điểm yếu theo miền năng lực
 * ========================================================= */
(function () {
  "use strict";

  const BP = window.BLUEPRINT;
  const TOTAL = BP.totalQuestions;                 // số câu đề Real-time
  const PRACTICE_TOTAL = BP.practiceQuestions || 40; // số câu mỗi đợt Practice
  const KEY_EXAM = "qb2_exam";
  const KEY_PRACTICE = "qb2_practice";
  const KEY_SEEN = "qb2_seen";

  // ---------- Dữ liệu ----------
  const PROBLEMS = window.PROBLEMS || {};
  const BANK = new Map();
  (window.QUESTION_BANK || []).forEach((q) => {
    if (q && Array.isArray(q.options) && q.options.length >= 2 && q.answer) {
      BANK.set(String(q.id), Object.assign({}, q, { id: String(q.id) }));
    }
  });
  const SYS = new Map(BP.systems.map((s) => [s.id, s]));
  const COMP = new Map(BP.competencies.map((c) => [c.id, c]));
  const SUBNAME = {};
  BP.competencies.forEach((c) => c.subs.forEach((s) => { SUBNAME[c.id + "/" + s.id] = s.name; }));

  // Kho câu hỏi theo [hệ][năng lực]
  const POOL = {};
  BANK.forEach((q) => {
    if (!SYS.has(q.g) || !COMP.has(q.c)) return;
    POOL[q.g] = POOL[q.g] || {};
    (POOL[q.g][q.c] = POOL[q.g][q.c] || []).push(q.id);
  });

  // ---------- Tiện ích ----------
  const app = document.getElementById("app");
  const topRight = document.getElementById("topbarRight");
  let timerHandle = null;
  let keyHandler = null;
  const LETTERS = "ABCDEFGHIJ";

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
        else if (k === "style") node.style.cssText = v;
        else node.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* bỏ qua */ }
  }

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map((x) => String(x).padStart(2, "0")).join(":");
  }
  const fmtDate = (ts) => new Date(ts).toLocaleString("vi-VN");
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  function cleanup() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
    topRight.innerHTML = "";
    window.onbeforeunload = null;
  }

  function confirmBox(message, okText, onOk) {
    const backdrop = el("div", { class: "modal-backdrop" });
    const close = () => backdrop.remove();
    backdrop.append(el("div", { class: "card modal" },
      el("p", { style: "margin-top:0;white-space:pre-wrap", text: message }),
      el("div", { class: "actions" },
        el("button", { class: "btn", onclick: close }, "Hủy"),
        el("button", { class: "btn primary", onclick: () => { close(); onOk(); } }, okText))));
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    document.body.append(backdrop);
  }

  function keyToIndex(key) {
    if (/^[1-9]$/.test(key)) return Number(key) - 1;
    return key.length === 1 ? LETTERS.indexOf(key.toUpperCase()) : -1;
  }

  // ---------- Tạo đề theo QĐ 22 ----------
  // Chia "total" câu theo trọng số trung bình (min+max)/2, mỗi mục nằm trong [min%, max%].
  // Với đề ngắn, nếu khoảng [min%, max%] không chứa số nguyên nào thì nới ra số nguyên gần nhất
  // (mục có trọng số tối thiểu > 0 luôn có ít nhất 1 câu).
  function apportion(items, total) {
    const mids = items.map((it) => (it.min + it.max) / 2);
    const sumMid = mids.reduce((a, b) => a + b, 0);
    const quota = mids.map((m) => (m / sumMid) * total);
    const floor1 = items.map((it) => (it.min > 0 ? 1 : 0));
    const lo = [], hi = [];
    items.forEach((it, i) => {
      let l = Math.ceil((it.min * total) / 100 - 1e-9);
      let h = Math.floor((it.max * total) / 100 + 1e-9);
      if (l > h) { l = Math.floor((it.min * total) / 100); h = Math.ceil((it.max * total) / 100); }
      lo.push(Math.max(floor1[i], l));
      hi.push(Math.max(floor1[i], h));
    });
    const counts = quota.map((q, i) => Math.min(hi[i], Math.max(lo[i], Math.floor(q))));
    let diff = total - counts.reduce((a, b) => a + b, 0);
    let guard = 1000;
    while (diff !== 0 && guard--) {
      const up = diff > 0;
      let best = -1;
      const score = (i) => (up ? quota[i] - counts[i] : counts[i] - quota[i]);
      for (let i = 0; i < items.length; i++) {
        if (up ? counts[i] < hi[i] : counts[i] > lo[i]) if (best < 0 || score(i) > score(best)) best = i;
      }
      if (best < 0) { // không thể giữ trong khoảng: chọn mục lệch ít nhất so với trọng số
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

  function planCounts(total) {
    const sysCounts = apportion(BP.systems, total);
    const compCounts = apportion(BP.competencies, total);
    return { sysCounts, compCounts };
  }

  // Luồng cực đại: phân bổ số câu cho từng ô (hệ, năng lực) sao cho
  // tổng theo hàng = số câu của hệ, tổng theo cột = số câu của năng lực.
  function allocate(sysCounts, compCounts) {
    const S = BP.systems, C = BP.competencies;
    const n = S.length + C.length + 2, src = 0, sink = n - 1;
    const cap = Array.from({ length: n }, () => new Array(n).fill(0));
    S.forEach((s, i) => {
      cap[src][1 + i] = sysCounts[i];
      C.forEach((c, j) => {
        cap[1 + i][1 + S.length + j] = ((POOL[s.id] || {})[c.id] || []).length;
      });
    });
    C.forEach((c, j) => { cap[1 + S.length + j][sink] = compCounts[j]; });
    const orig = cap.map((r) => r.slice());
    let flow = 0;
    for (;;) {
      const prev = new Array(n).fill(-1);
      prev[src] = src;
      const queue = [src];
      while (queue.length && prev[sink] < 0) {
        const u = queue.shift();
        for (const v of shuffle([...Array(n).keys()])) {
          if (prev[v] < 0 && cap[u][v] > 0) { prev[v] = u; queue.push(v); }
        }
      }
      if (prev[sink] < 0) break;
      let f = Infinity;
      for (let v = sink; v !== src; v = prev[v]) f = Math.min(f, cap[prev[v]][v]);
      for (let v = sink; v !== src; v = prev[v]) { cap[prev[v]][v] -= f; cap[v][prev[v]] += f; }
      flow += f;
    }
    const x = S.map((s, i) => C.map((c, j) => {
      const a = 1 + i, b = 1 + S.length + j;
      return orig[a][b] - cap[a][b];
    }));
    // Nếu kho không đủ để khớp tuyệt đối cả hai chiều: giữ đúng số câu theo hệ
    S.forEach((s, i) => {
      let rem = sysCounts[i] - x[i].reduce((a, b) => a + b, 0);
      for (const j of shuffle([...C.keys()])) {
        while (rem > 0 && x[i][j] < orig[1 + i][1 + S.length + j]) { x[i][j]++; rem--; }
      }
    });
    return { x, exact: flow === sysCounts.reduce((a, b) => a + b, 0) };
  }

  function buildTest(total) {
    const { sysCounts, compCounts } = planCounts(total);
    const { x } = allocate(sysCounts, compCounts);
    const seen = new Set(load(KEY_SEEN) || []);
    let ids = [];
    BP.systems.forEach((s, i) => BP.competencies.forEach((c, j) => {
      const k = x[i][j];
      if (!k) return;
      const pool = shuffle((POOL[s.id] || {})[c.id] || []);
      pool.sort((a, b) => (seen.has(a) ? 1 : 0) - (seen.has(b) ? 1 : 0)); // ưu tiên câu chưa gặp
      ids = ids.concat(pool.slice(0, k));
    }));
    ids = shuffle(ids);
    ids.forEach((id) => seen.add(id));
    if (seen.size >= BANK.size) seen.clear();
    save(KEY_SEEN, [...seen]);
    return ids;
  }

  // ---------- Thành phần hiển thị câu hỏi ----------
  function stemNode(q) {
    return el("div", { class: "q-stem" }, q.stem.map((t) => el("p", { text: t })));
  }
  // Trình bày thống nhất theo Hướng dẫn viết MCQ: đáp án + lập luận, rồi lý do loại từng mồi nhử
  function explainNode(q) {
    const ex = q.ex || { r: "", d: {} };
    return el("div", { class: "explain" },
      el("p", null, el("b", { text: `Đáp án và lập luận: ${q.answer}. ` }), ex.r),
      el("p", { class: "ex-head" }, el("b", { text: "Vì sao không chọn các phương án khác:" })),
      Object.keys(ex.d).sort().map((L) => el("p", { class: "ex-opt" }, el("b", { text: `${L}. ` }), ex.d[L])));
  }
  function metaNode(q) {
    const s = SYS.get(q.g), c = COMP.get(q.c);
    return el("div", { class: "q-meta" },
      `Hệ: ${s ? s.name : q.g}`,
      PROBLEMS[q.p] ? ` · Vấn đề: ${PROBLEMS[q.p]}` : "",
      c ? ` · Năng lực: ${c.name}${c.subs.length > 1 ? " – " + SUBNAME[q.c + "/" + q.s] : ""}` : "");
  }
  function optionNodes(q, opts) {
    // opts: { chosen, reveal, onPick }
    return el("div", { class: "options" }, q.options.map((text, i) => {
      const L = LETTERS[i];
      let cls = "option";
      if (opts.reveal) {
        if (L === q.answer) cls += " correct";
        else if (L === opts.chosen) cls += " wrong";
      } else if (opts.chosen === L) cls += " selected";
      return el("button", {
        class: cls,
        disabled: opts.reveal || !opts.onPick,
        onclick: () => opts.onPick && opts.onPick(L)
      }, el("span", { class: "letter", text: L }), el("span", { class: "opt-text", text }));
    }));
  }

  // ---------- Trang chủ ----------
  function renderHome() {
    cleanup();
    app.innerHTML = "";
    if (!BANK.size) {
      app.append(el("div", { class: "card" }, el("h2", { text: "Chưa có dữ liệu câu hỏi" })));
      return;
    }
    const exam = load(KEY_EXAM);
    const practice = load(KEY_PRACTICE);

    // Real-time
    const examActions = el("div", { class: "actions" });
    let examNote = null;
    if (exam && !exam.submitted) {
      const left = exam.endAt - Date.now();
      if (left <= 0) return submitExam(true);
      examNote = el("p", { class: "muted" }, "Bạn đang có bài thi dở, còn ", el("b", { text: fmtTime(left) }), ".");
      examActions.append(
        el("button", { class: "btn primary", onclick: renderExam }, "Tiếp tục bài thi"),
        el("button", { class: "btn danger", onclick: () => confirmBox("Hủy bài thi đang làm và tạo đề mới?", "Tạo đề mới", startExam) }, "Làm đề mới"));
    } else {
      examActions.append(el("button", { class: "btn primary", onclick: startExam }, "Bắt đầu thi"));
      if (exam && exam.submitted) {
        examNote = el("p", { class: "muted" }, "Lần thi gần nhất: ",
          el("b", { text: `${exam.result.correct}/${exam.result.total}` }), ` câu đúng (${fmtDate(exam.result.finishedAt)}).`);
        examActions.append(el("button", { class: "btn", onclick: () => renderResult("exam") }, "Xem kết quả & phân tích"));
      }
    }

    // Practice
    const practiceActions = el("div", { class: "actions" });
    let practiceNote = null;
    if (practice && !practice.finished) {
      const done = practice.ids.filter((id) => practice.submitted[id]).length;
      practiceNote = el("div", null,
        el("p", { class: "muted", style: "margin:0 0 6px" }, `Đợt luyện tập đang làm: ${done}/${practice.ids.length} câu.`),
        el("div", { class: "progress" }, el("div", { style: `width:${pct(done, practice.ids.length)}%` })));
      practiceActions.append(
        el("button", { class: "btn primary", onclick: renderPractice }, "Tiếp tục luyện tập"),
        el("button", { class: "btn danger", onclick: () => confirmBox("Bỏ đợt luyện tập đang làm và tạo đề mới?", "Tạo đề mới", startPractice) }, "Làm đề mới"));
    } else {
      practiceActions.append(el("button", { class: "btn primary", onclick: startPractice }, "Bắt đầu luyện tập"));
      if (practice && practice.finished) {
        practiceActions.append(el("button", { class: "btn", onclick: () => renderResult("practice") }, "Xem kết quả & phân tích"));
      }
    }

    app.append(
      el("p", { class: "muted", text: `Ngân hàng hiện có ${BANK.size} câu hỏi thuộc ${BP.systems.length} hệ cơ quan. Câu hỏi của mỗi đề được chọn theo tỉ lệ hệ cơ quan và miền năng lực của Quyết định 22/QĐ-HĐYKQG.` }),
      el("div", { class: "modes" },
        el("div", { class: "card mode-card" },
          el("div", { class: "icon", text: "⏱️" }),
          el("h2", { text: "Real-time (thi thử)" }),
          el("ul", null,
            el("li", { text: `${TOTAL} câu hỏi, thời gian ${BP.minutes / 60} tiếng` }),
            el("li", { text: "Hết giờ hệ thống tự động nộp bài" }),
            el("li", { text: "Đáp án và giải thích chỉ hiện sau khi hoàn thành bài thi" })),
          examNote, examActions),
        el("div", { class: "card mode-card" },
          el("div", { class: "icon", text: "📝" }),
          el("h2", { text: "Practice (luyện tập)" }),
          el("ul", null,
            el("li", { text: `${PRACTICE_TOTAL} câu hỏi mỗi đợt, không giới hạn thời gian` }),
            el("li", { text: "Bấm Nộp để xem ngay đáp án và giải thích của từng câu" }),
            el("li", { text: "Không quay lại câu trước; tự động lưu để làm tiếp lần sau" })),
          practiceNote, practiceActions)),
      blueprintNode(),
      el("p", { class: "muted", style: "font-size:13px;margin-top:16px",
        text: "Tiến độ được lưu trên trình duyệt của máy đang dùng. Đổi máy, đổi trình duyệt hoặc xóa dữ liệu duyệt web thì tiến độ sẽ mất." })
    );
  }

  function blueprintNode() {
    const big = planCounts(TOTAL), small = planCounts(PRACTICE_TOTAL);
    const table = (head, items, a, b) => el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
      el("thead", null, el("tr", null, el("th", { text: head }), el("th", { text: "Trọng số QĐ 22" }),
        el("th", { text: `Real-time (${TOTAL} câu)` }), el("th", { text: `Practice (${PRACTICE_TOTAL} câu)` }))),
      el("tbody", null,
        items.map((it, i) => el("tr", null, el("td", { text: it.name }), el("td", { text: `${it.min}–${it.max}%` }),
          el("td", { text: a[i] }), el("td", { text: b[i] }))),
        el("tr", { class: "total" }, el("td", { text: "Tổng" }), el("td"), el("td", { text: TOTAL }), el("td", { text: PRACTICE_TOTAL })))));
    return el("details", { class: "card", style: "margin-top:20px" },
      el("summary", { text: "Cấu trúc đề theo Quyết định 22/QĐ-HĐYKQG" }),
      el("div", { class: "two-col" },
        table("Hệ cơ quan / đề mục", BP.systems, big.sysCounts, small.sysCounts),
        table("Miền năng lực", BP.competencies, big.compCounts, small.compCounts)),
      el("p", { class: "muted", style: "font-size:13px;margin-bottom:0",
        text: `Đề ${PRACTICE_TOTAL} câu quá ngắn để mọi mục nằm trọn trong khoảng trọng số (1 câu = ${(100 / PRACTICE_TOTAL).toFixed(1)}%): mỗi mục có ít nhất 1 câu, số câu được làm tròn gần nhất với trọng số trung bình.` }));
  }

  // ---------- Real-time ----------
  function startExam() {
    const now = Date.now();
    save(KEY_EXAM, {
      ids: buildTest(TOTAL), answers: {}, flags: {}, current: 0,
      startAt: now, endAt: now + BP.minutes * 60 * 1000, submitted: false
    });
    renderExam();
  }

  function renderExam() {
    cleanup();
    const state = load(KEY_EXAM);
    if (!state || state.submitted) return renderHome();
    state.ids = state.ids.filter((id) => BANK.has(id));
    const persist = () => save(KEY_EXAM, state);

    const timer = el("span", { class: "timer" });
    topRight.append(timer);
    const tick = () => {
      const left = state.endAt - Date.now();
      timer.textContent = "⏳ " + fmtTime(left);
      timer.classList.toggle("warning", left <= 10 * 60 * 1000);
      if (left <= 0) submitExam(true);
    };
    tick();
    timerHandle = setInterval(tick, 1000);
    window.onbeforeunload = () => true;

    function go(i) {
      if (i < 0 || i >= state.ids.length) return;
      state.current = i; persist(); draw(); window.scrollTo({ top: 0 });
    }
    function pick(L) {
      const id = state.ids[state.current];
      if (state.answers[id] === L) delete state.answers[id]; else state.answers[id] = L;
      persist(); draw();
    }

    function draw() {
      const id = state.ids[state.current];
      const q = BANK.get(id);
      const answered = state.ids.filter((x) => state.answers[x]).length;
      app.innerHTML = "";
      app.append(el("div", { class: "quiz-layout" },
        el("div", { class: "card" },
          el("div", { class: "q-head" },
            el("span", { class: "q-number", text: `Câu ${state.current + 1}/${state.ids.length}` }),
            el("button", { class: "btn small", onclick: () => { state.flags[id] = !state.flags[id]; persist(); draw(); } },
              state.flags[id] ? "🚩 Bỏ đánh dấu" : "🏳️ Đánh dấu xem lại")),
          stemNode(q),
          optionNodes(q, { chosen: state.answers[id], reveal: false, onPick: pick }),
          el("div", { class: "nav-buttons" },
            el("button", { class: "btn", disabled: state.current === 0, onclick: () => go(state.current - 1) }, "← Câu trước"),
            el("button", { class: "btn", disabled: state.current === state.ids.length - 1, onclick: () => go(state.current + 1) }, "Câu sau →"))),
        el("div", { class: "side" },
          el("div", { class: "card" },
            el("div", { class: "stats" },
              el("div", null, el("b", { text: answered }), "Đã làm"),
              el("div", null, el("b", { text: state.ids.length - answered }), "Chưa làm")),
            el("div", { class: "progress", style: "margin-top:10px" }, el("div", { style: `width:${pct(answered, state.ids.length)}%` }))),
          el("div", { class: "card" },
            el("div", { class: "grid" }, state.ids.map((x, i) => el("button", {
              class: "cell" + (state.answers[x] ? " answered" : "") + (state.flags[x] ? " flagged" : "") + (i === state.current ? " current" : ""),
              onclick: () => go(i)
            }, i + 1))),
            el("div", { class: "legend", style: "margin-top:10px" },
              el("span", { style: "--c:#dbeafe", text: "Đã làm" }),
              el("span", { style: "--c:#fff", text: "Chưa làm" }),
              el("span", { style: "--c:#d97706", text: "Đánh dấu" }))),
          el("button", {
            class: "btn primary",
            onclick: () => {
              const left = state.ids.length - answered;
              confirmBox(left > 0 ? `Bạn còn ${left} câu chưa làm. Bạn chắc chắn muốn nộp bài?` : "Bạn chắc chắn muốn nộp bài?",
                "Nộp bài", () => submitExam(false));
            }
          }, "Nộp bài"),
          el("button", { class: "btn", onclick: renderHome }, "Tạm rời (thời gian vẫn chạy)"))));
    }

    keyHandler = (e) => {
      if (document.querySelector(".modal-backdrop")) return;
      if (e.key === "ArrowRight") go(state.current + 1);
      else if (e.key === "ArrowLeft") go(state.current - 1);
      else {
        const i = keyToIndex(e.key);
        const q = BANK.get(state.ids[state.current]);
        if (i >= 0 && i < q.options.length) { state.answers[q.id] = LETTERS[i]; persist(); draw(); }
      }
    };
    document.addEventListener("keydown", keyHandler);
    draw();
  }

  function submitExam(timeout) {
    const state = load(KEY_EXAM);
    if (!state || state.submitted) return renderHome();
    state.ids = state.ids.filter((id) => BANK.has(id));
    const finishedAt = Math.min(Date.now(), state.endAt);
    state.submitted = true;
    state.result = {
      total: state.ids.length,
      correct: state.ids.filter((id) => state.answers[id] === BANK.get(id).answer).length,
      timeout: !!timeout,
      finishedAt,
      usedMs: finishedAt - state.startAt
    };
    save(KEY_EXAM, state);
    cleanup();
    renderResult("exam");
    if (timeout) setTimeout(() => alert("Đã hết giờ làm bài. Hệ thống đã tự động nộp bài."), 50);
  }

  // ---------- Practice ----------
  function startPractice() {
    save(KEY_PRACTICE, {
      ids: buildTest(PRACTICE_TOTAL), answers: {}, submitted: {}, current: 0,
      startedAt: Date.now(), finished: false
    });
    renderPractice();
  }

  function renderPractice() {
    cleanup();
    const state = load(KEY_PRACTICE);
    if (!state || state.finished) return renderHome();
    state.ids = state.ids.filter((id) => BANK.has(id));
    const persist = () => { state.updatedAt = Date.now(); save(KEY_PRACTICE, state); };
    topRight.append(el("span", { class: "muted", style: "font-size:14px", text: "💾 Tự động lưu" }));

    function finish() {
      state.finished = true;
      state.finishedAt = Date.now();
      persist();
      cleanup();
      renderResult("practice");
    }
    function pick(L) {
      const id = state.ids[state.current];
      if (state.submitted[id]) return;
      state.answers[id] = L; persist(); draw();
    }
    function submit() {
      const id = state.ids[state.current];
      if (!state.answers[id] || state.submitted[id]) return;
      state.submitted[id] = true; persist(); draw();
    }
    function next() {
      if (!state.submitted[state.ids[state.current]]) return;
      if (state.current >= state.ids.length - 1) return finish();
      state.current++; persist(); draw(); window.scrollTo({ top: 0 });
    }

    function draw() {
      const id = state.ids[state.current];
      const q = BANK.get(id);
      const chosen = state.answers[id];
      const done = !!state.submitted[id];
      let correct = 0, wrong = 0;
      state.ids.forEach((x) => {
        if (!state.submitted[x]) return;
        if (state.answers[x] === BANK.get(x).answer) correct++; else wrong++;
      });
      const isLast = state.current === state.ids.length - 1;

      let feedback = null;
      if (done) {
        const ok = chosen === q.answer;
        feedback = [
          el("div", { class: "verdict " + (ok ? "ok" : "no"), text: ok ? "✔ Chính xác!" : `✘ Chưa đúng. Đáp án đúng là ${q.answer}.` }),
          explainNode(q)
        ];
      }

      app.innerHTML = "";
      app.append(el("div", { class: "quiz-layout" },
        el("div", { class: "card" },
          el("div", { class: "q-head" },
            el("span", { class: "q-number", text: `Câu ${state.current + 1}/${state.ids.length}` })),
          stemNode(q),
          optionNodes(q, { chosen, reveal: done, onPick: done ? null : pick }),
          feedback,
          el("div", { class: "nav-buttons", style: "justify-content:flex-end" },
            done
              ? el("button", { class: "btn primary", onclick: next }, isLast ? "Hoàn thành & xem phân tích" : "Câu tiếp theo →")
              : el("button", { class: "btn primary", disabled: !chosen, onclick: submit }, "Nộp"))),
        el("div", { class: "side" },
          el("div", { class: "card" },
            el("div", { class: "stats" },
              el("div", { style: "color:var(--green)" }, el("b", { text: correct }), "Đúng"),
              el("div", { style: "color:var(--red)" }, el("b", { text: wrong }), "Sai"),
              el("div", null, el("b", { text: state.ids.length - correct - wrong }), "Chưa làm"),
              el("div", null, el("b", { text: Math.round(pct(correct + wrong, state.ids.length)) + "%" }), "Hoàn thành")),
            el("div", { class: "progress", style: "margin-top:10px" }, el("div", { style: `width:${pct(correct + wrong, state.ids.length)}%` }))),
          el("div", { class: "card" },
            el("div", { class: "grid" }, state.ids.map((x, i) => {
              let cls = "cell";
              if (state.submitted[x]) cls += state.answers[x] === BANK.get(x).answer ? " correct" : " wrong";
              if (i === state.current) cls += " current";
              return el("button", { class: cls, disabled: true }, i + 1);
            })),
            el("div", { class: "legend", style: "margin-top:10px" },
              el("span", { style: "--c:#dcfce7", text: "Đúng" }),
              el("span", { style: "--c:#fee2e2", text: "Sai" }),
              el("span", { style: "--c:#fff", text: "Chưa làm" }))),
          el("button", {
            class: "btn",
            onclick: () => confirmBox("Kết thúc đợt luyện tập này và xem bảng phân tích?\n(Các câu chưa làm sẽ không được tính.)", "Kết thúc", finish)
          }, "🏁 Kết thúc đợt luyện tập"),
          el("button", { class: "btn", onclick: renderHome }, "💾 Lưu và thoát"))));
    }

    keyHandler = (e) => {
      if (document.querySelector(".modal-backdrop")) return;
      const id = state.ids[state.current];
      if (e.key === "Enter") { state.submitted[id] ? next() : submit(); return; }
      const i = keyToIndex(e.key);
      if (i >= 0 && i < BANK.get(id).options.length) pick(LETTERS[i]);
    };
    document.addEventListener("keydown", keyHandler);
    draw();
  }

  // ---------- Phân tích năng lực ----------
  function level(rate, denom) {
    if (!denom) return el("span", { class: "lvl na", text: "Chưa có dữ liệu" });
    if (rate < 50) return el("span", { class: "lvl y", text: "Yếu" });
    if (rate < 65) return el("span", { class: "lvl tb", text: "Trung bình" });
    if (rate < 80) return el("span", { class: "lvl k", text: "Khá" });
    return el("span", { class: "lvl t", text: "Tốt" });
  }
  function barNode(rate, denom) {
    const color = !denom ? "#d1d5db" : rate < 50 ? "var(--red)" : rate < 65 ? "var(--amber)" : rate < 80 ? "var(--primary)" : "var(--green)";
    return el("div", { class: "bar" }, el("div", { style: `width:${rate}%;background:${color}` }));
  }

  // practice: tỉ lệ đúng tính trên số câu đã làm; exam: tính trên toàn bộ số câu
  function analyze(state, mode) {
    const dom = {}, sub = {};
    const status = (id) => {
      const q = BANK.get(id);
      const done = mode === "exam" ? !!state.answers[id] : !!state.submitted[id];
      if (!done) return "blank";
      return state.answers[id] === q.answer ? "correct" : "wrong";
    };
    state.ids.forEach((id) => {
      const q = BANK.get(id);
      const st = status(id);
      [[dom, q.c], [sub, q.c + "/" + q.s]].forEach(([obj, key]) => {
        const r = obj[key] = obj[key] || { n: 0, correct: 0, wrong: 0, blank: 0 };
        r.n++; r[st]++;
      });
    });
    const finalize = (r) => {
      r.denom = mode === "exam" ? r.n : r.correct + r.wrong;
      r.rate = pct(r.correct, r.denom);
      return r;
    };
    Object.values(dom).forEach(finalize);
    Object.values(sub).forEach(finalize);
    return { dom, sub, status };
  }

  function analysisNode(state, mode) {
    const { dom, sub } = analyze(state, mode);
    const rows = [];
    let tot = { n: 0, correct: 0, wrong: 0, blank: 0 };
    BP.competencies.forEach((c) => {
      const r = dom[c.id] || finalizeEmpty();
      ["n", "correct", "wrong", "blank"].forEach((k) => { tot[k] += r[k]; });
      rows.push(rowNode(c.name, r, ""));
      if (c.subs.length > 1) {
        c.subs.forEach((s) => rows.push(rowNode(s.name, sub[c.id + "/" + s.id] || finalizeEmpty(), "sub")));
      }
    });
    tot.denom = mode === "exam" ? tot.n : tot.correct + tot.wrong;
    tot.rate = pct(tot.correct, tot.denom);
    rows.push(rowNode("Tổng", tot, "total"));

    function finalizeEmpty() { return { n: 0, correct: 0, wrong: 0, blank: 0, denom: 0, rate: 0 }; }
    function rowNode(name, r, cls) {
      return el("tr", { class: cls },
        el("td", { text: name }),
        el("td", { text: r.n }),
        el("td", { style: "color:var(--green)", text: r.correct }),
        el("td", { style: "color:var(--red)", text: r.wrong }),
        el("td", { text: r.blank }),
        el("td", null, r.denom ? r.rate + "%" : "–"),
        el("td", null, barNode(r.rate, r.denom)),
        el("td", null, level(r.rate, r.denom)));
    }

    // Kết luận: các miền năng lực yếu (sắp xếp từ thấp đến cao)
    const ranked = BP.competencies
      .map((c) => ({ c, r: dom[c.id] }))
      .filter((x) => x.r && x.r.denom > 0)
      .sort((a, b) => a.r.rate - b.r.rate);
    const weak = ranked.filter((x) => x.r.rate < 65);
    const weakSubs = BP.competencies.filter((c) => c.subs.length > 1)
      .flatMap((c) => c.subs.map((s) => ({ name: s.name, r: sub[c.id + "/" + s.id] })))
      .filter((x) => x.r && x.r.denom > 0 && x.r.rate < 65)
      .sort((a, b) => a.r.rate - b.r.rate);

    let summary;
    if (!ranked.length) {
      summary = el("div", { class: "alert warn", text: "Chưa có câu nào được làm để phân tích." });
    } else if (weak.length) {
      summary = el("div", { class: "alert warn" },
        el("b", { text: "Miền năng lực cần cải thiện: " }),
        weak.map((x, i) => [i ? "; " : "", el("b", { text: x.c.name }), ` (${x.r.rate}%)`]),
        weakSubs.length ? el("div", { style: "margin-top:6px" }, "Tiểu mục yếu: ",
          weakSubs.map((x, i) => `${i ? "; " : ""}${x.name} (${x.r.rate}%)`)) : null);
    } else {
      summary = el("div", { class: "alert ok" },
        "Không có miền năng lực nào dưới 65%. Miền có kết quả thấp nhất: ",
        el("b", { text: ranked[0].c.name }), ` (${ranked[0].r.rate}%).`);
    }

    return el("div", null,
      el("h2", { style: "margin-top:24px", text: "Phân tích theo miền năng lực" }),
      summary,
      el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
        el("thead", null, el("tr", null,
          ["Miền / tiểu mục năng lực", "Số câu", "Đúng", "Sai", "Bỏ trống", "Tỉ lệ đúng", "", "Đánh giá"].map((t) => el("th", { text: t })))),
        el("tbody", null, rows))),
      el("p", { class: "muted", style: "font-size:13px" },
        mode === "exam" ? "Tỉ lệ đúng = số câu đúng / số câu của miền (câu bỏ trống tính là chưa đạt). "
          : "Tỉ lệ đúng = số câu đúng / số câu đã làm của miền. ",
        "Mức đánh giá: Yếu < 50% · Trung bình 50–64% · Khá 65–79% · Tốt ≥ 80%. Miền có ít câu (1–3 câu) chỉ mang tính tham khảo."));
  }

  // ---------- Kết quả ----------
  function renderResult(mode) {
    cleanup();
    const state = load(mode === "exam" ? KEY_EXAM : KEY_PRACTICE);
    if (!state) return renderHome();
    state.ids = state.ids.filter((id) => BANK.has(id));
    const { status } = analyze(state, mode);
    const counts = { correct: 0, wrong: 0, blank: 0 };
    state.ids.forEach((id) => counts[status(id)]++);
    const total = state.ids.length;

    const summary = el("div", { class: "result-summary" },
      el("div", { class: "stat-box" }, el("b", { text: (total ? (counts.correct / total) * 10 : 0).toFixed(2) }), "Điểm (thang 10)"),
      el("div", { class: "stat-box", style: "color:var(--green)" }, el("b", { text: counts.correct }), "Câu đúng"),
      el("div", { class: "stat-box", style: "color:var(--red)" }, el("b", { text: counts.wrong }), "Câu sai"),
      el("div", { class: "stat-box" }, el("b", { text: counts.blank }), mode === "exam" ? "Bỏ trống" : "Chưa làm"),
      mode === "exam" && state.result
        ? el("div", { class: "stat-box" }, el("b", { text: fmtTime(state.result.usedMs) }), "Thời gian làm bài") : null);

    let filter = "all";
    const list = el("div");
    const filterBar = el("div", { class: "filter-bar" });
    const compFilter = el("select", { class: "btn small", onchange: () => drawList() },
      el("option", { value: "", text: "Tất cả miền năng lực" }),
      BP.competencies.map((c) => el("option", { value: c.id, text: c.name })));
    const filters = [["all", `Tất cả (${total})`], ["wrong", `Sai (${counts.wrong})`],
      ["blank", `${mode === "exam" ? "Bỏ trống" : "Chưa làm"} (${counts.blank})`], ["correct", `Đúng (${counts.correct})`]];

    function drawFilters() {
      filterBar.innerHTML = "";
      filters.forEach(([k, label]) => filterBar.append(el("button", {
        class: "btn small" + (filter === k ? " active" : ""),
        onclick: () => { filter = k; drawFilters(); drawList(); }
      }, label)));
      filterBar.append(compFilter);
    }
    function drawList() {
      list.innerHTML = "";
      let shown = 0;
      state.ids.forEach((id, idx) => {
        const q = BANK.get(id);
        const st = status(id);
        if (filter !== "all" && filter !== st) return;
        if (compFilter.value && q.c !== compFilter.value) return;
        shown++;
        const chosen = state.answers[id];
        list.append(el("div", { class: "review-item" },
          el("div", { class: "q-head" },
            el("span", { class: "q-number", text: `Câu ${idx + 1}` }),
            el("span", {
              class: "verdict " + (st === "correct" ? "ok" : "no"), style: "margin:0",
              text: st === "correct" ? "✔ Đúng" : st === "wrong" ? `✘ Sai (chọn ${chosen})` : "— Chưa làm"
            })),
          metaNode(q),
          stemNode(q),
          optionNodes(q, { chosen: st === "blank" ? null : chosen, reveal: true }),
          explainNode(q)));
      });
      if (!shown) list.append(el("p", { class: "muted", text: "Không có câu hỏi nào." }));
    }

    const actions = el("div", { class: "filter-bar", style: "margin-top:0" },
      el("button", { class: "btn", onclick: renderHome }, "🏠 Về trang chủ"),
      mode === "exam"
        ? el("button", { class: "btn primary", onclick: startExam }, "Làm đề thi mới")
        : el("button", { class: "btn primary", onclick: startPractice }, "Luyện tập đề mới"));

    app.innerHTML = "";
    app.append(el("div", { class: "card" },
      el("h1", { text: mode === "exam" ? "Kết quả bài thi Real-time" : "Kết quả đợt luyện tập" }),
      mode === "exam" && state.result
        ? el("p", { class: "muted", text: (state.result.timeout ? "Tự động nộp do hết giờ · " : "") + "Nộp lúc " + fmtDate(state.result.finishedAt) })
        : el("p", { class: "muted", text: state.finishedAt ? "Kết thúc lúc " + fmtDate(state.finishedAt) : "" }),
      summary,
      actions,
      analysisNode(state, mode),
      el("h2", { style: "margin-top:28px", text: "Xem lại đáp án và giải thích" }),
      filterBar,
      list));
    drawFilters();
    drawList();
    window.scrollTo({ top: 0 });
  }

  // ---------- Khởi động ----------
  document.getElementById("homeBtn").addEventListener("click", () => {
    const exam = load(KEY_EXAM);
    if (topRight.querySelector(".timer") && exam && !exam.submitted) {
      confirmBox("Bạn đang làm bài thi. Về trang chủ? (Thời gian vẫn tiếp tục chạy)", "Về trang chủ", renderHome);
    } else {
      renderHome();
    }
  });

  // Dùng cho kiểm thử: window.__qb.buildTest()
  window.__qb = { buildTest, planCounts, BANK };

  renderHome();
})();
