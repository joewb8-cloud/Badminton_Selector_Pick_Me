// Badminton Player Selector - PWA version
const START_RATING = 1000, K_FACTOR = 32, MAX_COURTS = 2, STORE = "badmintonSelector";
const $ = id => document.getElementById(id);
const pairKey = (a, b) => [a, b].sort().join("\u0001");

let S = {
  players: [], numCourts: 1,
  partner: {}, meet: {}, played: {}, rating: {}, wins: {}, gamesNo: 0,
  courts: [{ game: null, pending: false, info: "", manual: false },
           { game: null, pending: false, info: "", manual: false }]
};

// ---------- persistence ----------
function save() { localStorage.setItem(STORE, JSON.stringify(S)); }
function load() {
  try { const d = JSON.parse(localStorage.getItem(STORE)); if (d && d.players) S = Object.assign(S, d); }
  catch (e) {}
}

// ---------- helpers ----------
const getRating = p => S.rating[p] ?? START_RATING;
const teamRating = t => t.reduce((s, p) => s + getRating(p), 0) / t.length;
const winChance = (t1, t2) => 1 / (1 + 10 ** ((teamRating(t2) - teamRating(t1)) / 400));
const inc = (d, k) => d[k] = (d[k] || 0) + 1;
const dec = (d, k) => { if ((d[k] || 0) > 1) d[k]--; else delete d[k]; };
const activeCourts = () => S.courts.slice(0, S.numCourts);

function combinations(arr, k) {
  const out = [];
  (function go(start, combo) {
    if (combo.length === k) { out.push(combo.slice()); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); go(i + 1, combo); combo.pop(); }
  })(0, []);
  return out;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const splits = ([a, b, c, d]) => [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
const partnerRepeats = (t1, t2) => (S.partner[pairKey(...t1)] || 0) + (S.partner[pairKey(...t2)] || 0);
const oppRepeats = (t1, t2) => t1.reduce((s, x) => s + t2.reduce((s2, y) => s2 + (S.meet[pairKey(x, y)] || 0), 0), 0);

function partnershipsDone() {
  const all = combinations(S.players, 2);
  return [all.filter(([a, b]) => S.partner[pairKey(a, b)] > 0).length, all.length];
}
function playersOnCourt(skip = null) {
  const busy = new Set();
  activeCourts().forEach(c => { if (c !== skip && c.pending) [...c.game[0], ...c.game[1]].forEach(p => busy.add(p)); });
  return busy;
}

// ---------- selection logic ----------
function chooseGame(exclude = new Set(), mustInclude = []) {
  const must = mustInclude.filter(p => !exclude.has(p));
  let pool = S.players.filter(p => !exclude.has(p) && !must.includes(p));
  if (pool.length + must.length < 4) return null;
  if (pool.length + must.length > 12) {
    shuffle(pool); pool.sort((a, b) => (S.played[a] || 0) - (S.played[b] || 0));
    pool = pool.slice(0, 12 - must.length);
  }
  let best = null, bestScore = Infinity;
  for (const rest of combinations(pool, 4 - must.length)) {
    const four = [...must, ...rest];
    const games = four.reduce((s, p) => s + (S.played[p] || 0), 0);
    for (const [t1, t2] of splits(four)) {
      const score = partnerRepeats(t1, t2) * 1000 + games * 50 +
        Math.abs(teamRating(t1) - teamRating(t2)) * 1.5 + oppRepeats(t1, t2) * 5 + Math.random();
      if (score < bestScore) { bestScore = score; best = [t1, t2]; }
    }
  }
  return best;
}
function bestSplit(four) {
  let best = null, bestScore = Infinity;
  for (const [t1, t2] of splits(four)) {
    const score = partnerRepeats(t1, t2) * 1000 + Math.abs(teamRating(t1) - teamRating(t2)) * 1.5 + oppRepeats(t1, t2) * 5;
    if (score < bestScore) { bestScore = score; best = [t1, t2]; }
  }
  return best;
}
function recordGame(t1, t2, undo = false) {
  const f = undo ? dec : inc;
  f(S.partner, pairKey(...t1)); f(S.partner, pairKey(...t2));
  t1.forEach(x => t2.forEach(y => f(S.meet, pairKey(x, y))));
  [...t1, ...t2].forEach(p => f(S.played, p));
  S.gamesNo = Math.max(0, S.gamesNo + (undo ? -1 : 1));
}
function startGame(court, game, manual = false) {
  recordGame(...game);
  Object.assign(court, { game, pending: true, manual });
  const [t1, t2] = game;
  court.info = `${manual ? "(Manual pick)  " : ""}Team A ${Math.round(teamRating(t1))}  vs  Team B ${Math.round(teamRating(t2))}  ·  Team A win chance ${Math.round(winChance(t1, t2) * 100)}%`;
}
function afterSelection() {
  const [done, total] = partnershipsDone();
  if (total && done === total) {
    alert("Rotation Complete!\n\nEveryone has now partnered everyone else at least once.\nPartnership history will reset for a fresh rotation. Ratings and wins are kept.");
    S.partner = {}; S.meet = {};
  }
  render();
}
function selectAllCourts() {
  const needed = 4 * S.numCourts;
  if (S.players.length < needed) return alert(`You need at least ${needed} players.`);
  if (activeCourts().some(c => c.pending) && !confirm("At least one game has no result recorded.\n\nSkip it and pick new games?")) return;
  activeCourts().forEach(c => c.pending = false);
  const picked = new Set();
  for (const c of activeCourts()) {
    const g = chooseGame(picked); if (!g) break;
    [...g[0], ...g[1]].forEach(p => picked.add(p));
    startGame(c, g);
  }
  afterSelection();
}
function selectForCourt(i) {
  const c = S.courts[i];
  if (c.pending && !confirm(`Court ${i + 1} has no result recorded.\n\nSkip it and pick a new game?`)) return;
  const g = chooseGame(playersOnCourt(c));
  if (!g) return alert(`There aren't 4 free players for Court ${i + 1}.\nRecord the result on the other court first, or add more players.`);
  c.pending = false; startGame(c, g); afterSelection();
}
function recordResult(i, winner) {
  const c = S.courts[i]; if (!c.pending) return;
  const [t1, t2] = c.game;
  const change = K_FACTOR * ((winner === 0 ? 1 : 0) - winChance(t1, t2));
  t1.forEach(p => S.rating[p] = getRating(p) + change);
  t2.forEach(p => S.rating[p] = getRating(p) - change);
  const winners = winner === 0 ? t1 : t2;
  winners.forEach(p => inc(S.wins, p));
  c.pending = false;
  c.info = `Result saved: ${winners.join(" & ")} won (ratings moved by ${Math.abs(Math.round(change))})`;
  render();
}
function clearCourt(c) { Object.assign(c, { game: null, pending: false, info: "", manual: false }); }

// ---------- player management ----------
function addPlayer(name) {
  name = name.trim();
  if (!name) return alert("Please enter a player name.");
  if (S.players.some(p => p.toLowerCase() === name.toLowerCase())) return alert("That player is already in the list.");
  S.players.push(name); render();
}
function removePlayer(name) {
  if (!confirm(`Remove ${name}?`)) return;
  S.players = S.players.filter(p => p !== name);
  [S.played, S.rating, S.wins].forEach(d => delete d[name]);
  [S.partner, S.meet].forEach(d => Object.keys(d).forEach(k => { if (k.split("\u0001").includes(name)) delete d[k]; }));
  S.courts.forEach(c => { if (c.game && [...c.game[0], ...c.game[1]].includes(name)) clearCourt(c); });
  render();
}

// ---------- rendering ----------
function render() {
  const n = S.players.length;
  $("playerCount").textContent = `${n} player${n === 1 ? "" : "s"}`;
  const busy = playersOnCourt();
  const list = $("playerList"); list.innerHTML = "";
  if (!n) list.innerHTML = '<li class="muted" style="font-weight:400">No players added yet.</li>';
  S.players.forEach(p => {
    const li = document.createElement("li");
    if (busy.has(p)) li.className = "oncourt";
    li.innerHTML = `<span></span><button>Remove</button>`;
    li.firstChild.textContent = p + " ";
    const st = document.createElement("span"); st.className = "stats";
    st.textContent = `${S.wins[p] || 0}W/${S.played[p] || 0}G · ${Math.round(getRating(p))}`;
    li.firstChild.appendChild(st);
    li.lastChild.onclick = () => removePlayer(p);
    list.appendChild(li);
  });

  document.querySelectorAll(".toggle button").forEach(b => b.classList.toggle("on", +b.dataset.courts === S.numCourts));
  $("selectAllBtn").textContent = `Select ${4 * S.numCourts} Players`;
  $("selectAllBtn").disabled = n < 4 * S.numCourts;
  const [done, total] = partnershipsDone();
  $("progress").textContent = `Games played: ${S.gamesNo}  ·  Partnerships covered: ${done} of ${total}`;

  const wrap = $("courts"); wrap.innerHTML = ""; wrap.className = S.numCourts === 2 ? "two" : "";
  activeCourts().forEach((c, i) => {
    const el = document.createElement("div"); el.className = "court";
    const names = c.game ? [...c.game[0], ...c.game[1]] : [];
    el.innerHTML = `
      <div class="head"><h3>Court ${i + 1}</h3>
        ${S.numCourts === 2 ? `<button class="btn teal" data-act="next">Next Game</button>` : ""}
        <button class="btn outline" data-act="manual">Manual Pick</button></div>
      <div class="info"></div>
      <div class="grid">${[0, 1, 2, 3].map(j => `
        <div class="box ${c.game ? (j < 2 ? "a" : "b") : ""}">
          <div class="t">${j < 2 ? "TEAM A" : "TEAM B"} - ${S.numCourts === 1 ? "PLAYER " : "P"}${j % 2 + 1}</div>
          <div class="n"></div></div>`).join("")}</div>
      <div class="res"><button class="btn green" data-act="a">Team A Won</button>
        <button class="btn blue" data-act="b">Team B Won</button></div>`;
    el.querySelector(".info").textContent = c.info;
    el.querySelectorAll(".n").forEach((d, j) => d.textContent = names[j] || "Waiting for selection...");
    const q = a => el.querySelector(`[data-act="${a}"]`);
    if (q("next")) { q("next").onclick = () => selectForCourt(i); q("next").disabled = n < 4; }
    q("manual").onclick = () => openManual(i); q("manual").disabled = n < 4;
    q("a").onclick = () => recordResult(i, 0); q("b").onclick = () => recordResult(i, 1);
    q("a").disabled = q("b").disabled = !c.pending;
    wrap.appendChild(el);
  });
  save();
}

// ---------- manual pick ----------
let manualCourt = 0, manualBusy = new Set();
const slots = () => [...document.querySelectorAll("#manualSlots select")];
const chosen = () => slots().map(s => s.value);

function openManual(i) {
  const c = S.courts[i];
  manualCourt = i; manualBusy = playersOnCourt(c);
  const avail = S.players.filter(p => !manualBusy.has(p));
  if (avail.length < 4) return alert(`There aren't 4 free players for Court ${i + 1}.\nRecord the result on the other court first, or add more players.`);
  $("manualTitle").textContent = `Choose players for Court ${i + 1}`;
  $("manualHint").textContent = "Pick all 4, or pick some and press Auto-fill Rest." +
    (manualBusy.size ? " Players on the other court are not listed." : "");
  const box = $("manualSlots"); box.innerHTML = "";
  ["Team A - Player 1", "Team A - Player 2", "Team B - Player 1", "Team B - Player 2"].forEach((label, j) => {
    const row = document.createElement("div"); row.className = "slot";
    row.innerHTML = `<label style="color:${j < 2 ? "#047857" : "#1D4ED8"}">${label}</label><select><option value="">-- choose --</option></select>`;
    const sel = row.querySelector("select");
    avail.forEach(p => { const o = document.createElement("option"); o.value = o.textContent = p; sel.appendChild(o); });
    sel.onchange = updatePreview;
    box.appendChild(row);
  });
  if (c.game) [...c.game[0], ...c.game[1]].forEach((p, j) => { if (avail.includes(p)) slots()[j].value = p; });
  updatePreview();
  $("manualDlg").showModal();
}
function setSlots([t1, t2]) { [...t1, ...t2].forEach((p, j) => slots()[j].value = p); updatePreview(); }
const hasDupes = arr => new Set(arr).size !== arr.length;
function updatePreview() {
  const picks = chosen(), filled = picks.filter(Boolean), pv = $("manualPreview");
  if (hasDupes(filled)) { pv.textContent = "The same player is selected more than once."; pv.style.color = "#DC2626"; }
  else if (filled.length === 4) {
    const t1 = picks.slice(0, 2), t2 = picks.slice(2);
    pv.textContent = `Team A ${Math.round(teamRating(t1))}  vs  Team B ${Math.round(teamRating(t2))}  ·  Team A win chance ${Math.round(winChance(t1, t2) * 100)}%`;
    pv.style.color = "#0F172A";
  } else { pv.textContent = `${filled.length} of 4 players selected.`; pv.style.color = "#64748B"; }
}
$("autoFillBtn").onclick = () => {
  const filled = chosen().filter(Boolean);
  if (hasDupes(filled)) return alert("Each player can only be picked once.");
  const g = chooseGame(manualBusy, filled); if (g) setSlots(g);
};
$("balanceBtn").onclick = () => {
  const p = chosen();
  if (!p.every(Boolean) || hasDupes(p)) return alert("Select 4 different players first.");
  setSlots(bestSplit(p));
};
$("clearBtn").onclick = () => { slots().forEach(s => s.value = ""); updatePreview(); };
$("cancelManualBtn").onclick = () => $("manualDlg").close();
$("startManualBtn").onclick = () => {
  const p = chosen(), c = S.courts[manualCourt];
  if (!p.every(Boolean)) return alert("Please fill all 4 positions.");
  if (hasDupes(p)) return alert("Each player can only be picked once.");
  if (c.pending) {
    if (!confirm(`Court ${manualCourt + 1} already has a game with no result.\n\nReplace it with this one?`)) return;
    recordGame(...c.game, true);   // old game was never played
  }
  $("manualDlg").close();
  startGame(c, [p.slice(0, 2), p.slice(2)], true);
  afterSelection();
};

// ---------- wiring ----------
$("addForm").onsubmit = e => { e.preventDefault(); addPlayer($("nameInput").value); $("nameInput").value = ""; $("nameInput").focus(); };
$("selectAllBtn").onclick = selectAllCourts;
$("restartBtn").onclick = () => { S.courts.forEach(clearCourt); render(); };
$("resetBtn").onclick = () => {
  if (!confirm("Clear all pairing history, wins and ratings?")) return;
  Object.assign(S, { partner: {}, meet: {}, played: {}, rating: {}, wins: {}, gamesNo: 0 });
  S.courts.forEach(clearCourt); render();
};
document.querySelectorAll(".toggle button").forEach(b => b.onclick = () => {
  const n = +b.dataset.courts; if (n === S.numCourts) return;
  if (n < S.numCourts) {
    const dropped = S.courts.slice(n, S.numCourts);
    if (dropped.some(c => c.pending) && !confirm("Court 2 has a game with no result recorded.\n\nSwitch to 1 court and discard it?")) return;
    dropped.forEach(clearCourt);
  }
  S.numCourts = n; render();
});
$("exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" }));
  a.download = `badminton-${new Date().toISOString().slice(0, 10)}.json`; a.click();
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    try { const d = JSON.parse(t); if (!Array.isArray(d.players)) throw 0; S = Object.assign(S, d); render(); }
    catch { alert("That file isn't a valid Badminton Selector export."); }
    e.target.value = "";
  });
};

load(); render();
