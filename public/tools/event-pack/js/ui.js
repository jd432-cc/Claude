/* =============================================================
   TheRacingData — Event Pack Builder
   Rendering.

   Four tabs, one per thing a team actually sits down to fill in:
   the event and its people, the sessions and their derived call
   times, the build-up profile, and the checklists.

   Every time on the timetable is derived. Nothing on this page
   asks anyone what time to be there — it asks what time the
   session is and what the offsets are, and works the rest out.
   ============================================================= */

import { COLLECTIONS, profileOf, checklistProgress } from './state.js';
import { timetables, collisions, offsetLabel, parseIso } from './calc/timetable.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const TABS = [
  ['event', 'Event and people'],
  ['timetable', 'Sessions and call times'],
  ['buildup', 'Build-up profile'],
  ['checklists', 'Checklists'],
];

export class UI {
  constructor(report, catalogue, onChange) {
    this.report = report;
    this.catalogue = catalogue;
    this.onChange = onChange;
    this.tab = 'event';
  }

  /* A keystroke never rebuilds the pane it was typed into. Only a
     row being added or removed, or a tab, changes what inputs exist. */
  change(structural = false) {
    this.onChange(this.report, structural);
  }

  renderTabs() {
    const host = document.getElementById('tabs');
    const frag = document.createDocumentFragment();
    for (const [id, label] of TABS) {
      const b = el('button', 'tab' + (this.tab === id ? ' active' : ''), label);
      b.addEventListener('click', () => { this.tab = id; this.render(); });
      frag.append(b);
    }
    host.replaceChildren(frag);
  }

  renderSummary() {
    const host = document.getElementById('summary');
    const plans = timetables(this.report.sessions, profileOf(this.report))
      .filter(p => p.start);
    const clashes = collisions(this.report.sessions, profileOf(this.report));
    const lists = this.report.checklists || [];
    const packed = lists.reduce((a, l) => a + checklistProgress(l).packed, 0);
    const total = lists.reduce((a, l) => a + checklistProgress(l).total, 0);

    const first = plans.length
      ? plans.reduce((a, p) => (p.window.from < a.window.from ? p : a))
      : null;
    const firstTask = first?.tasks[0];

    const cells = [
      ['Sessions', String(plans.length),
       plans.length ? `first at ${plans[0].startTime}` : 'none with a start time'],
      ['First call', firstTask ? `${firstTask.time}` : '—',
       firstTask ? `${firstTask.date} — ${firstTask.task}` : 'set a session start'],
      ['Event time zone', plans.length ? `UTC${plans[0].offset}` : '—',
       'stored with the session, never inferred'],
      ['Packed', total ? `${packed} / ${total}` : '—',
       `${lists.length} list${lists.length === 1 ? '' : 's'}`],
    ];

    const frag = document.createDocumentFragment();
    for (const [label, value, note] of cells) {
      const cell = el('div', 'stat');
      cell.append(el('p', 'eyebrow', label));
      cell.append(el('p', 'stat-value', value));
      cell.append(el('p', 'stat-note', note));
      frag.append(cell);
    }
    if (clashes.length) {
      const warn = el('div', 'stat stat-warn');
      warn.append(el('p', 'eyebrow', 'Collisions'));
      warn.append(el('p', 'stat-value', String(clashes.length)));
      warn.append(el('p', 'stat-note',
        'Two sessions want the same crew or the same car at once.'));
      frag.append(warn);
    }
    host.replaceChildren(frag);
  }

  /* ---------- event and people ---------- */
  renderEvent() {
    const host = document.getElementById('pane');
    const frag = document.createDocumentFragment();

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'One object'));
    head.append(el('h2', null, 'Event and people'));
    head.append(el('p', 'blurb',
      'Every document the team takes to the circuit is a view of this. ' +
      'Fill it once.'));
    frag.append(head);

    const box = el('section', 'group');
    box.append(el('h3', null, 'Event'));
    const grid = el('div', 'field-grid');
    for (const [key, label] of [
      ['event.name', 'Event'], ['event.championship', 'Championship'],
      ['event.round', 'Round'], ['event.venue', 'Venue'],
      ['event.country', 'Country'], ['event.dateFrom', 'From'],
      ['event.dateTo', 'To'], ['round', 'Round code'],
      ['venueCode', 'Venue code'], ['carCode', 'Car code'],
      ['allocation.tyreSets', 'Tyre sets'], ['allocation.fuel_l', 'Fuel, l'],
    ]) grid.append(this.field(key, label));
    box.append(grid);
    frag.append(box);

    for (const key of ['contacts', 'crew', 'vehicles']) {
      frag.append(this.collection(key));
    }
    frag.append(this.spares());

    const notes = el('section', 'group');
    notes.append(el('h3', null, 'Notes'));
    const area = el('textarea');
    area.rows = 3;
    area.id = 'f_notes';
    area.setAttribute('aria-label', 'Notes');
    area.value = this.report.notes || '';
    area.addEventListener('input', () => {
      this.report.notes = area.value;
      this.change();
    });
    notes.append(area);
    frag.append(notes);

    host.replaceChildren(frag);
  }

  /* ---------- sessions and call times ---------- */
  renderTimetable() {
    const host = document.getElementById('pane');
    const frag = document.createDocumentFragment();

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'Derived, not typed'));
    head.append(el('h2', null, 'Sessions and call times'));
    head.append(el('p', 'blurb',
      'A session start is stored as ISO 8601 with an explicit offset — ' +
      '2026-05-16T09:30:00+01:00. Every call time below moves with it. ' +
      'A naive local time is refused: read on a laptop set to another ' +
      'country it is the wrong time, and it costs a session.'));
    frag.append(head);

    frag.append(this.collection('sessions'));

    const clashes = collisions(this.report.sessions, profileOf(this.report));
    if (clashes.length) {
      const box = el('div', 'clash');
      box.append(el('h4', null,
        `${clashes.length} collision${clashes.length > 1 ? 's' : ''}`));
      for (const c of clashes) box.append(el('p', 'clash-line', c.message));
      frag.append(box);
    }

    const plans = timetables(this.report.sessions, profileOf(this.report));
    for (const plan of plans) {
      frag.append(this.card(plan));
    }

    host.replaceChildren(frag);
  }

  card(plan) {
    const card = el('article', 'card');
    const head = el('div', 'card-head');
    head.append(el('span', 'card-n', plan.session.label || 'Session'));
    if (!plan.start) {
      head.append(el('span', 'card-bad',
        plan.session.start
          ? `"${plan.session.start}" is not an ISO 8601 time with an offset`
          : 'no start time'));
      card.append(head);
      return card;
    }
    head.append(el('span', 'card-when',
      `${plan.startDate} ${plan.startTime} (UTC${plan.offset})`));
    if (plan.session.duration_min) {
      head.append(el('span', 'card-when', `${plan.session.duration_min} min`));
    }
    card.append(head);

    const table = el('div', 'table');
    const header = el('div', 'trow thead');
    for (const label of ['Offset', 'Time', 'Task', 'Owner', '']) {
      header.append(el('div', 'tcell', label));
    }
    table.append(header);
    for (const task of plan.tasks) {
      const row = el('div', 'trow');
      row.append(el('div', 'tcell tnum',
        `${task.offset_min >= 0 ? '+' : ''}${task.offset_min}`));
      row.append(el('div', 'tcell tstrong', task.time));
      row.append(el('div', 'tcell twide', task.task));
      row.append(el('div', 'tcell', task.owner || ''));
      row.append(el('div', 'tcell tnum', task.mandatory ? 'M' : ''));
      table.append(row);
    }
    card.append(table);
    return card;
  }

  /* ---------- build-up profile ---------- */
  renderBuildUp() {
    const host = document.getElementById('pane');
    const frag = document.createDocumentFragment();

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'Stored per team'));
    head.append(el('h2', null, 'Build-up profile'));
    head.append(el('p', 'blurb',
      'A negative offset is before the session start, which is how a ' +
      'build-up is actually written down. Every session inherits this ' +
      'profile, and the timetable card is generated from it rather than typed.'));
    frag.append(head);
    frag.append(this.collection('buildUp', { mandatoryColumn: true }));
    host.replaceChildren(frag);
  }

  /* ---------- checklists ---------- */
  renderChecklists() {
    const host = document.getElementById('pane');
    const frag = document.createDocumentFragment();

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'Half packed survives a browser close'));
    head.append(el('h2', null, 'Checklists'));
    head.append(el('p', 'blurb',
      'Each default list is a starting point the team edits and saves back. ' +
      'Tick state is part of the session, so it is autosaved with everything else.'));
    frag.append(head);

    const bar = el('div', 'addbar');
    bar.append(el('span', 'addbar-label', 'Add a list'));
    for (const entry of this.catalogue) {
      const already = (this.report.checklists || []).some(l => l.id === entry.id);
      const b = el('button', 'ghost', `${entry.title} (${entry.count})`);
      b.disabled = already;
      if (already) b.title = 'Already in this event pack.';
      b.addEventListener('click', () => this.onAddList?.(entry));
      bar.append(b);
    }
    frag.append(bar);

    for (const [i, list] of (this.report.checklists || []).entries()) {
      frag.append(this.checklist(list, i));
    }
    host.replaceChildren(frag);
  }

  checklist(list, index) {
    const progress = checklistProgress(list);
    const card = el('article', 'card');

    const head = el('div', 'card-head');
    head.append(el('span', 'card-n', list.title || 'List'));
    head.append(el('span', 'card-when',
      `${progress.packed} of ${progress.total} packed`));
    const bar = el('span', 'progress');
    const fill = el('span', 'progress-fill');
    fill.style.width = `${Math.round(progress.pct * 100)}%`;
    bar.append(fill);
    head.append(bar);
    const x = el('button', 'icon', '×');
    x.title = 'Remove this list';
    x.addEventListener('click', () => {
      this.report.checklists.splice(index, 1);
      this.change(true);
    });
    head.append(x);
    card.append(head);

    if (list.note) card.append(el('p', 'hint', list.note));

    const table = el('div', 'table');
    for (const [i, item] of (list.items || []).entries()) {
      const row = el('div', 'trow' + (item.packed ? ' packed' : ''));

      const tick = el('div', 'tcell tnum');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = !!item.packed;
      box.setAttribute('aria-label', `Packed: ${item.text}`);
      box.addEventListener('change', () => {
        item.packed = box.checked;
        row.classList.toggle('packed', box.checked);
        this.change();
        this.renderSummary();
        head.querySelector('.card-when').textContent =
          `${checklistProgress(list).packed} of ${checklistProgress(list).total} packed`;
        fill.style.width = `${Math.round(checklistProgress(list).pct * 100)}%`;
      });
      tick.append(box);
      row.append(tick);

      row.append(this.rowInput(item, 'text', 'Item', 'twide'));
      row.append(this.rowInput(item, 'category', 'Category'));
      row.append(this.rowInput(item, 'qty', 'Qty', 'tnum'));

      const del = el('div', 'tcell tnum');
      const rm = el('button', 'icon', '×');
      rm.title = 'Remove item';
      rm.addEventListener('click', () => {
        list.items.splice(i, 1);
        this.change(true);
      });
      del.append(rm);
      row.append(del);
      table.append(row);
    }
    card.append(table);

    const add = el('button', 'add', '+ Add item');
    add.addEventListener('click', () => {
      list.items.push({ text: '', category: '', qty: '', packed: false });
      this.change(true);
    });
    card.append(add);
    return card;
  }

  /* ---------- shared pieces ---------- */
  collection(key, { mandatoryColumn = false } = {}) {
    const spec = COLLECTIONS[key];
    const rows = this.report[key] || [];
    const box = el('section', 'group');
    box.append(el('h3', null, spec.label));

    const table = el('div', 'table');
    const header = el('div', 'trow thead');
    header.append(el('div', 'tcell tnum', '#'));
    for (const [, label] of spec.columns) header.append(el('div', 'tcell', label));
    if (mandatoryColumn) header.append(el('div', 'tcell tnum', 'M'));
    header.append(el('div', 'tcell tnum'));
    table.append(header);

    rows.forEach((row, i) => {
      const tr = el('div', 'trow');
      tr.append(el('div', 'tcell tnum', String(i + 1)));
      for (const [field, label] of spec.columns) {
        const wide = field === 'objective' || field === 'task' || field === 'note';
        tr.append(this.rowInput(row, field, label, wide ? 'twide' : '',
          key === 'sessions' && field === 'start'));
      }
      if (mandatoryColumn) {
        const cell = el('div', 'tcell tnum');
        const box2 = el('input');
        box2.type = 'checkbox';
        box2.checked = row.mandatory !== false;
        box2.setAttribute('aria-label', 'Mandatory');
        box2.addEventListener('change', () => {
          row.mandatory = box2.checked;
          this.change();
        });
        cell.append(box2);
        tr.append(cell);
      }
      const del = el('div', 'tcell tnum');
      const x = el('button', 'icon', '×');
      x.title = 'Remove row';
      x.addEventListener('click', () => { rows.splice(i, 1); this.change(true); });
      del.append(x);
      tr.append(del);
      table.append(tr);
    });

    box.append(table);
    const add = el('button', 'add', `+ Add ${spec.label.toLowerCase().replace(/s$/, '')}`);
    add.addEventListener('click', () => {
      rows.push(spec.blank());
      this.change(true);
    });
    box.append(add);
    return box;
  }

  spares() {
    const box = el('section', 'group');
    box.append(el('h3', null, 'Spares allocation'));
    const rows = this.report.allocation.spares;
    const table = el('div', 'table');
    const header = el('div', 'trow thead');
    for (const label of ['Part', 'Qty', 'Location', '']) {
      header.append(el('div', 'tcell', label));
    }
    table.append(header);
    rows.forEach((row, i) => {
      const tr = el('div', 'trow');
      tr.append(this.rowInput(row, 'part', 'Part', 'twide'));
      tr.append(this.rowInput(row, 'qty', 'Qty', 'tnum'));
      tr.append(this.rowInput(row, 'location', 'Location'));
      const del = el('div', 'tcell tnum');
      const x = el('button', 'icon', '×');
      x.addEventListener('click', () => { rows.splice(i, 1); this.change(true); });
      del.append(x);
      tr.append(del);
      table.append(tr);
    });
    box.append(table);
    const add = el('button', 'add', '+ Add spare');
    add.addEventListener('click', () => {
      rows.push({ part: '', qty: '', location: '' });
      this.change(true);
    });
    box.append(add);
    return box;
  }

  rowInput(row, field, label, cls = '', validateIso = false) {
    const cell = el('div', `tcell ${cls}`.trim());
    const input = el('input');
    input.value = row[field] ?? '';
    input.setAttribute('aria-label', label);
    if (validateIso) {
      input.placeholder = '2026-05-16T09:30:00+01:00';
      mark(input, row[field]);
    }
    input.addEventListener('input', () => {
      row[field] = input.value;
      if (validateIso) mark(input, input.value);
      this.change();
      this.renderSummary();
    });
    cell.append(input);
    return cell;

    function mark(node, value) {
      const bad = String(value ?? '').trim() !== '' && !parseIso(value);
      node.classList.toggle('bad', bad);
      node.title = bad
        ? 'Not ISO 8601 with an explicit offset. A naive local time is the wrong time somewhere else.'
        : '';
    }
  }

  field(path, label) {
    const wrap = el('div', 'field');
    const id = `f_${path.replace(/\./g, '_')}`;
    const lab = el('label', null, label);
    lab.htmlFor = id;
    const input = el('input');
    input.id = id;
    input.value = get(this.report, path) ?? '';
    input.addEventListener('input', () => {
      set(this.report, path, input.value);
      this.change();
    });
    wrap.append(lab, input);
    return wrap;
  }

  renderIssues(issues) {
    const box = document.getElementById('issues');
    if (!issues.length) { box.replaceChildren(); box.hidden = true; return; }
    box.hidden = false;
    const frag = document.createDocumentFragment();
    frag.append(el('h4', null,
      `${issues.length} thing${issues.length > 1 ? 's' : ''} to resolve before issue`));
    const ul = el('ul');
    for (const i of issues) ul.append(el('li', i.collision ? 'sev-error' : '', i.message));
    frag.append(ul);
    box.replaceChildren(frag);
  }

  render(issues = []) {
    this.renderTabs();
    this.renderSummary();
    if (this.tab === 'event') this.renderEvent();
    else if (this.tab === 'timetable') this.renderTimetable();
    else if (this.tab === 'buildup') this.renderBuildUp();
    else this.renderChecklists();
    this.renderIssues(issues);
  }
}

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function set(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = obj;
  for (const k of keys) {
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
    node = node[k];
  }
  node[last] = value;
}
