/* =====================================================================
   Dash. — Schedule & Task Dashboard
   Vanilla JS. Data persists in localStorage. Exports to Google Calendar
   via .ics download and prefilled Google Calendar URLs.
   ===================================================================== */
(() => {
  'use strict';

  /* ---------------------------- Constants ---------------------------- */
  const HOUR_H = 80, START_H = 8, END_H = 18;          // grid: 8:00 AM – 6:00 PM (last label 5 PM)
  const KEYS = { events: 'dash.events.v1', tasks: 'dash.tasks.v1', ui: 'dash.ui.v1' };

  const CATS = {
    prayer:   { label: 'Prayer',   color: 'pink' },
    murojaah: { label: 'Murojaah', color: 'purple' },
    kajian:   { label: 'Kajian',   color: 'mint' },
    study:    { label: 'Study',    color: 'peach' },
    project:  { label: 'Project',  color: 'lavender' },
  };
  const COLOR_NAMES = ['pink', 'purple', 'mint', 'blue', 'peach', 'lavender'];
  const TEAM = ['Syeikh Fulan', 'KH. Ahmad', 'A. Abdul', 'Aisha Rahman', 'Omar Faruq', 'Layla Hasan'];
  const AV_COLORS = ['#e5528a', '#6d63d9', '#2ea36b', '#3b8fd6', '#e08a5b', '#9a7bd8', '#0f766e'];

  const ICONS = {
    prayer:   '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    murojaah: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    kajian:   '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    study:    '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5"/>',
    project:  '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  };

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const WD_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const WD_MON_FIRST = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  const WD_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /* ----------------------------- Helpers ----------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7));         // Monday-first
  const sameDay = (a, b) => ymd(a) === ymd(b);
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const fmtTime = t => { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; };
  const hourLabel = h => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ }
  }

  /* Hijri date helper (Intl, Umm al-Qura calendar). Fails gracefully. */
  const hijri = (() => {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
      return d => {
        const p = Object.fromEntries(f.formatToParts(d).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
        return { d: p.day, m: p.month, y: String(p.year || '').replace(/\D/g, '') };
      };
    } catch { return null; }
  })();
  function hijriRange(a, b) {
    if (!hijri) return '';
    try {
      const ha = hijri(a), hb = hijri(b), ab = m => m.replace(/[^A-Za-z ]/g, '').slice(0, 3) + '.';
      if (ha.m === hb.m && ha.y === hb.y) return ha.d === hb.d ? `${ha.d} ${ab(ha.m)} ${ha.y} H` : `${ha.d}-${hb.d} ${ab(ha.m)} ${ha.y} H`;
      return `${ha.d} ${ab(ha.m)} – ${hb.d} ${ab(hb.m)} ${hb.y} H`;
    } catch { return ''; }
  }

  /* ------------------------------- Data ------------------------------ */
  function seedEvents() {
    const mon = startOfWeek(new Date());
    const day = n => ymd(addDays(mon, n));
    const mk = (n, title, cat, start, end, people, color, notes = '') =>
      ({ id: uid(), title, cat, date: day(n), start, end, people, color: color || CATS[cat].color, notes });
    return [
      mk(0, 'Dhuha Prayer',    'prayer',   '08:00', '09:00', ['Aisha Rahman']),
      mk(0, 'Kajian Online',   'kajian',   '09:30', '11:30', ['Syeikh Fulan', 'KH. Ahmad', 'A. Abdul'], null, 'Weekly online lecture.'),
      mk(0, 'Dzuhur Prayer',   'prayer',   '12:00', '13:00', ['Omar Faruq'], 'blue'),
      mk(1, 'Murojaah',        'murojaah', '09:00', '11:00', ['KH. Ahmad', 'Layla Hasan'], null, 'Review Juz 29.'),
      mk(1, 'Study Fiqh',      'study',    '13:00', '14:30', ['A. Abdul'], 'peach'),
      mk(2, 'Murojaah',        'murojaah', '08:00', '10:00', ['Layla Hasan', 'Aisha Rahman']),
      mk(2, 'Kajian Online',   'kajian',   '11:00', '13:00', ['Syeikh Fulan']),
      mk(3, 'Dhuha Prayer',    'prayer',   '08:00', '09:00', ['Omar Faruq']),
      mk(3, 'Murojaah',        'murojaah', '10:00', '12:00', ['KH. Ahmad']),
      mk(3, 'Study Moral Creed','study',   '13:00', '15:00', ['Aisha Rahman', 'A. Abdul'], 'peach'),
      mk(4, 'Project Sprint',  'project',  '09:00', '10:30', ['Omar Faruq', 'Layla Hasan', 'Aisha Rahman', 'A. Abdul'], null, 'Sprint planning.'),
      mk(4, "Jumu'ah Prayer",  'prayer',   '12:00', '13:00', ['KH. Ahmad']),
      mk(5, 'Kajian Online',   'kajian',   '09:30', '11:30', ['Syeikh Fulan', 'Layla Hasan']),
      mk(6, 'Weekly Review',   'project',  '14:00', '15:00', ['Omar Faruq']),
    ];
  }
  const defaultTasks = () => [
    { id: uid(), text: 'Ramadhan Pro',   done: false },
    { id: uid(), text: 'Murojaah Plan',  done: false },
    { id: uid(), text: 'Kajian Prep',    done: false },
    { id: uid(), text: 'Prayer Tracker', done: true },
  ];

  let events = load(KEYS.events, null);
  if (!Array.isArray(events)) { events = seedEvents(); save(KEYS.events, events); }
  let tasks = load(KEYS.tasks, null);
  if (!Array.isArray(tasks)) { tasks = defaultTasks(); save(KEYS.tasks, tasks); }
  const ui = load(KEYS.ui, {});

  const state = {
    tab: 'dashboard',
    view: ['daily', 'weekly', 'monthly'].includes(ui.view) ? ui.view : 'weekly',
    selected: new Date(),
    mini: null,
    filters: new Set(Object.keys(CATS)),
    query: '',
  };
  state.mini = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1);

  const persistEvents = () => save(KEYS.events, events);
  const persistTasks = () => save(KEYS.tasks, tasks);
  const colorOf = e => (COLOR_NAMES.includes(e.color) ? e.color : (CATS[e.cat]?.color || 'blue'));

  function visibleEvents() {
    const q = state.query.trim().toLowerCase();
    return events.filter(e => {
      if (!state.filters.has(e.cat)) return false;
      if (!q) return true;
      return [e.title, e.notes, CATS[e.cat]?.label, ...(e.people || [])].join(' ').toLowerCase().includes(q);
    });
  }
  const eventsOn = (list, dateStr) => list.filter(e => e.date === dateStr);

  /* ------------------------- Small UI builders ----------------------- */
  const icon = c => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[c] || ICONS.project}</svg>`;
  const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const avatar = (n, extra = '') => `<span class="av ${extra}" style="background:${AV_COLORS[hash(n) % AV_COLORS.length]}" title="${esc(n)}">${esc(initials(n))}</span>`;
  const avatars = (people = [], max = 3) => {
    if (!people.length) return '';
    const shown = people.slice(0, max).map(n => avatar(n)).join('');
    const more = people.length > max ? `<span class="av av-more">+${people.length - max}</span>` : '';
    return `<span class="avs">${shown}${more}</span>`;
  };

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ----------------------------- Rendering --------------------------- */
  function render() {
    renderTabs();
    $('#view-dashboard').classList.toggle('hidden', state.tab !== 'dashboard');
    $('#view-activities').classList.toggle('hidden', state.tab !== 'activities');
    $('#view-reports').classList.toggle('hidden', state.tab !== 'reports');
    if (state.tab === 'dashboard') renderDashboard();
    if (state.tab === 'activities') renderActivities();
    if (state.tab === 'reports') renderReports();
    renderMini(); renderTasks(); renderFilters();
  }

  function renderTabs() {
    $$('#tabs .tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === state.tab));
  }

  /* ---- Dashboard toolbar + calendar ---- */
  function renderDashboard() {
    const sel = state.selected;
    $$('#view-toggle .seg').forEach(b => b.classList.toggle('is-active', b.dataset.view === state.view));

    let title, sub;
    if (state.view === 'weekly') {
      const ws = startOfWeek(sel), we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth()) title = `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`;
      else if (ws.getFullYear() === we.getFullYear()) title = `${MONTHS[ws.getMonth()].slice(0, 3)} – ${MONTHS[we.getMonth()].slice(0, 3)} ${ws.getFullYear()}`;
      else title = `${MONTHS[ws.getMonth()].slice(0, 3)} ${ws.getFullYear()} – ${MONTHS[we.getMonth()].slice(0, 3)} ${we.getFullYear()}`;
      sub = hijriRange(ws, we);
    } else if (state.view === 'daily') {
      title = `${MONTHS[sel.getMonth()]} ${sel.getFullYear()}`;
      sub = `${WD_LONG[sel.getDay()]} ${sel.getDate()} · ${hijriRange(sel, sel)}`.replace(/ · $/, '');
    } else {
      title = `${MONTHS[sel.getMonth()]} ${sel.getFullYear()}`;
      sub = hijriRange(new Date(sel.getFullYear(), sel.getMonth(), 1), new Date(sel.getFullYear(), sel.getMonth() + 1, 0));
    }
    $('#period-title').textContent = title;
    $('#period-sub').textContent = sub;

    const cal = $('#calendar');
    const keepTop = cal.scrollTop;
    cal.innerHTML = state.view === 'monthly' ? monthHTML() : gridHTML(state.view === 'daily' ? [sel] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(sel), i)));
    cal.scrollTop = keepTop;
  }

  /* Column layout for overlapping events */
  function layoutDay(list) {
    const items = list.map(e => ({ e, s: toMin(e.start), f: toMin(e.end) })).sort((a, b) => a.s - b.s || b.f - a.f);
    const out = []; let cluster = [], clusterEnd = -1;
    const flush = () => {
      const cols = [];
      cluster.forEach(it => {
        let i = cols.findIndex(end => end <= it.s);
        if (i < 0) { i = cols.length; cols.push(0); }
        cols[i] = it.f; it.col = i;
      });
      cluster.forEach(it => { it.cols = cols.length; });
      out.push(...cluster); cluster = [];
    };
    items.forEach(it => {
      if (cluster.length && it.s >= clusterEnd) { flush(); clusterEnd = -1; }
      cluster.push(it); clusterEnd = Math.max(clusterEnd, it.f);
    });
    if (cluster.length) flush();
    return out;
  }

  function evBlock(it) {
    const { e } = it;
    const top = (it.s - START_H * 60) / 60 * HOUR_H;
    const h = Math.max(24, (it.f - it.s) / 60 * HOUR_H - 3);
    const compact = h < 58;
    const left = `calc(${(it.col / it.cols) * 100}% + 4px)`;
    const width = `calc(${100 / it.cols}% - 8px)`;
    const time = `${fmtTime(e.start)} - ${fmtTime(e.end)}`;
    const people = !compact && h >= 74 ? `<div class="ev-foot">${avatars(e.people, it.cols > 1 ? 2 : 3)}</div>` : '';
    return `<div class="ev col-${colorOf(e)} ${compact ? 'is-compact' : ''}" role="button" tabindex="0"
              data-action="open-event" data-id="${esc(e.id)}"
              style="top:${top}px;height:${h}px;left:${left};width:${width}"
              title="${esc(e.title)} · ${time}">
              <div class="ev-title">${icon(e.cat)}<span>${esc(e.title)}</span></div>
              <div class="ev-time">${compact ? fmtTime(e.start) : time}</div>
              ${people}
            </div>`;
  }

  function gridHTML(days) {
    const list = visibleEvents();
    const today = ymd(new Date());
    const tzMin = -new Date().getTimezoneOffset();
    const tz = `UTC${tzMin >= 0 ? '+' : '-'}${Math.floor(Math.abs(tzMin) / 60)}${Math.abs(tzMin) % 60 ? ':' + pad(Math.abs(tzMin) % 60) : ''}`;

    const head = days.map(d => `<div class="tg-dayh ${ymd(d) === today ? 'is-today' : ''}"><span>${WD_SHORT[d.getDay()]}</span><b>${d.getDate()}</b></div>`).join('');
    const times = Array.from({ length: END_H - START_H }, (_, i) => `<span style="top:${i * HOUR_H}px">${hourLabel(START_H + i)}</span>`).join('');

    const cols = days.map(d => {
      const k = ymd(d);
      const blocks = layoutDay(eventsOn(list, k).filter(e => toMin(e.start) >= START_H * 60 && toMin(e.end) <= END_H * 60 && toMin(e.end) > toMin(e.start))).map(evBlock).join('');
      let now = '';
      if (k === today) {
        const n = new Date(), mins = n.getHours() * 60 + n.getMinutes();
        if (mins >= START_H * 60 && mins <= END_H * 60) now = `<div class="now-line" style="top:${(mins - START_H * 60) / 60 * HOUR_H}px"></div>`;
      }
      return `<div class="tg-col ${k === today ? 'is-today' : ''}" data-date="${k}" title="Click to add an event">${now}${blocks}</div>`;
    }).join('');

    return `<div class="tg ${days.length === 1 ? 'is-daily' : ''}" style="--cols:${days.length}">
      <div class="tg-head"><div class="tg-corner">${tz}</div>${head}</div>
      <div class="tg-body"><div class="tg-times">${times}</div>${cols}</div>
    </div>`;
  }

  function monthHTML() {
    const list = visibleEvents();
    const sel = state.selected, first = new Date(sel.getFullYear(), sel.getMonth(), 1);
    const start = startOfWeek(first), today = ymd(new Date());
    const weeks = Math.ceil((((first.getDay() + 6) % 7) + new Date(sel.getFullYear(), sel.getMonth() + 1, 0).getDate()) / 7);
    const head = WD_MON_FIRST.map(w => `<div>${w}</div>`).join('');
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i), k = ymd(d);
      const evs = eventsOn(list, k).sort((a, b) => a.start.localeCompare(b.start));
      const chips = evs.slice(0, 3).map(e => `<div class="chip col-${colorOf(e)}" role="button" tabindex="0" data-action="open-event" data-id="${esc(e.id)}"><i></i><span>${fmtTime(e.start).replace(':00', '')} ${esc(e.title)}</span></div>`).join('');
      const more = evs.length > 3 ? `<div class="more">+${evs.length - 3} more</div>` : '';
      cells += `<div class="mv-cell ${d.getMonth() !== sel.getMonth() ? 'is-other' : ''} ${k === today ? 'is-today' : ''}" data-action="cell-date" data-date="${k}"><span class="mv-num">${d.getDate()}</span>${chips}${more}</div>`;
    }
    return `<div class="mv"><div class="mv-head">${head}</div><div class="mv-grid">${cells}</div></div>`;
  }

  /* ---- Mini calendar ---- */
  function renderMini() {
    const m = state.mini, first = new Date(m.getFullYear(), m.getMonth(), 1);
    const start = startOfWeek(first);
    const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((((first.getDay() + 6) % 7) + dim) / 7);
    const withEv = new Set(visibleEvents().map(e => e.date));
    const today = ymd(new Date()), sel = ymd(state.selected);
    let cells = WD_MON_FIRST.map(w => `<div class="mini-wd">${w}</div>`).join('');
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i), k = ymd(d);
      const cls = ['mini-day', d.getMonth() !== m.getMonth() && 'is-other', k === today && 'is-today', k === sel && 'is-selected', withEv.has(k) && 'has-ev'].filter(Boolean).join(' ');
      cells += `<button class="${cls}" data-action="mini-day" data-date="${k}" aria-label="${d.toDateString()}">${d.getDate()}</button>`;
    }
    $('#mini').innerHTML = `
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-semibold">${MONTHS[m.getMonth()]} <span class="font-normal text-gray-400">${m.getFullYear()}</span></span>
        <span class="flex">
          <button data-action="mini-prev" class="icon-btn !h-7 !w-7" aria-label="Previous month"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
          <button data-action="mini-next" class="icon-btn !h-7 !w-7" aria-label="Next month"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
        </span>
      </div>
      <div class="mini-grid">${cells}</div>`;
  }

  /* ---- Tasks ---- */
  function renderTasks() {
    $('#tasks').innerHTML = tasks.length ? tasks.map(t => `
      <li class="task ${t.done ? 'is-done' : ''}">
        <input type="checkbox" id="t-${t.id}" data-task="${t.id}" ${t.done ? 'checked' : ''} />
        <span class="box"><svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>
        <label class="label" for="t-${t.id}">${esc(t.text)}</label>
        <button class="del" data-action="del-task" data-id="${t.id}" aria-label="Delete task">×</button>
      </li>`).join('') : '<li class="rounded-xl border border-dashed border-gray-300 p-3 text-center text-xs text-gray-400">No tasks yet</li>';
    $('#task-count').textContent = `${tasks.filter(t => t.done).length}/${tasks.length}`;
  }

  /* ---- Category filters ---- */
  function renderFilters() {
    $('#filters').innerHTML = Object.entries(CATS).map(([k, c]) =>
      `<button class="fchip col-${c.color} ${state.filters.has(k) ? 'is-on' : ''}" data-action="filter" data-cat="${k}" aria-pressed="${state.filters.has(k)}"><i></i>${c.label}</button>`).join('');
  }

  /* ---- Activities tab ---- */
  function renderActivities() {
    const today = ymd(new Date());
    const list = visibleEvents().filter(e => e.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const groups = {};
    list.forEach(e => (groups[e.date] ||= []).push(e));
    const body = Object.keys(groups).length ? Object.entries(groups).map(([k, evs]) => {
      const d = parseYmd(k);
      return `<section class="mb-6">
        <h3 class="mb-2 text-sm font-semibold text-gray-500">${k === today ? 'Today' : WD_LONG[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}</h3>
        <div class="space-y-2">${evs.map(e => `
          <div class="row-ev col-${colorOf(e)}" role="button" tabindex="0" data-action="open-event" data-id="${esc(e.id)}">
            ${icon(e.cat)}
            <div class="min-w-0 flex-1"><div class="truncate text-sm font-semibold">${esc(e.title)}</div><div class="text-xs opacity-75">${fmtTime(e.start)} - ${fmtTime(e.end)} · ${CATS[e.cat]?.label || ''}</div></div>
            ${avatars(e.people, 4)}
          </div>`).join('')}</div></section>`;
    }).join('') : `<div class="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">No upcoming activities match your filters.<br/><button data-action="add-event" class="mt-3 font-semibold text-blue-600 hover:underline">+ Add an event</button></div>`;
    $('#view-activities').innerHTML = `<div class="mx-auto max-w-3xl"><h2 class="mb-1 text-xl font-bold">Activities</h2><p class="mb-6 text-sm text-gray-400">Everything coming up, in order.</p>${body}</div>`;
  }

  /* ---- Reports tab ---- */
  function renderReports() {
    const ws = startOfWeek(state.selected), weekKeys = new Set(Array.from({ length: 7 }, (_, i) => ymd(addDays(ws, i))));
    const week = events.filter(e => weekKeys.has(e.date));
    const hrs = e => (toMin(e.end) - toMin(e.start)) / 60;
    const totalH = week.reduce((a, e) => a + hrs(e), 0);
    const done = tasks.filter(t => t.done).length;
    const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const per = Object.entries(CATS).map(([k, c]) => ({ k, c, h: week.filter(e => e.cat === k).reduce((a, e) => a + hrs(e), 0), n: week.filter(e => e.cat === k).length }));
    const max = Math.max(1, ...per.map(p => p.h));
    const stat = (label, val) => `<div class="card stat"><div class="text-xs font-medium text-gray-400">${label}</div><div class="mt-1 text-2xl font-bold">${val}</div></div>`;
    $('#view-reports').innerHTML = `<div class="mx-auto max-w-3xl">
      <h2 class="mb-1 text-xl font-bold">Reports</h2>
      <p class="mb-6 text-sm text-gray-400">Week of ${ws.getDate()} ${MONTHS[ws.getMonth()]} ${ws.getFullYear()}</p>
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        ${stat('Events this week', week.length)}${stat('Hours scheduled', totalH.toFixed(1).replace('.0', ''))}${stat('Tasks done', `${done}/${tasks.length}`)}${stat('Completion', pct + '%')}
      </div>
      <div class="card">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">Time by category</h3>
        <div class="space-y-4">${per.map(p => `
          <div class="col-${p.c.color}">
            <div class="mb-1 flex justify-between text-sm"><span class="font-medium">${p.c.label}</span><span class="text-gray-400">${p.n} event${p.n === 1 ? '' : 's'} · ${p.h.toFixed(1).replace('.0', '')} h</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${p.h / max * 100}%"></div></div>
          </div>`).join('')}</div>
      </div>
    </div>`;
  }

  /* ------------------------------ Modals ----------------------------- */
  function openModal(html, { wide = false, onMount } = {}) {
    closeModal();
    const root = $('#modal-root');
    root.innerHTML = `<div class="backdrop" data-action="close-modal-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
    const first = $('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, button', root.querySelector('.modal'));
    onMount && onMount(root);
    first && first.focus();
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  const closeBtn = `<button data-action="close-modal" class="icon-btn" aria-label="Close"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;

  /* ---- Add event ---- */
  function openAddModal(pref = {}) {
    const date = pref.date || ymd(state.selected);
    const start = pref.start || '09:00';
    const end = pref.end || fromMin(Math.min(END_H * 60, toMin(start) + 60));
    const cat = 'study';
    const html = `
      <form id="ev-form" class="p-6" novalidate>
        <div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-bold">Add Event</h2>${closeBtn}</div>
        <div class="space-y-4">
          <div class="field"><label for="f-title">Title</label><input id="f-title" name="title" class="inp" maxlength="80" placeholder="e.g. Study Fiqh" required /></div>
          <div class="grid grid-cols-2 gap-3">
            <div class="field"><label for="f-cat">Category</label>
              <select id="f-cat" name="cat" class="inp">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${c.label}</option>`).join('')}</select></div>
            <div class="field"><label for="f-date">Date</label><input id="f-date" name="date" type="date" class="inp" value="${date}" required /></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="field"><label for="f-start">Start</label><input id="f-start" name="start" type="time" step="900" min="08:00" max="18:00" class="inp" value="${start}" required /></div>
            <div class="field"><label for="f-end">End</label><input id="f-end" name="end" type="time" step="900" min="08:00" max="18:00" class="inp" value="${end}" required /></div>
          </div>
          <div><span class="lbl">Color</span>
            <div class="flex gap-2" id="swatches">${COLOR_NAMES.map(c => `<label class="swatch col-${c}"><input type="radio" name="color" value="${c}" ${c === CATS[cat].color ? 'checked' : ''} /><span></span></label>`).join('')}</div></div>
          <div><span class="lbl">Participants</span>
            <div class="flex flex-wrap gap-2">${TEAM.map(n => `<label class="pchip"><input type="checkbox" name="people" value="${esc(n)}" /><span>${avatar(n, 'av-sm')}${esc(n)}</span></label>`).join('')}</div></div>
          <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" name="notes" rows="2" class="inp" maxlength="300" placeholder="Optional details"></textarea></div>
          <p id="form-err" class="hidden rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600"></p>
        </div>
        <div class="mt-6 flex justify-end gap-2"><button type="button" data-action="close-modal" class="btn btn-ghost">Cancel</button><button type="submit" class="btn btn-primary">Save Event</button></div>
      </form>`;
    openModal(html, {
      onMount: root => {
        $('#f-cat', root).addEventListener('change', e => {
          const r = $(`input[name=color][value="${CATS[e.target.value].color}"]`, root); if (r) r.checked = true;
        });
        $('#ev-form', root).addEventListener('submit', onSaveEvent);
      },
    });
  }

  function onSaveEvent(ev) {
    ev.preventDefault();
    const f = new FormData(ev.target), err = $('#form-err');
    const fail = m => { err.textContent = m; err.classList.remove('hidden'); };
    const title = (f.get('title') || '').trim(), date = f.get('date'), start = f.get('start'), end = f.get('end');
    if (!title) return fail('Please enter a title.');
    if (!date) return fail('Please choose a date.');
    if (!start || !end) return fail('Please set a start and end time.');
    if (toMin(end) <= toMin(start)) return fail('End time must be after the start time.');
    if (toMin(start) < START_H * 60 || toMin(end) > END_H * 60) return fail('Events must fall between 8:00 AM and 6:00 PM.');
    const e = { id: uid(), title, cat: f.get('cat'), date, start, end, people: f.getAll('people'), color: f.get('color'), notes: (f.get('notes') || '').trim() };
    events.push(e); persistEvents();
    state.selected = parseYmd(date); state.mini = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1);
    closeModal(); render(); toast('Event added');
  }

  /* ---- Event detail ---- */
  function openDetail(id) {
    const e = events.find(x => x.id === id); if (!e) return;
    const d = parseYmd(e.date), col = colorOf(e);
    const html = `
      <div class="col-${col} rounded-t-[20px] px-6 pb-4 pt-5" style="background:var(--ev-bg);color:var(--ev-ink)">
        <div class="mb-2 flex items-start justify-between gap-3">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-xs font-semibold">${icon(e.cat)}${CATS[e.cat]?.label || ''}</span>${closeBtn}
        </div>
        <h2 class="text-xl font-bold">${esc(e.title)}</h2>
        <p class="mt-1 text-sm opacity-80">${WD_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${fmtTime(e.start)} - ${fmtTime(e.end)}</p>
      </div>
      <div class="space-y-4 p-6">
        <div><span class="lbl">Participants</span>
          ${e.people?.length ? `<div class="flex flex-wrap gap-3">${e.people.map(n => `<span class="flex items-center gap-2 text-sm">${avatar(n, 'av-lg')}${esc(n)}</span>`).join('')}</div>` : '<p class="text-sm text-gray-400">No participants</p>'}</div>
        <div><span class="lbl">Notes</span><p class="text-sm text-gray-600">${e.notes ? esc(e.notes) : '<span class="text-gray-400">No notes</span>'}</p></div>
        <div class="flex flex-wrap justify-between gap-2 border-t border-gray-100 pt-4">
          <button data-action="delete-event" data-id="${esc(e.id)}" class="btn btn-danger">Delete Event</button>
          <a href="${googleUrl(e)}" target="_blank" rel="noopener" class="btn btn-google">Add to Google Calendar</a>
        </div>
      </div>`;
    openModal(html);
  }

  /* ---- Export ---- */
  function openExportModal(scope = 'all') {
    const list = exportList(scope);
    const html = `
      <div class="p-6">
        <div class="mb-1 flex items-center justify-between"><h2 class="text-lg font-bold">Export to Google Calendar</h2>${closeBtn}</div>
        <p class="mb-4 text-sm text-gray-500">Download an .ics file to import everything at once, or add events one by one with a prefilled Google Calendar link.</p>

        <div class="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 p-3">
          <label class="text-sm font-medium" for="x-scope">Include</label>
          <select id="x-scope" class="inp !w-auto">
            <option value="all" ${scope === 'all' ? 'selected' : ''}>All events</option>
            <option value="week" ${scope === 'week' ? 'selected' : ''}>This week only</option>
            <option value="visible" ${scope === 'visible' ? 'selected' : ''}>Current filters &amp; search</option>
          </select>
          <span class="text-sm text-gray-500">${list.length} event${list.length === 1 ? '' : 's'}</span>
          <button data-action="download-ics" data-scope="${scope}" class="btn btn-google ml-auto" ${list.length ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}>Download .ics</button>
        </div>

        <details class="mb-4 rounded-2xl border border-gray-100 p-3 text-sm text-gray-600" open>
          <summary class="cursor-pointer font-semibold text-gray-800">How to import the .ics file</summary>
          <ol class="mt-2 list-decimal space-y-1 pl-5">
            <li>Download the file above.</li>
            <li>Open <a class="text-blue-600 underline" target="_blank" rel="noopener" href="https://calendar.google.com/calendar/u/0/r/settings/export">Google Calendar → Settings → Import &amp; export</a>.</li>
            <li>Choose the file, pick a calendar and click <b>Import</b>.</li>
          </ol>
        </details>

        <h3 class="lbl">Add individually</h3>
        <ul class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          ${list.length ? list.map(e => `<li class="col-${colorOf(e)} flex items-center gap-3 rounded-xl px-3 py-2" style="background:var(--ev-bg);color:var(--ev-ink)">
              ${icon(e.cat)}<div class="min-w-0 flex-1"><div class="truncate text-sm font-semibold">${esc(e.title)}</div><div class="text-xs opacity-75">${e.date} · ${fmtTime(e.start)} - ${fmtTime(e.end)}</div></div>
              <a class="rounded-lg bg-white/70 px-2.5 py-1 text-xs font-semibold hover:bg-white" target="_blank" rel="noopener" href="${googleUrl(e)}">Add ↗</a></li>`).join('') : '<li class="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">No events to export.</li>'}
        </ul>
      </div>`;
    openModal(html, {
      wide: true,
      onMount: root => $('#x-scope', root).addEventListener('change', e => openExportModal(e.target.value)),
    });
  }

  function exportList(scope) {
    let list = scope === 'visible' ? visibleEvents() : events;
    if (scope === 'week') {
      const ws = startOfWeek(state.selected), keys = new Set(Array.from({ length: 7 }, (_, i) => ymd(addDays(ws, i))));
      list = events.filter(e => keys.has(e.date));
    }
    return [...list].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }

  /* --------------------- Google Calendar / ICS output ---------------- */
  function utcStamp(dateStr, time) {
    const d = parseYmd(dateStr), [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  }
  const describe = e => [`Category: ${CATS[e.cat]?.label || e.cat}`, e.people?.length ? `Participants: ${e.people.join(', ')}` : '', e.notes || ''].filter(Boolean).join('\n');

  function googleUrl(e) {
    const p = new URLSearchParams({
      action: 'TEMPLATE', text: e.title,
      dates: `${utcStamp(e.date, e.start)}/${utcStamp(e.date, e.end)}`,
      details: describe(e) + '\n\nExported from Dash.',
    });
    try { p.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* ignore */ }
    return `https://calendar.google.com/calendar/render?${p.toString()}`;
  }

  const icsEscape = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const icsFold = line => { let out = ''; while (line.length > 73) { out += line.slice(0, 73) + '\r\n '; line = line.slice(73); } return out + line; };

  function buildICS(list) {
    const now = new Date(), stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dash//Schedule Dashboard//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Dash. Schedule'];
    list.forEach(e => lines.push(
      'BEGIN:VEVENT', `UID:${e.id}@dash.local`, `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(e.date, e.start)}`, `DTEND:${utcStamp(e.date, e.end)}`,
      `SUMMARY:${icsEscape(e.title)}`, `DESCRIPTION:${icsEscape(describe(e))}`,
      `CATEGORIES:${icsEscape((CATS[e.cat]?.label || 'Event').toUpperCase())}`, 'END:VEVENT'));
    lines.push('END:VCALENDAR');
    return lines.map(icsFold).join('\r\n') + '\r\n';
  }

  function downloadICS(scope) {
    const list = exportList(scope);
    if (!list.length) return toast('No events to export');
    const blob = new Blob([buildICS(list)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `dash-schedule-${ymd(new Date())}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`Downloaded ${list.length} event${list.length === 1 ? '' : 's'}`);
  }

  /* ----------------------------- Navigation -------------------------- */
  function shift(dir) {
    const s = state.selected;
    if (state.view === 'weekly') state.selected = addDays(s, 7 * dir);
    else if (state.view === 'daily') state.selected = addDays(s, dir);
    else {
      const t = new Date(s.getFullYear(), s.getMonth() + dir, 1);
      t.setDate(Math.min(s.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
      state.selected = t;
    }
    state.mini = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1);
    render();
  }
  function selectDate(k, view) {
    state.selected = parseYmd(k);
    state.mini = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1);
    if (view) { state.view = view; save(KEYS.ui, { view }); }
    render();
  }

  /* --------------------------- Event handling ------------------------ */
  document.addEventListener('click', e => {
    // click on empty area of a time column → quick add
    const col = e.target.closest('.tg-col');
    if (col && !e.target.closest('.ev')) {
      const y = e.clientY - col.getBoundingClientRect().top;
      const mins = Math.min(END_H * 60 - 30, START_H * 60 + Math.floor(y / HOUR_H * 2) * 30);
      return openAddModal({ date: col.dataset.date, start: fromMin(mins), end: fromMin(Math.min(END_H * 60, mins + 60)) });
    }
    const el = e.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action;
    if (a === 'close-modal-bg') { if (e.target === el) closeModal(); return; }
    if (el.closest('.chip') && a === 'cell-date') return;
    switch (a) {
      case 'tab': state.tab = el.dataset.tab; render(); break;
      case 'view': state.view = el.dataset.view; save(KEYS.ui, { view: state.view }); render(); break;
      case 'nav-prev': shift(-1); break;
      case 'nav-next': shift(1); break;
      case 'today': state.selected = new Date(); state.mini = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1); render(); break;
      case 'mini-prev': state.mini = new Date(state.mini.getFullYear(), state.mini.getMonth() - 1, 1); renderMini(); break;
      case 'mini-next': state.mini = new Date(state.mini.getFullYear(), state.mini.getMonth() + 1, 1); renderMini(); break;
      case 'mini-day': state.tab = 'dashboard'; selectDate(el.dataset.date); break;
      case 'cell-date': selectDate(el.dataset.date, 'daily'); break;
      case 'filter': { const c = el.dataset.cat; state.filters.has(c) ? state.filters.delete(c) : state.filters.add(c); render(); break; }
      case 'reset-filters': state.filters = new Set(Object.keys(CATS)); state.query = ''; $('#search').value = ''; render(); break;
      case 'add-event': openAddModal(); break;
      case 'export': openExportModal('all'); break;
      case 'open-event': e.stopPropagation(); openDetail(el.dataset.id); break;
      case 'close-modal': closeModal(); break;
      case 'download-ics': downloadICS(el.dataset.scope); break;
      case 'del-task': tasks = tasks.filter(t => t.id !== el.dataset.id); persistTasks(); renderTasks(); if (state.tab === 'reports') renderReports(); break;
      case 'delete-event':
        if (!el.classList.contains('is-armed')) { el.classList.add('is-armed'); el.textContent = 'Click again to confirm'; break; }
        events = events.filter(x => x.id !== el.dataset.id); persistEvents(); closeModal(); render(); toast('Event deleted'); break;
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if ($('#modal-root').firstChild) closeModal(); else if (document.activeElement === $('#search')) { $('#search').value = ''; state.query = ''; render(); } }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-action]')) { e.preventDefault(); e.target.click(); }
  });

  document.addEventListener('change', e => {
    const id = e.target.dataset?.task;
    if (id) {
      const t = tasks.find(x => x.id === id); if (!t) return;
      t.done = e.target.checked; persistTasks(); renderTasks();
      if (state.tab === 'reports') renderReports();
    }
  });

  $('#task-form').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#task-input'), text = inp.value.trim(); if (!text) return;
    tasks.push({ id: uid(), text, done: false }); persistTasks(); inp.value = ''; renderTasks();
  });

  let searchTimer;
  $('#search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = e.target.value; render(); }, 150);
  });

  /* Keep the "now" indicator fresh */
  setInterval(() => { if (state.tab === 'dashboard' && state.view !== 'monthly' && !$('#modal-root').firstChild) renderDashboard(); }, 60000);

  /* ------------------------------- Init ------------------------------ */
  render();
  // Scroll the grid so the morning is in view on first paint
  const cal = $('#calendar'); if (cal) cal.scrollTop = 0;
})();
