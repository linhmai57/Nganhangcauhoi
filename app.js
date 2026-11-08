/* =========================================================
 * Ứng dụng luyện tập ngân hàng câu hỏi
 *  - Real-time: 120 câu ngẫu nhiên, 180 phút, tự nộp khi hết giờ
 *  - Practice : không giới hạn thời gian, xem đáp án + giải thích ngay,
 *               tự động lưu tiến độ để làm tiếp lần sau
 * ========================================================= */
(function () {
  "use strict";

  // ---------- Cấu hình ----------
  const CONFIG = {
    EXAM_QUESTIONS: 120, // số câu trong chế độ Real-time
    EXAM_MINUTES: 180    // thời gian làm bài (phút)
  };

  const KEY_EXAM = "qb_exam_v1";
  const KEY_PRACTICE = "qb_practice_v1";

  // ---------- Dữ liệu ----------
  const RAW = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
  const BANK = new Map();
  RAW.forEach((q, i) => {
    if (!q || !q.question || !Array.isArray(q.options) || q.options.length < 2) return;
    const id = String(q.id != null ? q.id : i + 1);
    if (BANK.has(id)) console.warn("Trùng id câu hỏi:", id);
    BANK.set(id, {
      id,
      question: String(q.question),
      options: q.options.map(String),
      answer: String(q.answer || "").trim().toUpperCase(),
      explanation: q.explanation ? String(q.explanation) : ""
    });
  });
  const ALL_IDS = [...BANK.keys()];

  // ---------- Tiện ích ----------
  const app = document.getElementById("app");
  const topRight = document.getElementById("topbarRight");
  let timerHandle = null;
  let keyHandler = null;

  const LETTERS = "ABCDEFGHIJ";
  const letter = (i) => LETTERS[i];

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
    for (const c of children.flat()) {
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
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* bỏ qua */ }
  }

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((x) => String(x).padStart(2, "0")).join(":");
  }
  function fmtDate(ts) {
    return new Date(ts).toLocaleString("vi-VN");
  }

  function cleanup() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
    topRight.innerHTML = "";
    window.onbeforeunload = null;
  }

  function confirmBox(message, okText, onOk) {
    const backdrop = el("div", { class: "modal-backdrop" });
    const close = () => backdrop.remove();
    backdrop.append(
      el("div", { class: "card modal" },
        el("p", { style: "margin-top:0;white-space:pre-wrap", text: message }),
        el("div", { class: "actions" },
          el("button", { class: "btn", onclick: close }, "Hủy"),
          el("button", { class: "btn primary", onclick: () => { close(); onOk(); } }, okText)
        )
      )
    );
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    document.body.append(backdrop);
  }

  // Lọc các id không còn trong ngân hàng (khi dữ liệu thay đổi)
  function validIds(ids) {
    return (ids || []).filter((id) => BANK.has(id));
  }

  // ---------- Trang chủ ----------
  function renderHome() {
    cleanup();
    app.innerHTML = "";

    if (!ALL_IDS.length) {
      app.append(el("div", { class: "card" },
        el("h2", { text: "Chưa có dữ liệu câu hỏi" }),
        el("p", { class: "muted", text: "Vui lòng nhập câu hỏi vào file data/questions.js." })
      ));
      return;
    }

    const exam = load(KEY_EXAM);
    const practice = load(KEY_PRACTICE);
    const examQ = Math.min(CONFIG.EXAM_QUESTIONS, ALL_IDS.length);

    // Thẻ Real-time
    const examActions = el("div", { class: "actions" });
    let examNote = null;
    if (exam && !exam.submitted) {
      const left = exam.endAt - Date.now();
      if (left > 0) {
        examNote = el("p", { class: "muted" }, "Bạn đang có bài thi dở, còn ", el("b", { text: fmtTime(left) }), ".");
        examActions.append(el("button", { class: "btn primary", onclick: renderExam }, "Tiếp tục bài thi"));
        examActions.append(el("button", {
          class: "btn danger",
          onclick: () => confirmBox("Hủy bài thi đang làm và bắt đầu bài mới?", "Bắt đầu bài mới", startExam)
        }, "Làm bài mới"));
      } else {
        submitExam(true);
        return;
      }
    } else {
      examActions.append(el("button", { class: "btn primary", onclick: startExam }, "Bắt đầu thi"));
      if (exam && exam.submitted) {
        examNote = el("p", { class: "muted" },
          "Lần thi gần nhất: ", el("b", { text: `${exam.result.correct}/${exam.result.total}` }),
          ` câu đúng (${fmtDate(exam.result.finishedAt)}).`);
        examActions.append(el("button", { class: "btn", onclick: () => renderResult("exam") }, "Xem lại kết quả"));
      }
    }

    // Thẻ Practice
    const practiceActions = el("div", { class: "actions" });
    let practiceNote = null;
    if (practice) {
      const ids = validIds(practice.ids);
      const done = ids.filter((id) => practice.answers[id]).length;
      const pct = ids.length ? Math.round((done / ids.length) * 100) : 0;
      practiceNote = el("div", null,
        el("p", { class: "muted", style: "margin:0 0 6px" },
          `Tiến độ đã lưu: ${done}/${ids.length} câu (${pct}%).`),
        el("div", { class: "progress" }, el("div", { style: `width:${pct}%` }))
      );
      practiceActions.append(el("button", { class: "btn primary", onclick: renderPractice }, "Tiếp tục luyện tập"));
      practiceActions.append(el("button", {
        class: "btn danger",
        onclick: () => confirmBox("Xóa toàn bộ tiến độ luyện tập đã lưu và bắt đầu lại từ đầu?", "Làm lại từ đầu", () => startPractice(shuffleChk.checked))
      }, "Làm lại từ đầu"));
    } else {
      practiceActions.append(el("button", { class: "btn primary", onclick: () => startPractice(shuffleChk.checked) }, "Bắt đầu luyện tập"));
    }
    const shuffleChk = el("input", { type: "checkbox", id: "chkShuffle" });

    app.append(
      el("h1", { text: "Luyện tập ngân hàng câu hỏi" }),
      el("p", { class: "muted", text: `Ngân hàng hiện có ${ALL_IDS.length} câu hỏi. Chọn hình thức luyện tập:` }),
      el("div", { class: "modes" },
        el("div", { class: "card mode-card" },
          el("div", { class: "icon", text: "⏱️" }),
          el("h2", { text: "Real-time (thi thử)" }),
          el("ul", null,
            el("li", { text: `${examQ} câu hỏi chọn ngẫu nhiên` }),
            el("li", { text: `Thời gian: ${CONFIG.EXAM_MINUTES / 60} tiếng, tự động nộp bài khi hết giờ` }),
            el("li", { text: "Chỉ xem đáp án và giải thích sau khi nộp bài" })
          ),
          examNote,
          examActions
        ),
        el("div", { class: "card mode-card" },
          el("div", { class: "icon", text: "📝" }),
          el("h2", { text: "Practice (luyện tập)" }),
          el("ul", null,
            el("li", { text: "Không giới hạn thời gian" }),
            el("li", { text: "Xem đáp án đúng và giải thích ngay sau mỗi câu" }),
            el("li", { text: "Tự động lưu, lần sau vào tiếp tục làm" })
          ),
          el("label", { class: "muted", style: "font-size:14px" }, shuffleChk, " Xáo trộn thứ tự câu hỏi khi bắt đầu mới"),
          practiceNote,
          practiceActions
        )
      ),
      el("p", { class: "muted", style: "font-size:13px;margin-top:20px",
        text: "Lưu ý: tiến độ được lưu trên trình duyệt của máy đang dùng. Nếu đổi máy, đổi trình duyệt hoặc xóa dữ liệu duyệt web thì tiến độ sẽ mất." })
    );
  }

  // ---------- Real-time ----------
  function startExam() {
    const n = Math.min(CONFIG.EXAM_QUESTIONS, ALL_IDS.length);
    const now = Date.now();
    save(KEY_EXAM, {
      ids: shuffle(ALL_IDS).slice(0, n),
      answers: {},
      flags: {},
      current: 0,
      startAt: now,
      endAt: now + CONFIG.EXAM_MINUTES * 60 * 1000,
      submitted: false
    });
    renderExam();
  }

  function renderExam() {
    cleanup();
    const state = load(KEY_EXAM);
    if (!state || state.submitted) return renderHome();
    state.ids = validIds(state.ids);
    if (!state.ids.length) { remove(KEY_EXAM); return renderHome(); }
    state.current = Math.min(state.current || 0, state.ids.length - 1);

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

    const persist = () => save(KEY_EXAM, state);

    function draw() {
      const id = state.ids[state.current];
      const q = BANK.get(id);
      const chosen = state.answers[id];
      const answered = state.ids.filter((x) => state.answers[x]).length;

      app.innerHTML = "";
      app.append(el("div", { class: "quiz-layout" },
        el("div", { class: "card" },
          el("div", { class: "q-head" },
            el("span", { class: "q-number", text: `Câu ${state.current + 1}/${state.ids.length}` }),
            el("button", {
              class: "btn small",
              onclick: () => { state.flags[id] = !state.flags[id]; persist(); draw(); }
            }, state.flags[id] ? "🚩 Bỏ đánh dấu" : "🏳️ Đánh dấu xem lại")
          ),
          el("p", { class: "q-text", text: q.question }),
          el("div", { class: "options" },
            q.options.map((opt, i) => {
              const L = letter(i);
              return el("button", {
                class: "option" + (chosen === L ? " selected" : ""),
                onclick: () => {
                  if (state.answers[id] === L) delete state.answers[id];
                  else state.answers[id] = L;
                  persist(); draw();
                }
              }, el("span", { class: "letter", text: L }), el("span", { class: "opt-text", text: opt }));
            })
          ),
          el("div", { class: "nav-buttons" },
            el("button", { class: "btn", disabled: state.current === 0, onclick: () => go(state.current - 1) }, "← Câu trước"),
            el("button", { class: "btn", disabled: state.current === state.ids.length - 1, onclick: () => go(state.current + 1) }, "Câu sau →")
          )
        ),
        el("div", { class: "side" },
          el("div", { class: "card" },
            el("div", { class: "stats" },
              el("div", null, el("b", { text: answered }), "Đã làm"),
              el("div", null, el("b", { text: state.ids.length - answered }), "Chưa làm")
            ),
            el("div", { class: "progress", style: "margin-top:10px" },
              el("div", { style: `width:${(answered / state.ids.length) * 100}%` }))
          ),
          el("div", { class: "card" },
            el("div", { class: "grid" },
              state.ids.map((x, i) => el("button", {
                class: "cell" + (state.answers[x] ? " answered" : "") + (state.flags[x] ? " flagged" : "") + (i === state.current ? " current" : ""),
                onclick: () => go(i)
              }, i + 1))
            ),
            el("div", { class: "legend", style: "margin-top:10px" },
              el("span", { style: "--c:#dbeafe", text: "Đã làm" }),
              el("span", { style: "--c:#fff;", text: "Chưa làm" }),
              el("span", { style: "--c:#d97706", text: "Đánh dấu" })
            )
          ),
          el("button", {
            class: "btn primary",
            onclick: () => {
              const left = state.ids.length - answered;
              const msg = left > 0
                ? `Bạn còn ${left} câu chưa làm. Bạn chắc chắn muốn nộp bài?`
                : "Bạn chắc chắn muốn nộp bài?";
              confirmBox(msg, "Nộp bài", () => submitExam(false));
            }
          }, "Nộp bài"),
          el("button", { class: "btn", onclick: renderHome }, "Tạm rời (thời gian vẫn chạy)")
        )
      ));
    }

    function go(i) {
      if (i < 0 || i >= state.ids.length) return;
      state.current = i; persist(); draw(); window.scrollTo({ top: 0 });
    }

    keyHandler = (e) => {
      if (document.querySelector(".modal-backdrop")) return;
      if (e.key === "ArrowRight") go(state.current + 1);
      else if (e.key === "ArrowLeft") go(state.current - 1);
      else {
        const idx = keyToIndex(e.key);
        const q = BANK.get(state.ids[state.current]);
        if (idx >= 0 && idx < q.options.length) {
          state.answers[q.id] = letter(idx); persist(); draw();
        }
      }
    };
    document.addEventListener("keydown", keyHandler);

    draw();
  }

  function submitExam(timeout) {
    const state = load(KEY_EXAM);
    if (!state || state.submitted) return renderHome();
    state.ids = validIds(state.ids);
    const correct = state.ids.filter((id) => state.answers[id] === BANK.get(id).answer).length;
    const answered = state.ids.filter((id) => state.answers[id]).length;
    const finishedAt = Math.min(Date.now(), state.endAt);
    state.submitted = true;
    state.result = {
      total: state.ids.length,
      correct,
      answered,
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
  function startPractice(doShuffle) {
    save(KEY_PRACTICE, {
      ids: doShuffle ? shuffle(ALL_IDS) : ALL_IDS.slice(),
      answers: {},
      flags: {},
      current: 0,
      startedAt: Date.now()
    });
    renderPractice();
  }

  function renderPractice() {
    cleanup();
    const state = load(KEY_PRACTICE);
    if (!state) return renderHome();
    // Đồng bộ với ngân hàng: bỏ câu đã xóa, thêm câu mới bổ sung
    state.ids = validIds(state.ids);
    ALL_IDS.forEach((id) => { if (!state.ids.includes(id)) state.ids.push(id); });
    state.flags = state.flags || {};
    state.current = Math.min(state.current || 0, state.ids.length - 1);
    const persist = () => { state.updatedAt = Date.now(); save(KEY_PRACTICE, state); };
    persist();

    topRight.append(el("span", { class: "muted", style: "font-size:14px", text: "💾 Tự động lưu" }));

    function counts() {
      let correct = 0, wrong = 0;
      state.ids.forEach((id) => {
        const a = state.answers[id];
        if (!a) return;
        if (a === BANK.get(id).answer) correct++; else wrong++;
      });
      return { correct, wrong, left: state.ids.length - correct - wrong };
    }

    function draw() {
      const id = state.ids[state.current];
      const q = BANK.get(id);
      const chosen = state.answers[id];
      const c = counts();

      const optionNodes = q.options.map((opt, i) => {
        const L = letter(i);
        let cls = "option";
        if (chosen) {
          if (L === q.answer) cls += " correct";
          else if (L === chosen) cls += " wrong";
        }
        return el("button", {
          class: cls,
          disabled: !!chosen,
          onclick: () => choose(L)
        }, el("span", { class: "letter", text: L }), el("span", { class: "opt-text", text: opt }));
      });

      let feedback = null;
      if (chosen) {
        const ok = chosen === q.answer;
        feedback = [
          el("div", { class: "verdict " + (ok ? "ok" : "no"),
            text: ok ? "✔ Chính xác!" : `✘ Chưa đúng. Đáp án đúng là ${q.answer}.` }),
          q.explanation ? el("div", { class: "explain" }, el("b", { text: "Giải thích: " }), q.explanation) : null,
          el("button", { class: "btn small", style: "margin-top:12px",
            onclick: () => { delete state.answers[id]; persist(); draw(); } }, "↺ Làm lại câu này")
        ];
      }

      const allDone = c.left === 0;

      app.innerHTML = "";
      app.append(el("div", { class: "quiz-layout" },
        el("div", { class: "card" },
          el("div", { class: "q-head" },
            el("span", { class: "q-number", text: `Câu ${state.current + 1}/${state.ids.length}` }),
            el("button", {
              class: "btn small",
              onclick: () => { state.flags[id] = !state.flags[id]; persist(); draw(); }
            }, state.flags[id] ? "🚩 Bỏ đánh dấu" : "🏳️ Đánh dấu")
          ),
          el("p", { class: "q-text", text: q.question }),
          el("div", { class: "options" }, optionNodes),
          feedback,
          el("div", { class: "nav-buttons" },
            el("button", { class: "btn", disabled: state.current === 0, onclick: () => go(state.current - 1) }, "← Câu trước"),
            el("button", { class: "btn", onclick: nextUnanswered, disabled: allDone }, "Câu chưa làm"),
            el("button", { class: "btn primary", disabled: state.current === state.ids.length - 1, onclick: () => go(state.current + 1) }, "Câu sau →")
          )
        ),
        el("div", { class: "side" },
          el("div", { class: "card" },
            el("div", { class: "stats" },
              el("div", { style: "color:var(--green)" }, el("b", { text: c.correct }), "Đúng"),
              el("div", { style: "color:var(--red)" }, el("b", { text: c.wrong }), "Sai"),
              el("div", null, el("b", { text: c.left }), "Chưa làm"),
              el("div", null, el("b", { text: Math.round(((c.correct + c.wrong) / state.ids.length) * 100) + "%" }), "Hoàn thành")
            ),
            el("div", { class: "progress", style: "margin-top:10px" },
              el("div", { style: `width:${((c.correct + c.wrong) / state.ids.length) * 100}%` }))
          ),
          el("div", { class: "card" },
            el("div", { class: "grid" },
              state.ids.map((x, i) => {
                const a = state.answers[x];
                let cls = "cell";
                if (a) cls += a === BANK.get(x).answer ? " correct" : " wrong";
                if (state.flags[x]) cls += " flagged";
                if (i === state.current) cls += " current";
                return el("button", { class: cls, onclick: () => go(i) }, i + 1);
              })
            ),
            el("div", { class: "legend", style: "margin-top:10px" },
              el("span", { style: "--c:#dcfce7", text: "Đúng" }),
              el("span", { style: "--c:#fee2e2", text: "Sai" }),
              el("span", { style: "--c:#fff", text: "Chưa làm" }),
              el("span", { style: "--c:#d97706", text: "Đánh dấu" })
            )
          ),
          el("button", {
            class: "btn",
            disabled: c.wrong === 0,
            onclick: () => confirmBox(`Xóa kết quả ${c.wrong} câu sai để làm lại các câu này?`, "Làm lại câu sai", () => {
              state.ids.forEach((x) => {
                if (state.answers[x] && state.answers[x] !== BANK.get(x).answer) delete state.answers[x];
              });
              const first = state.ids.findIndex((x) => !state.answers[x]);
              state.current = first >= 0 ? first : 0;
              persist(); draw();
            })
          }, "↺ Làm lại các câu sai"),
          el("button", { class: "btn", onclick: () => renderResult("practice") }, "📊 Xem tổng kết"),
          el("button", { class: "btn", onclick: renderHome }, "💾 Lưu và thoát")
        )
      ));
    }

    function choose(L) {
      const id = state.ids[state.current];
      if (state.answers[id]) return;
      state.answers[id] = L;
      persist(); draw();
    }

    function go(i) {
      if (i < 0 || i >= state.ids.length) return;
      state.current = i; persist(); draw(); window.scrollTo({ top: 0 });
    }

    function nextUnanswered() {
      const n = state.ids.length;
      for (let k = 1; k <= n; k++) {
        const i = (state.current + k) % n;
        if (!state.answers[state.ids[i]]) return go(i);
      }
    }

    keyHandler = (e) => {
      if (document.querySelector(".modal-backdrop")) return;
      if (e.key === "ArrowRight" || e.key === "Enter") go(state.current + 1);
      else if (e.key === "ArrowLeft") go(state.current - 1);
      else {
        const idx = keyToIndex(e.key);
        const q = BANK.get(state.ids[state.current]);
        if (idx >= 0 && idx < q.options.length) choose(letter(idx));
      }
    };
    document.addEventListener("keydown", keyHandler);

    draw();
  }

  // Phím 1-9 hoặc A-J để chọn đáp án
  function keyToIndex(key) {
    if (/^[1-9]$/.test(key)) return Number(key) - 1;
    const i = LETTERS.indexOf(String(key).toUpperCase());
    return key.length === 1 ? i : -1;
  }

  // ---------- Kết quả / tổng kết ----------
  function renderResult(mode) {
    cleanup();
    const state = load(mode === "exam" ? KEY_EXAM : KEY_PRACTICE);
    if (!state) return renderHome();
    const ids = validIds(state.ids);

    let total = ids.length, correct = 0, wrong = 0, blank = 0;
    ids.forEach((id) => {
      const a = state.answers[id];
      if (!a) blank++;
      else if (a === BANK.get(id).answer) correct++;
      else wrong++;
    });
    const score = total ? (correct / total) * 10 : 0;

    const summary = el("div", { class: "result-summary" },
      el("div", { class: "stat-box" }, el("b", { text: score.toFixed(2) }), "Điểm (thang 10)"),
      el("div", { class: "stat-box", style: "color:var(--green)" }, el("b", { text: correct }), "Câu đúng"),
      el("div", { class: "stat-box", style: "color:var(--red)" }, el("b", { text: wrong }), "Câu sai"),
      el("div", { class: "stat-box" }, el("b", { text: blank }), "Chưa làm"),
      mode === "exam" && state.result
        ? el("div", { class: "stat-box" }, el("b", { text: fmtTime(state.result.usedMs) }), "Thời gian làm bài")
        : null
    );

    let filter = "all";
    const list = el("div");
    const filterBar = el("div", { class: "filter-bar" });
    const filters = [
      ["all", `Tất cả (${total})`],
      ["wrong", `Sai (${wrong})`],
      ["blank", `Chưa làm (${blank})`],
      ["correct", `Đúng (${correct})`],
      ["flag", "Đã đánh dấu"]
    ];

    function drawFilters() {
      filterBar.innerHTML = "";
      filters.forEach(([k, label]) => filterBar.append(
        el("button", { class: "btn small" + (filter === k ? " active" : ""), onclick: () => { filter = k; drawFilters(); drawList(); } }, label)
      ));
    }

    function drawList() {
      list.innerHTML = "";
      let shown = 0;
      ids.forEach((id, idx) => {
        const q = BANK.get(id);
        const a = state.answers[id];
        const status = !a ? "blank" : a === q.answer ? "correct" : "wrong";
        if (filter === "flag" ? !(state.flags && state.flags[id]) : (filter !== "all" && filter !== status)) return;
        shown++;
        list.append(el("div", { class: "review-item" },
          el("div", { class: "q-head" },
            el("span", { class: "q-number", text: `Câu ${idx + 1}` }),
            el("span", {
              class: "verdict " + (status === "correct" ? "ok" : "no"),
              style: "margin:0",
              text: status === "correct" ? "✔ Đúng" : status === "wrong" ? `✘ Sai (chọn ${a})` : "— Chưa làm"
            })
          ),
          el("p", { class: "q-text", text: q.question }),
          el("div", { class: "options" },
            q.options.map((opt, i) => {
              const L = letter(i);
              let cls = "option";
              if (L === q.answer) cls += " correct";
              else if (L === a) cls += " wrong";
              return el("button", { class: cls, disabled: true },
                el("span", { class: "letter", text: L }), el("span", { class: "opt-text", text: opt }));
            })
          ),
          q.explanation ? el("div", { class: "explain" }, el("b", { text: "Giải thích: " }), q.explanation) : null
        ));
      });
      if (!shown) list.append(el("p", { class: "muted", text: "Không có câu hỏi nào." }));
    }

    const actions = el("div", { class: "filter-bar", style: "margin-top:0" },
      el("button", { class: "btn", onclick: renderHome }, "🏠 Về trang chủ"),
      mode === "exam"
        ? el("button", { class: "btn primary", onclick: startExam }, "Làm bài thi mới")
        : el("button", { class: "btn primary", onclick: renderPractice }, "Tiếp tục luyện tập")
    );

    app.innerHTML = "";
    app.append(el("div", { class: "card" },
      el("h1", { text: mode === "exam" ? "Kết quả bài thi Real-time" : "Tổng kết luyện tập" }),
      mode === "exam" && state.result
        ? el("p", { class: "muted", text: (state.result.timeout ? "Tự động nộp do hết giờ · " : "") + "Nộp lúc " + fmtDate(state.result.finishedAt) })
        : el("p", { class: "muted", text: "Tiến độ được lưu tự động." }),
      summary,
      actions,
      el("h2", { style: "margin-top:24px", text: "Xem lại đáp án và giải thích" }),
      filterBar,
      list
    ));
    drawFilters();
    drawList();
    window.scrollTo({ top: 0 });
  }

  // ---------- Khởi động ----------
  document.getElementById("brand").addEventListener("click", () => {
    const exam = load(KEY_EXAM);
    if (app.querySelector(".quiz-layout") && exam && !exam.submitted && topRight.querySelector(".timer")) {
      confirmBox("Bạn đang làm bài thi. Về trang chủ? (Thời gian vẫn tiếp tục chạy)", "Về trang chủ", renderHome);
    } else {
      renderHome();
    }
  });

  renderHome();
})();
