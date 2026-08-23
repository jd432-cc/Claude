/* =============================================================
   TheRacingData — Load Budget & Voltage Drop
   Rendering.

   Table first. One row per circuit, entered columns on the left,
   computed columns on the right, and the boundary between them
   marked with a rule so nobody types into a derived cell — there
   is nothing to type into, because a derived cell is text.

   Cells are coloured by margin: within limits in Body grey,
   within 10% of a limit in Muted with a rule, over limit filled
   Signal Red with Paper text. Signal Red is never the text
   colour on the dark ground; it is a fill, and Paper on it clears
   8:1.
   ============================================================= */

import { COLUMNS, CLASSES, KINDS, cellText } from './state.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export class UI {
  constructor(session, spec, onChange) {
    this.session = session;
    this.spec = spec;
    this.onChange = onChange;
    this.columns = COLUMNS.map(c => c.k === 'insulation'
      ? { ...c, options: spec.insulations.map(i => [i.id, i.label]) }
      : c);
  }

  change(rerender = false) {
    this.onChange(this.session, rerender);
  }

  /* ---------- summary band ---------- */
  renderSummary(model) {
    const b = model.budget;
    const remaining = Number(this.session.raceRemaining_min) || 0;
    const endurance = Number.isFinite(b.timeToFlat_min)
      ? `${b.timeToFlat_min.toFixed(0)} min`
      : '—';

    const cells = [
      ['Continuous draw', `${b.continuousDraw_a.toFixed(1)} A`,
       `${b.peakDraw_a.toFixed(0)} A if everything is on at once`],
      ['Alternator headroom', `${b.headroom_a.toFixed(1)} A`,
       `${b.idleHeadroom_a.toFixed(1)} A at idle`],
      ['Time to flat', endurance,
       remaining > 0
         ? (b.timeToFlat_min >= remaining
             ? `covers the ${remaining} min remaining`
             : `${(remaining - b.timeToFlat_min).toFixed(0)} min short of the flag`)
         : 'on the battery alone, alternator failed'],
      ['Loom mass', `${model.mass.total_kg.toFixed(2)} kg`,
       `${model.mass.byGroup.length} group${model.mass.byGroup.length === 1 ? '' : 's'}`],
      ['Circuits over limit', String(model.failing),
       `${model.marginal} within 10% of one`],
    ];

    const frag = document.createDocumentFragment();
    for (const [label, value, note] of cells) {
      const cell = el('div', 'stat');
      cell.append(el('p', 'eyebrow', label));
      cell.append(el('p', 'stat-value', value));
      cell.append(el('p', 'stat-note', note));
      frag.append(cell);
    }
    // The endurance figure is the one most teams have never written
    // down, so it gets said in words as well as printed as a number.
    if (Number.isFinite(b.timeToFlat_min) && remaining > 0 && b.timeToFlat_min < remaining) {
      const warn = el('div', 'stat stat-warn');
      warn.append(el('p', 'eyebrow', 'Alternator failure'));
      warn.append(el('p', 'stat-value', 'Retirement'));
      warn.append(el('p', 'stat-note',
        `The battery runs out ${(remaining - b.timeToFlat_min).toFixed(0)} minutes before the flag.`));
      frag.append(warn);
    }
    document.getElementById('summary').replaceChildren(frag);
  }

  /* ---------- system and supply ---------- */
  renderSystem() {
    const host = document.getElementById('system');
    const frag = document.createDocumentFragment();

    const groups = [
      ['System', 'system', [
        ['nominalV', 'Nominal, V'],
        ['runningV', 'Running, V'],
        ['crankingV', 'Cranking, V'],
        ['ambient_c', 'Ambient, °C'],
        ['groundReturn_mohm', 'Chassis return, mΩ'],
      ], 'Chassis return resistance is a measured property of this car — a bolted, painted, corroded joint is not something a formula knows. Measure it between the load\'s ground stud and the battery negative.'],
      ['Supply', 'supply', [
        ['alternator_a_at_idle', 'Alternator at idle, A'],
        ['alternator_a_at_race', 'Alternator at race, A'],
        ['batteryCapacity_ah', 'Battery, Ah'],
        ['batteryReserve_pct', 'Reserve, %'],
      ], ''],
    ];

    for (const [title, key, fields, hint] of groups) {
      const box = el('section', 'group');
      box.append(el('h3', null, title));
      if (hint) box.append(el('p', 'blurb', hint));
      const grid = el('div', 'field-grid');
      for (const [k, label] of fields) grid.append(this.field(`${key}.${k}`, label));
      box.append(grid);
      frag.append(box);
    }

    const race = el('section', 'group');
    race.append(el('h3', null, 'Race'));
    race.append(el('p', 'blurb',
      'Only used to say whether an alternator failure is a retirement or a finish.'));
    const grid = el('div', 'field-grid');
    grid.append(this.field('raceRemaining_min', 'Race remaining, min'));
    race.append(grid);
    frag.append(race);

    frag.append(this.limitsBox());
    frag.append(this.specNote());
    host.replaceChildren(frag);
  }

  limitsBox() {
    const box = el('section', 'group');
    box.append(el('h3', null, 'Limits'));
    box.append(el('p', 'blurb',
      'Defaults from data/wire-spec.json. A critical circuit is held to both a ' +
      'percentage and an absolute volt figure, because on a sensor reference the ' +
      'drop appears directly as measurement error.'));
    const grid = el('div', 'field-grid');
    const limits = { ...this.spec.limits, ...this.session.limits };
    for (const [k, label] of [
      ['generalDrop_pct', 'General drop, %'],
      ['criticalDrop_pct', 'Critical drop, %'],
      ['criticalDrop_v', 'Critical drop, V'],
      ['crankingDrop_pct', 'Cranking drop, %'],
    ]) {
      const wrap = el('div', 'field');
      const id = `lim_${k}`;
      const lab = el('label', null, label);
      lab.htmlFor = id;
      const input = el('input');
      input.id = id;
      input.inputMode = 'decimal';
      input.value = limits[k] ?? '';
      input.addEventListener('input', () => {
        this.session.limits[k] = input.value === '' ? undefined : Number(input.value);
        this.change();
      });
      wrap.append(lab, input);
      grid.append(wrap);
    }
    box.append(grid);
    return box;
  }

  /* The seeded ratings are not authoritative and the tool says so
     where it cannot be missed rather than in a README nobody opens. */
  specNote() {
    const box = el('section', 'group note-seed');
    box.append(el('h3', null, 'Wire ratings'));
    box.append(el('p', 'blurb', this.spec.warning));
    const dl = el('div', 'table mini');
    for (const ins of this.spec.insulations) {
      const row = el('div', 'trow');
      row.append(el('div', 'tcell tlabel', ins.label));
      row.append(el('div', 'tcell tvalue', `${ins.rating_c} °C`));
      dl.append(row);
    }
    box.append(dl);
    const btn = el('button', 'ghost', 'Export the rating table');
    btn.id = 'export-spec';
    box.append(btn);
    return box;
  }

  field(path, label) {
    const wrap = el('div', 'field');
    const id = `f_${path.replace(/\./g, '_')}`;
    const lab = el('label', null, label);
    lab.htmlFor = id;
    const input = el('input');
    input.id = id;
    input.inputMode = 'decimal';
    input.value = get(this.session, path) ?? '';
    input.addEventListener('input', () => {
      set(this.session, path, input.value === '' ? '' : Number(input.value));
      this.change();
    });
    wrap.append(lab, input);
    return wrap;
  }

  /* ---------- the circuit table ---------- */
  renderTable(model) {
    const host = document.getElementById('circuits');
    const frag = document.createDocumentFragment();

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'The loom'));
    head.append(el('h2', null, 'Circuits'));
    head.append(el('p', 'blurb',
      'Entered on the left, computed on the right. A computed cell is text, ' +
      'not an input: if a number can be derived it is not also enterable.'));
    frag.append(head);

    if (!this.session.circuits.length) {
      const empty = el('p', 'empty',
        'No circuits yet. Import a Loom Planner export — the wire schedule maps ' +
        'straight to circuits, with only the load current and the duty cycle left ' +
        'to fill — or add a row.');
      frag.append(empty);
    }

    const table = el('div', 'table wide');
    const header = el('div', 'trow thead');
    header.append(el('div', 'tcell tnum', '#'));
    for (const c of this.columns) {
      const cell = el('div', `tcell${c.k.startsWith('_') ? ' derived' : ''}`, c.label);
      cell.style.flex = `${c.w} 1 0`;
      header.append(cell);
    }
    header.append(el('div', 'tcell tdel'));
    table.append(header);

    this.session.circuits.forEach((circuit, i) => {
      const result = model.byId.get(circuit.id);
      const row = el('div', `trow margin-${result?.margin || 'ok'}`);
      row.append(el('div', 'tcell tnum', String(i + 1)));

      for (const c of this.columns) {
        const cell = el('div', `tcell${c.k.startsWith('_') ? ' derived' : ''}`);
        cell.style.flex = `${c.w} 1 0`;
        if (c.k.startsWith('_')) {
          cell.append(el('span', this.cellClass(c, result), cellText(circuit, result, c)));
        } else {
          cell.append(this.input(circuit, c));
        }
        row.append(cell);
      }

      const del = el('div', 'tcell tdel');
      const x = el('button', 'icon', '×');
      x.title = 'Remove circuit';
      x.addEventListener('click', () => {
        this.session.circuits.splice(i, 1);
        this.change(true);
      });
      del.append(x);
      row.append(del);
      table.append(row);

      // Notes live in their own container so a keystroke can refresh
      // them without tearing down the input it was typed into.
      const notes = el('div', 'row-notes');
      this.fillNotes(notes, result);
      table.append(notes);
    });

    frag.append(table);

    const add = el('button', 'add', '+ Add circuit');
    add.id = 'add-circuit';
    frag.append(add);
    host.replaceChildren(frag);
  }

  fillNotes(host, result) {
    host.replaceChildren(...(result?.issues || []).map(
      issue => el('p', `row-note sev-${issue.severity}`, issue.message)));
  }

  cellClass(column, result) {
    if (!result) return '';
    const over = {
      _dropPct: result.running.pct > result.limit_pct,
      _drop: result.limit_v !== Infinity && result.running.dV > result.limit_v,
      _crank: result.cranking.pct > 10,
      _allowed: false,
    }[column.k];
    return over ? 'over' : '';
  }

  input(circuit, column) {
    if (column.type === 'check') {
      const box = el('input');
      box.type = 'checkbox';
      box.checked = !!circuit[column.k];
      box.setAttribute('aria-label', column.label);
      box.addEventListener('change', () => {
        circuit[column.k] = box.checked;
        this.change(true);
      });
      return box;
    }
    if (column.options) {
      const select = el('select');
      select.setAttribute('aria-label', column.label);
      for (const [value, text] of column.options) select.append(new Option(text, value));
      select.value = circuit[column.k] ?? '';
      select.addEventListener('change', () => {
        circuit[column.k] = select.value;
        this.change(true);
      });
      return select;
    }
    const input = el('input');
    input.inputMode = column.numeric ? 'decimal' : 'text';
    input.setAttribute('aria-label', column.label);
    input.value = circuit[column.k] ?? '';
    input.addEventListener('input', () => {
      circuit[column.k] = column.numeric && input.value !== ''
        ? Number(input.value) : input.value;
      this.change();
    });
    return input;
  }

  /* ---------- issues ---------- */
  renderIssues(model) {
    const box = document.getElementById('issues');
    const loomLevel = model.issues.filter(i =>
      i.kind === 'ground-shared' || i.kind === 'alternator' || i.kind === 'alternator-idle');
    if (!loomLevel.length) { box.replaceChildren(); box.hidden = true; return; }
    box.hidden = false;
    const frag = document.createDocumentFragment();
    frag.append(el('h4', null, 'The loom as a whole'));
    const ul = el('ul');
    for (const i of loomLevel) ul.append(el('li', `sev-${i.severity}`, i.message));
    frag.append(ul);
    box.replaceChildren(frag);
  }

  /* ---------- the fuse chart ----------

     The sheet that gets laminated and taped inside the fusebox lid,
     which is the highest-value thing this tool produces. Rendered
     into the page and printed from there rather than opened as a
     blob: the page takes default-src 'none' and a print stylesheet
     needs no exemption. Fuse position, circuit, rating, conductor —
     in fuse-position order, which is the order someone reads it in
     at two in the morning with a torch. */
  renderFuseChart(model) {
    const host = document.getElementById('fuse-chart');
    const frag = document.createDocumentFragment();

    const head = el('header', 'chart-head');
    head.append(el('p', 'chart-eyebrow', 'Fuse chart'));
    head.append(el('h2', null, this.session.title || 'Fusebox'));
    head.append(el('p', 'chart-note',
      `${this.session.circuits.length} circuits · ` +
      `${model.budget.continuousDraw_a.toFixed(0)} A continuous · ` +
      `printed from the load budget`));
    frag.append(head);

    const sorted = [...this.session.circuits].sort((a, b) =>
      String(a.fusePosition).localeCompare(String(b.fusePosition), undefined, { numeric: true }));

    const table = el('table', 'fuse-table');
    const thead = el('thead');
    const hr = el('tr');
    for (const label of ['Pos', 'Circuit', 'Fuse', 'Wire', 'Feeds']) {
      hr.append(el('th', null, label));
    }
    thead.append(hr);
    table.append(thead);

    const tbody = el('tbody');
    for (const c of sorted) {
      const tr = el('tr');
      tr.append(el('td', 'pos', c.fusePosition || '—'));
      tr.append(el('td', 'name', c.name || '—'));
      tr.append(el('td', 'fuse', c.fuse_a ? `${c.fuse_a} A` : '—'));
      tr.append(el('td', 'wire', c.csa_mm2 ? `${c.csa_mm2} mm²` : '—'));
      tr.append(el('td', 'feeds', c.to || c.group || ''));
      tbody.append(tr);
    }
    table.append(tbody);
    frag.append(table);

    frag.append(el('p', 'chart-foot',
      'Replace a fuse with its stated rating and no other. A larger fuse makes ' +
      'the wire the fuse.'));

    host.replaceChildren(frag);
  }

  render(model) {
    this.renderSystem();
    this.renderSummary(model);
    this.renderTable(model);
    this.renderIssues(model);
    this.renderFuseChart(model);
  }

  /* A keystroke in a text cell must not tear down the input it was
     typed into, so the light path updates only what a value change
     can move. */
  refresh(model) {
    this.renderSummary(model);
    this.renderIssues(model);
    this.renderFuseChart(model);
    this.refreshDerived(model);
  }

  refreshDerived(model) {
    const rows = document.querySelectorAll('#circuits .trow:not(.thead)');
    const notes = document.querySelectorAll('#circuits .row-notes');
    this.session.circuits.forEach((circuit, i) => {
      const row = rows[i];
      if (!row) return;
      const result = model.byId.get(circuit.id);
      row.className = `trow margin-${result?.margin || 'ok'}`;
      if (notes[i]) this.fillNotes(notes[i], result);
      const cells = row.querySelectorAll('.tcell.derived');
      const derived = this.columns.filter(c => c.k.startsWith('_'));
      derived.forEach((column, j) => {
        const cell = cells[j];
        if (!cell) return;
        cell.replaceChildren(
          el('span', this.cellClass(column, result), cellText(circuit, result, column)));
      });
    });
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
