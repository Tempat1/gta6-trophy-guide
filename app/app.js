// GTA VI Trophy Guide — tracker logic. Loads the 55 trophies from ./data/trophies.json,
// renders the checklist, and keeps earned flags in localStorage ("gta6-trophy-guide-v1").
// Vanilla JS, zero network beyond the local data file.

const KEY = 'gta6-trophy-guide-v1';
const GRADE_ORDER = ['Platinum', 'Gold', 'Silver', 'Bronze'];
const GRADE_RANK = { Platinum: 0, Gold: 1, Silver: 2, Bronze: 3 };
const CATEGORIES = ['Story', 'Exploration', 'Combat', 'Driving', 'Collectibles', 'Side', 'Misc'];
const WHY = {
  1: 'Do first — potentially missable',
  2: 'Story — unlocks naturally',
  3: 'Quick win',
  4: 'Grind — chip away at it',
};

const $ = (id) => document.getElementById(id);
const grid = $('grid');
const emptyState = $('emptyState');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) if (v === true) out[k] = true;
    return out;
  } catch {
    return {};
  }
}

let earned = loadProgress();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(earned));
  } catch {
    // storage full or unavailable — progress just won't persist
  }
}

let data;
try {
  const res = await fetch('./data/trophies.json');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  data = await res.json();
} catch (err) {
  grid.innerHTML =
    '<p class="load-error">Could not load the trophy list (trophies.json). ' +
    'Please reload the page — the guide works fully offline once its files are served.</p>';
  $('resultCount').textContent = 'Trophy list failed to load';
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

const trophies = data.trophies;
const total = trophies.length;
const byId = new Map(trophies.map((t) => [t.id, t]));
const platinum = trophies.find((t) => t.grade === 'Platinum');

// ---- filter state (from query params, applied before the first render) ----
const params = new URLSearchParams(location.search);
const state = {
  q: '',
  category: 'all',
  sort: 'default',
  grade: 'all',
  status: 'all',
  spoilers: false,
};
const qParam = params.get('q');
if (qParam) state.q = qParam;
const gradeParam = params.get('grade');
if (gradeParam && GRADE_ORDER.includes(gradeParam)) state.grade = gradeParam;
const sortParam = params.get('sort');
if (sortParam && ['default', 'name', 'grade', 'easiest'].includes(sortParam)) state.sort = sortParam;

// ---- controls ----
const searchInput = $('search');
const categorySelect = $('categorySelect');
const sortSelect = $('sortSelect');
const gradePills = $('gradePills');
const statusPills = $('statusPills');
const spoilerToggle = $('spoilerToggle');

searchInput.value = state.q;
categorySelect.value = state.category;
sortSelect.value = state.sort;

searchInput.addEventListener('input', () => { state.q = searchInput.value; render(); });
categorySelect.addEventListener('change', () => { state.category = categorySelect.value; render(); });
sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; render(); });
spoilerToggle.addEventListener('change', () => { state.spoilers = spoilerToggle.checked; render(); });

function wirePills(container, key) {
  container.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      state[key] = pill.dataset[key];
      container.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p === pill));
      render();
    });
  });
}
wirePills(gradePills, 'grade');
wirePills(statusPills, 'status');

function syncPills() {
  gradePills.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p.dataset.grade === state.grade));
  statusPills.querySelectorAll('.pill').forEach((p) => p.classList.toggle('active', p.dataset.status === state.status));
}

// ---- filtering / sorting ----
function visibleTrophies() {
  const q = state.q.trim().toLowerCase();
  let list = trophies.filter((t) => {
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    if (state.category !== 'all' && t.category !== state.category) return false;
    if (state.status === 'earned' && !earned[t.id]) return false;
    if (state.status === 'unearned' && earned[t.id]) return false;
    if (q) {
      const hay = (t.name + ' ' + t.desc + ' ' + t.tip + ' ' + t.category + ' ' + t.grade).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (state.sort === 'name') {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.sort === 'grade') {
    list = [...list].sort((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || a.name.localeCompare(b.name));
  } else if (state.sort === 'easiest') {
    list = [...list].sort((a, b) =>
      a.priority - b.priority || GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || a.name.localeCompare(b.name));
  }
  return list;
}

// ---- rendering ----
function renderProgress() {
  const earnedList = trophies.filter((t) => earned[t.id]);
  const n = earnedList.length;
  const pct = Math.round((n / total) * 100);
  const points = earnedList.reduce((sum, t) => sum + t.points, 0);

  $('pctBig').textContent = pct + '%';
  $('earnedCount').textContent = String(n);
  $('totalCount').textContent = String(total);
  $('pointsLabel').textContent = points.toLocaleString('en-US') + ' / 1,000 Gamerscore (Xbox equivalent)';
  $('progressFill').style.width = pct + '%';
  $('progressBar').setAttribute('aria-valuenow', String(pct));
  $('barLabel').textContent = n + ' of ' + total + ' trophies earned';

  $('gradeChips').innerHTML = GRADE_ORDER.map((g) => {
    const have = earnedList.filter((t) => t.grade === g).length;
    const want = trophies.filter((t) => t.grade === g).length;
    return '<span class="grade-chip grade-' + g.toLowerCase() + '">' + have + ' / ' + want + ' ' + g + '</span>';
  }).join('');

  $('catBars').innerHTML = CATEGORIES.map((c) => {
    const inCat = trophies.filter((t) => t.category === c);
    const have = inCat.filter((t) => earned[t.id]).length;
    const cpct = inCat.length ? Math.round((have / inCat.length) * 100) : 0;
    return '<div class="cat-row"><div class="cat-label"><span>' + esc(c) + '</span><span>' +
      have + ' / ' + inCat.length + ' · ' + cpct + '%</span></div>' +
      '<div class="cat-track"><div class="cat-fill" style="width:' + cpct + '%"></div></div></div>';
  }).join('');

  if (platinum && earned[platinum.id]) {
    $('platCallout').textContent = 'Leonida Legend! You earned the Platinum — Vice Got a Price! Every trophy is yours.';
  } else {
    const before = n;
    const toGo = total - 1 - n;
    $('platCallout').textContent = 'Platinum progress: ' + before + ' / 54 trophies before the Platinum. ' + toGo + ' to go.';
  }
}

function renderNextUp() {
  const remaining = trophies
    .filter((t) => t.grade !== 'Platinum' && !earned[t.id])
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
  const list = $('nextList');
  if (!remaining.length) {
    list.innerHTML = '<li class="next-done">Leonida Legend! Every trophy is checked off — including the Platinum. Time to enjoy Vice City.</li>';
    return;
  }
  list.innerHTML = remaining.map((t, i) =>
    '<li class="next-item" tabindex="0" role="button" data-id="' + esc(t.id) + '">' +
    '<span class="next-rank">' + (i + 1) + '</span>' +
    '<span class="next-body"><span class="next-why">' + esc(WHY[t.priority] || 'Grind — chip away at it') + '</span>' +
    '<span class="next-name">' + esc(t.name) + ' <span class="badge ' + t.grade.toLowerCase() + '">' + t.grade + '</span></span>' +
    '<span class="next-desc">' + esc(t.desc) + '</span>' +
    '<span class="next-tip"><strong>How to unlock:</strong> ' + esc(t.tip) + '</span></span></li>'
  ).join('');
}

function cardHtml(t) {
  const isEarned = !!earned[t.id];
  const classes = ['card'];
  if (isEarned) classes.push('earned');
  if (t.missable && !isEarned) classes.push('missable');
  const blur = state.spoilers && t.category === 'Story';
  const tags = ['<span class="tag">' + esc(t.category) + '</span>'];
  if (t.hidden) tags.push('<span class="tag tag-hidden">Hidden</span>');
  if (t.missable) tags.push('<span class="tag tag-missable">Potentially missable</span>');
  tags.push('<span class="tag tag-points">' + t.points + 'G</span>');
  return '<article class="' + classes.join(' ') + '" data-id="' + esc(t.id) + '">' +
    '<div class="card-top"><input type="checkbox" class="check" data-id="' + esc(t.id) + '"' +
    (isEarned ? ' checked' : '') + ' aria-label="Mark ' + esc(t.name) + ' as earned">' +
    '<h3 class="' + (blur ? 'spoiler-blur' : '') + '">' + esc(t.name) + (isEarned ? ' <span class="earned-mark">✓</span>' : '') + '</h3>' +
    '<span class="badge ' + t.grade.toLowerCase() + '">' + t.grade + '</span></div>' +
    '<p class="desc' + (blur ? ' spoiler-blur' : '') + '">' + esc(t.desc) + '</p>' +
    '<p class="tip"><strong>How to unlock:</strong> ' + esc(t.tip) + '</p>' +
    '<div class="meta">' + tags.join('') + '</div></article>';
}

function renderGrid() {
  const list = visibleTrophies();
  grid.innerHTML = list.map(cardHtml).join('');
  emptyState.hidden = list.length !== 0;
  $('resultCount').textContent = list.length + ' of ' + total + ' trophies shown';
}

function render() {
  syncPills();
  renderProgress();
  renderNextUp();
  renderGrid();
}

// Checkbox toggling (event delegation — cards are re-rendered on every change).
grid.addEventListener('change', (e) => {
  const box = e.target.closest('.check');
  if (!box) return;
  const id = box.dataset.id;
  if (box.checked) earned[id] = true;
  else delete earned[id];
  save();
  render();
});

// Next Up: click or Enter/Space jumps to the trophy card.
$('nextList').addEventListener('click', (e) => {
  const item = e.target.closest('.next-item');
  if (item) jumpTo(item.dataset.id);
});
$('nextList').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const item = e.target.closest('.next-item');
  if (!item) return;
  e.preventDefault();
  jumpTo(item.dataset.id);
});

function jumpTo(id) {
  state.q = '';
  state.category = 'all';
  state.sort = 'default';
  state.grade = 'all';
  state.status = 'all';
  searchInput.value = '';
  categorySelect.value = 'all';
  sortSelect.value = 'default';
  render();
  const card = grid.querySelector('[data-id="' + id + '"]');
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 2000);
}

// Copy progress summary.
const copyBtn = $('copyBtn');
const COPY_LABEL = 'Copy progress summary';
copyBtn.addEventListener('click', async () => {
  const earnedList = trophies.filter((t) => earned[t.id]);
  const pct = Math.round((earnedList.length / total) * 100);
  const lines = ['GTA VI — ' + earnedList.length + '/' + total + ' trophies (' + pct + '%)'];
  for (const t of earnedList) lines.push('✓ ' + t.name + ' (' + t.grade + ')');
  const text = lines.join('\n');
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch { /* fall through to the textarea fallback */ }
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    } catch { ok = false; }
  }
  copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
  setTimeout(() => { copyBtn.textContent = COPY_LABEL; }, 2000);
});

// Two-step reset.
const resetBtn = $('resetBtn');
const RESET_LABEL = 'Reset progress';
let resetArmed = false;
let resetTimer = null;
resetBtn.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    resetBtn.textContent = 'Sure? Click again to reset';
    resetBtn.classList.add('armed');
    resetTimer = setTimeout(() => {
      resetArmed = false;
      resetBtn.textContent = RESET_LABEL;
      resetBtn.classList.remove('armed');
    }, 3000);
    return;
  }
  clearTimeout(resetTimer);
  resetArmed = false;
  resetBtn.textContent = RESET_LABEL;
  resetBtn.classList.remove('armed');
  earned = {};
  save();
  render();
});

render();
requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
