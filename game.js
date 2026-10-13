(function () {
  "use strict";
  const W = 1000, H = 600, NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const svg = $("map"), world = $("world");

  const TOTAL = DATA.filter((o) => o.g).length;
  $("of").textContent = "of " + TOTAL + " points";
  $("pb").setAttribute("aria-valuemax", String(TOTAL));
  $("st-left").textContent = TOTAL + " to go";

  // ---- build the map -------------------------------------------------
  world.innerHTML = DATA.map((o, i) =>
    '<path class="land ' + (o.g ? "c" + o.c : "terr") + '" data-i="' + i + '" d="' + o.d + '"/>'
  ).join("");
  const paths = Array.from(world.querySelectorAll("path.land"));
  const dots = {};
  const dotLayer = document.createElementNS(NS, "g");
  world.appendChild(dotLayer);
  const selOutline = document.createElementNS(NS, "path");
  selOutline.setAttribute("id", "selOutline");
  const selDot = document.createElementNS(NS, "circle");
  selDot.setAttribute("id", "selDot");
  world.appendChild(selOutline);
  world.appendChild(selDot);
  const bboxes = [];
  paths.forEach((p, i) => {
    const b = p.getBBox();
    bboxes[i] = b;
    if (DATA[i].g && b.width < 5 && b.height < 5) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("class", "dot c" + DATA[i].c);
      c.setAttribute("data-i", String(i));
      c.setAttribute("cx", String(b.x + b.width / 2));
      c.setAttribute("cy", String(b.y + b.height / 2));
      dotLayer.appendChild(c);
      dots[i] = c;
    }
  });

  // ---- view (zoom and pan) -------------------------------------------
  const view = { k: 1, x: 0, y: 0 };
  function clampView() {
    view.k = Math.min(40, Math.max(1, view.k));
    view.x = Math.min(0, Math.max(W - W * view.k, view.x));
    view.y = Math.min(0, Math.max(H - H * view.k, view.y));
  }
  function applyView() {
    clampView();
    world.setAttribute("transform", "translate(" + view.x + " " + view.y + ") scale(" + view.k + ")");
    const r = 4.6 / view.k;
    for (const i in dots) dots[i].setAttribute("r", String(r));
    selDot.setAttribute("r", selDot.getAttribute("data-on") === "1" ? String(r + 2.2 / view.k) : "0");
  }
  function toSvg(cx, cy) {
    const m = svg.getScreenCTM();
    return m ? new DOMPoint(cx, cy).matrixTransform(m.inverse()) : { x: W / 2, y: H / 2 };
  }
  function zoomAt(px, py, factor) {
    const k0 = view.k;
    const k1 = Math.min(40, Math.max(1, k0 * factor));
    view.x = px - (px - view.x) * (k1 / k0);
    view.y = py - (py - view.y) * (k1 / k0);
    view.k = k1;
    applyView();
  }
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const p = toSvg(e.clientX, e.clientY);
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  $("zin").addEventListener("click", () => zoomAt(W / 2, H / 2, 1.6));
  $("zout").addEventListener("click", () => zoomAt(W / 2, H / 2, 1 / 1.6));
  $("zreset").addEventListener("click", () => { view.k = 1; view.x = 0; view.y = 0; applyView(); });

  const ptrs = new Map();
  let dragged = false, downAt = null, pinch0 = null;
  svg.addEventListener("pointerdown", (e) => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt = { x: e.clientX, y: e.clientY };
    dragged = false;
    if (ptrs.size === 2) {
      const [a, b] = Array.from(ptrs.values());
      pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  });
  svg.addEventListener("pointermove", (e) => {
    const prev = ptrs.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (ptrs.size === 2 && pinch0) {
      ptrs.set(e.pointerId, cur);
      const [a, b] = Array.from(ptrs.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0.d > 0) {
        const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(mid.x, mid.y, d / pinch0.d);
      }
      pinch0.d = d;
      dragged = true;
      return;
    }
    if (!dragged && downAt && Math.hypot(cur.x - downAt.x, cur.y - downAt.y) < 6) return;
    if (!dragged) { dragged = true; svg.classList.add("dragging"); }
    const m = svg.getScreenCTM();
    const scale = m ? m.a : 1;
    view.x += (cur.x - prev.x) / scale;
    view.y += (cur.y - prev.y) / scale;
    ptrs.set(e.pointerId, cur);
    applyView();
  });
  function endPtr(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch0 = null;
    if (ptrs.size === 0) svg.classList.remove("dragging");
  }
  svg.addEventListener("pointerup", endPtr);
  svg.addEventListener("pointercancel", endPtr);
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") endPtr(e); });
  svg.addEventListener("click", (e) => {
    if (dragged) { dragged = false; return; }
    const t = e.target;
    const idx = t && t.getAttribute ? t.getAttribute("data-i") : null;
    if (idx !== null) select(Number(idx));
  });

  function focusOn(i) {
    const b = bboxes[i];
    const k = Math.min(16, Math.max(1, Math.min((W * 0.28) / Math.max(b.width, 1), (H * 0.28) / Math.max(b.height, 1))));
    view.k = k;
    view.x = W / 2 - (b.x + b.width / 2) * k;
    view.y = H / 2 - (b.y + b.height / 2) * k;
    applyView();
  }

  // ---- game state ----------------------------------------------------
  let right = new Set(), missed = new Set();
  let sel = -1, revealed = false, justScored = null, confirmReset = false;
  const indexByName = new Map(DATA.map((o, i) => [o.n, i]));

  function paint(i) {
    const els = [paths[i], dots[i]].filter(Boolean);
    const n = DATA[i].n;
    els.forEach((el) => {
      el.classList.toggle("right", right.has(n));
      el.classList.toggle("missed", missed.has(n) && !right.has(n));
    });
  }
  function paintAll() { DATA.forEach((o, i) => { if (o.g) paint(i); }); }

  function drawSelection() {
    if (sel < 0) { selOutline.removeAttribute("d"); selDot.setAttribute("data-on", "0"); selDot.setAttribute("r", "0"); return; }
    if (dots[sel]) {
      selOutline.removeAttribute("d");
      selDot.setAttribute("cx", dots[sel].getAttribute("cx"));
      selDot.setAttribute("cy", dots[sel].getAttribute("cy"));
      selDot.setAttribute("data-on", "1");
      selDot.setAttribute("r", String(4.6 / view.k + 2.2 / view.k));
    } else {
      selDot.setAttribute("data-on", "0");
      selDot.setAttribute("r", "0");
      selOutline.setAttribute("d", DATA[sel].d);
    }
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function btn(label, cls, fn) {
    const b = el("button", "btn " + (cls || ""), label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function renderState() {
    const box = $("state");
    box.replaceChildren();
    const wrap = el("div"); wrap.style.display = "grid"; wrap.style.gap = "12px";
    if (sel < 0) {
      wrap.append(el("h2", "", "Pick a country"),
        el("p", "", "Click any coloured country on the map and say its name to yourself, then check your answer."));
    } else if (!DATA[sel].g) {
      wrap.append(el("h2", "", "Not part of the game"), el("p", "answer", DATA[sel].n),
        el("p", "", "This is a territory or disputed area, so it is not scored."));
    } else if (right.has(DATA[sel].n)) {
      wrap.append(el("p", "answer", DATA[sel].n), el("p", "good", "You already scored this one."));
    } else if (justScored === DATA[sel].n) {
      wrap.append(el("p", "answer", DATA[sel].n), el("p", "", "Marked as missed. Click it again later to retry."));
    } else if (!revealed) {
      const row = el("div", "row");
      row.append(btn("Show the answer", "primary", () => { revealed = true; renderState(); }));
      wrap.append(el("h2", "", "Which country is this?"),
        el("p", "", "Make your guess first, then check."), row);
    } else {
      const row = el("div", "row");
      row.append(btn("I got it, +1", "primary", () => score(true)), btn("I missed it", "", () => score(false)));
      wrap.append(el("p", "", "The answer is"), el("p", "answer", DATA[sel].n), el("p", "", "Did you guess it?"), row);
    }
    box.append(wrap);

    const nRight = right.size, nMissed = Array.from(missed).filter((n) => !right.has(n)).length;
    $("score").textContent = String(nRight);
    $("pbi").style.width = (100 * nRight / TOTAL).toFixed(1) + "%";
    $("pb").setAttribute("aria-valuenow", String(nRight));
    $("st-right").textContent = nRight + " right";
    $("st-missed").textContent = nMissed + " missed";
    $("st-left").textContent = (TOTAL - nRight) + " to go";
    const rb = $("reset");
    rb.textContent = confirmReset ? "Yes, erase my score" : "Start over";
    rb.classList.toggle("primary", confirmReset);
  }

  function select(i) {
    sel = i; revealed = false; justScored = null; confirmReset = false;
    drawSelection(); renderState();
  }
  function score(ok) {
    const n = DATA[sel].n;
    if (ok) { right.add(n); missed.delete(n); justScored = null; }
    else { if (!right.has(n)) missed.add(n); justScored = n; }
    revealed = true;
    paint(sel); renderState(); save();
  }

  $("random").addEventListener("click", () => {
    const pool = [];
    DATA.forEach((o, i) => { if (o.g && !right.has(o.n)) pool.push(i); });
    if (!pool.length) return;
    const i = pool[Math.floor(Math.random() * pool.length)];
    select(i); focusOn(i); drawSelection();
  });
  $("reset").addEventListener("click", () => {
    if (!confirmReset) { confirmReset = true; renderState(); return; }
    right = new Set(); missed = new Set(); confirmReset = false; sel = -1; justScored = null;
    paintAll(); drawSelection(); renderState(); save();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { sel = -1; confirmReset = false; drawSelection(); renderState(); }
  });

  // ---- saving progress -------------------------------------------------
  // Always saved in this browser (localStorage). If firebase-config.js is filled in,
  // signing in with Google also syncs progress through Firestore across devices.
  const STORE_KEY = "name-that-country:progress";
  let saveOk = true, cloud = null, cloudOk = true, firstSnap = true;
  const authBtn = $("auth");

  function setSaveNote() {
    $("save").textContent = !saveOk ? "Progress could not be saved in this browser."
      : !cloud ? "Progress is saved in this browser."
      : !cloud.user ? "Progress is saved in this browser. Sign in to sync it across devices."
      : !cloudOk ? "Saved in this browser; syncing to your account failed just now."
      : "Progress syncs to your Google account across devices.";
    if (cloud) {
      authBtn.hidden = false;
      authBtn.textContent = cloud.user ? "Sign out" : "Sign in with Google to sync";
    }
  }
  function snapshot() { return { right: Array.from(right), missed: Array.from(missed) }; }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(snapshot())); saveOk = true; }
    catch (err) { saveOk = false; }
    pushCloud();
    setSaveNote();
  }
  function keep(a) {
    return new Set((Array.isArray(a) ? a : []).filter((n) => indexByName.has(n) && DATA[indexByName.get(n)].g));
  }
  function applyProgress(d) {
    right = keep(d && d.right);
    missed = keep(d && d.missed);
    paintAll(); renderState();
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) applyProgress(JSON.parse(raw));
    } catch (err) { saveOk = false; }
  }

  // ---- optional cloud sync (Firebase) -----------------------------------
  let writing = false, pending = false;
  async function pushCloud() {
    if (!cloud || !cloud.user) return;
    pending = true;
    if (writing) return;
    writing = true;
    try {
      while (pending) {
        pending = false;
        await cloud.doc.set(snapshot());
      }
      cloudOk = true;
    } catch (err) { cloudOk = false; pending = false; }
    writing = false;
    setSaveNote();
  }
  function startCloudSync(user) {
    cloud.user = user;
    cloud.doc = cloud.db.collection("progress").doc(user.uid);
    firstSnap = true;
    cloud.unsub = cloud.doc.onSnapshot((snap) => {
      if (writing || pending || snap.metadata.hasPendingWrites) return;
      const d = snap.exists ? snap.data() : null;
      if (firstSnap) {
        // First load after sign-in: merge, so offline progress is never lost.
        firstSnap = false;
        const r = new Set([...right, ...keep(d && d.right)]);
        const m = new Set([...missed, ...keep(d && d.missed)]);
        r.forEach((n) => m.delete(n));
        right = r; missed = m;
        paintAll(); renderState();
        try { localStorage.setItem(STORE_KEY, JSON.stringify(snapshot())); } catch (e) {}
        pushCloud();
      } else if (d) {
        applyProgress(d);
        try { localStorage.setItem(STORE_KEY, JSON.stringify(snapshot())); } catch (e) {}
      }
    }, () => { cloudOk = false; setSaveNote(); });
    setSaveNote();
  }
  function initCloud() {
    const cfg = window.FIREBASE_CONFIG;
    if (!window.firebase || !cfg || !cfg.apiKey || cfg.apiKey.indexOf("PASTE") === 0) return;
    try {
      firebase.initializeApp(cfg);
      cloud = { db: firebase.firestore(), auth: firebase.auth(), user: null, doc: null, unsub: null };
      cloud.auth.onAuthStateChanged((user) => {
        if (cloud.unsub) { cloud.unsub(); cloud.unsub = null; }
        cloud.user = null; cloud.doc = null;
        if (user) startCloudSync(user); else setSaveNote();
      });
      authBtn.addEventListener("click", async () => {
        try {
          if (cloud.user) await cloud.auth.signOut();
          else await cloud.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        } catch (err) { cloudOk = false; setSaveNote(); }
      });
      setSaveNote();
    } catch (err) { cloud = null; }
  }

  applyView();
  renderState();
  load();
  setSaveNote();
  initCloud();
})();
