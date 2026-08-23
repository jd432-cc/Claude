/* =============================================================
   TheRacingData — Fuel & Stint Calculator
   Rendering.

   Three panes on one page, no wizard: inputs on the left, the
   field of strategies in the middle, the stint chart on the
   right. Everything recomputes on every keystroke — the model is
   a few hundred laps of arithmetic and debouncing it would only
   add a delay between a change and its consequence.

   Every derived figure is rendered read-only. If a number can be
   computed it is not also enterable, which is the rule the report
   engine encodes with `computed` and the same rule here.
   ============================================================= */

import { GROUPS, get, set, toDisplay, fromDisplay, unitLabel, fmtClock, fmtLap }
  from './state.js';
import { fuelSensitivityFrom } from './calc/strategy.js';
import * as chart from './chart.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export class UI {
  constructor(session, fuels, onChange) {
    this.session = session;
    this.fuels = fuels;
    this.onChange = onChange;
    this.units = 'metric';
    this.selected = null;
    this.sensitivityProbe = { t1: '', m1: '', t2: '', m2: '' };
  }

  change() {
    this.onChange(this.session);
  }

  /* ---------- inputs ---------- */
  renderInputs() {
    const host = document.getElementById('inputs');
    const frag = document.createDocumentFragment();

    for (const group of GROUPS) {
      const box = el('section', 'group');
      box.append(el('h3', null, group.title));
      if (group.blurb) box.append(el('p', 'blurb', group.blurb));
      const grid = el('div', 'field-grid');
      for (const f of group.fields) {
        if (f.showIf && !f.showIf(this.session)) continue;
        grid.append(this.field(f));
      }
      box.append(grid);
      if (group.id === 'pace') box.append(this.sensitivityHelper());
      if (group.id === 'rules') box.append(this.windowEditor(), this.scEditor());
      frag.append(box);
    }
    host.replaceChildren(frag);
  }

  field(f) {
    const wrap = el('div', 'field');
    const id = `f_${f.k.replace(/\./g, '_')}`;
    const label = el('label', null, f.label);
    label.htmlFor = id;

    if (f.type === 'check') {
      const row = el('div', 'field-row tick-row');
      const box = el('input');
      box.type = 'checkbox';
      box.id = id;
      box.checked = !!get(this.session, f.k);
      box.addEventListener('change', () => {
        set(this.session, f.k, box.checked);
        this.change();
        this.renderInputs();
      });
      row.append(box, label);
      wrap.append(row);
      if (f.hint) wrap.append(el('p', 'hint', f.hint));
      return wrap;
    }

    wrap.append(label);
    const row = el('div', 'field-row');
    let input;

    if (f.type === 'select') {
      input = el('select');
      input.id = id;
      const options = f.k === 'car.fuel'
        ? this.fuels.map(x => [x.id, x.label])
        : f.options;
      for (const [value, text] of options) input.append(new Option(text, value));
      input.value = get(this.session, f.k) ?? '';
      input.addEventListener('change', () => {
        set(this.session, f.k, input.value);
        if (f.k === 'car.fuel') this.adoptFuel(input.value);
        this.change();
        this.renderInputs();
      });
    } else {
      input = el('input');
      input.id = id;
      input.type = f.type === 'text' ? 'text' : 'text';
      input.inputMode = f.type === 'text' ? 'text' : 'decimal';
      if (f.placeholder) input.placeholder = f.placeholder;
      const raw = get(this.session, f.k) ?? '';
      input.value = f.display ? toDisplay(raw, f.display, this.units) : raw;
      input.addEventListener('input', () => {
        const v = f.display ? fromDisplay(input.value, f.display, this.units) : input.value;
        set(this.session, f.k, v);
        this.change();
      });
    }

    row.append(input);
    if (f.unit) {
      row.append(el('span', 'unit', f.display ? unitLabel(f.display, this.units, f.unit) : f.unit));
    }
    wrap.append(row);
    if (f.hint) wrap.append(el('p', 'hint', f.hint));
    return wrap;
  }

  adoptFuel(id) {
    const fuel = this.fuels.find(x => x.id === id);
    if (!fuel) return;
    set(this.session, 'car.fuelDensity_kg_per_l', fuel.density_kg_per_l);
    set(this.session, 'car.fuelBeta_per_c', fuel.beta_per_c);
    set(this.session, 'car.fuelSource', fuel.source);
  }

  /* Two laps in, one measured quantity out. The alternative is a
     number typed from memory, which is how 0.030 s/kg ends up on a
     circuit where the truth is 0.045. */
  sensitivityHelper() {
    const box = el('div', 'helper');
    box.append(el('h4', null, 'Back-compute the fuel sensitivity'));
    box.append(el('p', 'hint',
      'Two laps of known fuel mass, already corrected for degradation and ' +
      'for anything else that moved between them. k = (t₁ − t₂) / (m₁ − m₂).'));

    const grid = el('div', 'field-grid tight');
    const probe = this.sensitivityProbe;
    const cells = [
      ['t1', 'Lap 1 time, s'], ['m1', 'Lap 1 fuel, kg'],
      ['t2', 'Lap 2 time, s'], ['m2', 'Lap 2 fuel, kg'],
    ];
    for (const [key, label] of cells) {
      const wrap = el('div', 'field');
      const l = el('label', null, label);
      const input = el('input');
      input.inputMode = 'decimal';
      input.value = probe[key];
      l.htmlFor = input.id = `probe_${key}`;
      input.addEventListener('input', () => {
        probe[key] = input.value;
        this.renderProbeResult(box);
      });
      wrap.append(l, input);
      grid.append(wrap);
    }
    box.append(grid);
    box.append(el('p', 'probe-result'));
    this.renderProbeResult(box);
    return box;
  }

  renderProbeResult(box) {
    const out = box.querySelector('.probe-result');
    const p = this.sensitivityProbe;
    const k = fuelSensitivityFrom(
      { lapTime_s: Number(p.t1), fuelMass_kg: Number(p.m1) },
      { lapTime_s: Number(p.t2), fuelMass_kg: Number(p.m2) });
    if (!Number.isFinite(k)) {
      out.replaceChildren(document.createTextNode('Fill all four to compute k.'));
      return;
    }
    out.replaceChildren(document.createTextNode(`k = ${k.toFixed(4)} s/kg`));
    const use = el('button', 'link', 'Use this');
    use.addEventListener('click', () => {
      set(this.session, 'pace.fuelSensitivity_s_per_kg', Number(k.toFixed(4)));
      this.change();
      this.renderInputs();
    });
    out.append(document.createTextNode('  '), use);
  }

  windowEditor() {
    return this.rowEditor({
      title: 'Mandatory windows',
      hint: 'A stop has to fall inside each of these. A candidate that misses one is still scored and marked.',
      list: this.session.rules.mandatoryWindow,
      columns: [['openLap', 'Opens, lap'], ['closeLap', 'Closes, lap']],
      addLabel: 'Add window',
    });
  }

  scEditor() {
    return this.rowEditor({
      title: 'Assumed safety cars',
      hint: 'A pace factor of 0.6 means the field runs at 60% of racing speed. It is an assumption and the chart draws it as one.',
      list: this.session.sc.assumed,
      columns: [['startLap', 'From lap'], ['laps', 'Laps'], ['paceFactor', 'Pace factor']],
      addLabel: 'Add safety car',
    });
  }

  rowEditor({ title, hint, list, columns, addLabel }) {
    const box = el('div', 'helper');
    box.append(el('h4', null, title));
    if (hint) box.append(el('p', 'hint', hint));

    list.forEach((row, i) => {
      const line = el('div', 'row-line');
      for (const [key, label] of columns) {
        const input = el('input');
        input.inputMode = 'decimal';
        input.placeholder = label;
        input.setAttribute('aria-label', label);
        input.value = row[key] ?? '';
        input.addEventListener('input', () => { row[key] = input.value; this.change(); });
        line.append(input);
      }
      const x = el('button', 'icon', '×');
      x.title = 'Remove';
      x.addEventListener('click', () => { list.splice(i, 1); this.change(); this.renderInputs(); });
      line.append(x);
      box.append(line);
    });

    const add = el('button', 'add', `+ ${addLabel}`);
    add.addEventListener('click', () => {
      list.push(Object.fromEntries(columns.map(([k]) => [k, ''])));
      this.change();
      this.renderInputs();
    });
    box.append(add);
    return box;
  }

  /* ---------- summary band ---------- */
  renderSummary(computed) {
    const d = computed.derived;
    const host = document.getElementById('summary');
    const cap = d.capacity;

    const cells = [
      ['Race', `${d.raceLaps} laps`, d.race?.mode === 'time'
        ? `${d.race.lapsWithinTime} inside the clock, one at the flag` : 'as scheduled'],
      ['Stint ceiling', `${cap.plannable} laps`, bindingWord(cap)],
      ['Pit loss', `${d.pitLoss.total_s.toFixed(1)} s`,
        `${d.pitLossSC.total_s.toFixed(1)} s under safety car`],
      ['Fuel density', `${d.density_kg_per_l.toFixed(4)} kg/l`,
        `at ${Number(computed.car.fuelTemp_c) || 0} °C`],
    ];

    const frag = document.createDocumentFragment();
    for (const [label, value, note] of cells) {
      const cell = el('div', 'stat');
      cell.append(el('p', 'eyebrow', label));
      cell.append(el('p', 'stat-value', value));
      cell.append(el('p', 'stat-note', note));
      frag.append(cell);
    }
    host.replaceChildren(frag);
  }

  /* ---------- the field ---------- */
  renderStrategies(computed) {
    const host = document.getElementById('strategies');
    const candidates = computed.derived.candidates;
    const frag = document.createDocumentFragment();

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'The field'));
    head.append(el('h2', null, 'Strategies available'));
    head.append(el('p', 'blurb',
      'Every legal stop count, two lap distributions each, scored on total race ' +
      'time. Not one optimum — the field, and the gaps between its entries.'));
    frag.append(head);

    if (!candidates.length) {
      frag.append(el('p', 'empty', 'Not enough of the car is filled in to build a stint plan.'));
      host.replaceChildren(frag);
      return;
    }

    if (!this.selected || !candidates.some(c => c.id === this.selected)) {
      this.selected = (candidates.find(c => !c.legal.length) || candidates[0]).id;
    }

    const table = el('div', 'table');
    const header = el('div', 'trow thead');
    for (const [label, cls] of [
      ['Stops', 'c-stops'], ['Stint laps', 'c-laps'], ['Fuel per stint, l', 'c-fuel'],
      ['Total race time', 'c-total'], ['Δ to best', 'c-delta'], ['Binding', 'c-bind'],
    ]) header.append(el('div', `tcell ${cls}`, label));
    table.append(header);

    for (const c of candidates) {
      const row = el('button', 'trow' + (c.id === this.selected ? ' active' : '') +
                                (c.legal.length ? ' illegal' : ''));
      row.append(el('div', 'tcell c-stops', String(c.stops)));
      row.append(el('div', 'tcell c-laps', c.stints.map(s => s.laps).join(' / ')));
      row.append(el('div', 'tcell c-fuel', c.stints.map(s => s.load_l.toFixed(1)).join(' / ')));
      row.append(el('div', 'tcell c-total', fmtClock(c.total_s)));
      row.append(el('div', 'tcell c-delta',
        c.delta_s > 0.005 ? `+${c.delta_s.toFixed(1)} s` : '—'));
      row.append(el('div', 'tcell c-bind', bindingSummary(c)));
      row.addEventListener('click', () => {
        this.selected = c.id;
        this.session.pinned = c.id;
        this.change();
      });
      table.append(row);

      if (c.legal.length) {
        const note = el('p', 'row-note', c.legal.join('  '));
        table.append(note);
      }
    }
    frag.append(table);

    const shape = el('p', 'hint',
      'Two distributions per stop count: even, and front-loaded — a long first ' +
      'stint bought for track position at the cost of running the heaviest laps longest.');
    frag.append(shape);

    host.replaceChildren(frag);
  }

  /* ---------- the selected strategy, in detail ---------- */
  renderDetail(computed) {
    const host = document.getElementById('detail');
    const candidate = this.candidate(computed);
    const frag = document.createDocumentFragment();
    if (!candidate) { host.replaceChildren(frag); return; }

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'Selected'));
    head.append(el('h2', null,
      `${candidate.stops} stop${candidate.stops === 1 ? '' : 's'}, ${candidate.shape}`));
    frag.append(head);

    /* Stint table */
    const table = el('div', 'table');
    const header = el('div', 'trow thead');
    for (const label of ['Stint', 'Laps', 'From', 'To', 'Fuel, l', 'Fuel, kg', 'Stint time', 'Binding']) {
      header.append(el('div', 'tcell', label));
    }
    table.append(header);
    for (const s of candidate.stints) {
      const row = el('div', 'trow');
      row.append(el('div', 'tcell', String(s.n)));
      row.append(el('div', 'tcell', String(s.laps)));
      row.append(el('div', 'tcell', String(s.fromLap)));
      row.append(el('div', 'tcell', String(s.toLap)));
      row.append(el('div', 'tcell' + (s.overTank ? ' over' : ''), s.load_l.toFixed(1)));
      row.append(el('div', 'tcell', s.loadMass_kg.toFixed(1)));
      row.append(el('div', 'tcell', fmtClock(s.time_s)));
      row.append(el('div', 'tcell', s.binding));
      table.append(row);
    }
    frag.append(table);

    /* Pit loss, itemised. One number would hide which of the three moved. */
    const loss = candidate.pitLoss;
    frag.append(this.miniTable('Pit loss, itemised', [
      ['Lane at the limit', `${loss.lane_s.toFixed(2)} s`],
      ['Same lane at racing pace', `−${loss.racing_s.toFixed(2)} s`],
      ['Stationary', `${loss.stationary_s.toFixed(2)} s`],
      ['Entry and exit', `${loss.entryExitLoss_s.toFixed(2)} s`],
      ['Total, per stop', `${loss.total_s.toFixed(2)} s`],
      ['Under safety car', `${computed.derived.pitLossSC.total_s.toFixed(2)} s`],
    ]));

    /* The saving that removes a stop. */
    const savings = computed.derived.savingByStints
      .filter(s => s.stints <= candidate.stints.length && s.needed);
    if (savings.length) {
      const box = el('div', 'helper');
      box.append(el('h4', null, 'Saving fuel to remove a stop'));
      const t = el('div', 'table');
      const h = el('div', 'trow thead');
      for (const label of ['Stints', 'Burn needed, l/lap', 'Saving', 'Cost, s/lap', 'Net']) {
        h.append(el('div', 'tcell', label));
      }
      t.append(h);
      for (const s of savings) {
        const row = el('div', 'trow');
        row.append(el('div', 'tcell', String(s.stints)));
        row.append(el('div', 'tcell', s.requiredBurn_l_per_lap.toFixed(3)));
        row.append(el('div', 'tcell',
          `${s.savingPct.toFixed(1)}%  ·  ${s.saving_l_per_lap.toFixed(3)} l/lap`));
        row.append(el('div', 'tcell', s.lapTimeCost_s.toFixed(2)));
        row.append(el('div', 'tcell' + (s.netGain_s > 0 ? ' good' : ' bad'),
          `${s.netGain_s >= 0 ? '+' : ''}${s.netGain_s.toFixed(1)} s`));
        t.append(row);
      }
      box.append(t);
      box.append(el('p', 'hint',
        'The saving is stated twice on purpose: the driver is told a percentage ' +
        'and the ECU is told litres per lap, and neither number is the other one.'));
      frag.append(box);
    }

    /* Undercut. */
    const uc = computed.derived.undercut;
    const ucBox = el('div', 'helper');
    ucBox.append(el('h4', null,
      `Undercut against a rival ${Math.round(Number(computed.pace.rivalStintLap) || 0)} laps into a stint`));
    const ucTable = el('div', 'table');
    const ucHead = el('div', 'trow thead');
    for (const label of ['Offset, laps', 'Gross gain', 'Net of the in lap', 'Verdict']) {
      ucHead.append(el('div', 'tcell', label));
    }
    ucTable.append(ucHead);
    for (const r of uc.rows) {
      const row = el('div', 'trow');
      row.append(el('div', 'tcell', String(r.offset)));
      row.append(el('div', 'tcell', `${r.gain_s.toFixed(2)} s`));
      row.append(el('div', 'tcell', `${r.net_s >= 0 ? '+' : ''}${r.net_s.toFixed(2)} s`));
      row.append(el('div', 'tcell' + (r.pays ? ' good' : ' bad'), r.pays ? 'pays' : 'does not pay'));
      ucTable.append(row);
    }
    ucBox.append(ucTable);
    ucBox.append(el('p', 'hint', uc.crossover
      ? `The undercut starts paying from ${uc.crossover} lap${uc.crossover === 1 ? '' : 's'} of offset. ` +
        'With linear degradation the advantage accumulates, so there is no lap at which it stops.'
      : 'The undercut does not pay inside five laps of offset against this rival.'));
    frag.append(ucBox);

    frag.append(this.miniTable('Modelled pace', [
      ['Base lap', fmtLap(Number(computed.pace.baseLap_s) || 0)],
      ['Fuel effect, full first stint',
        `${((Number(computed.pace.fuelSensitivity_s_per_kg) || 0) *
            candidate.stints[0].loadMass_kg).toFixed(2)} s on lap one`],
      ['Total race time', fmtClock(candidate.total_s)],
      ['Average lap',
        fmtLap((candidate.total_s - candidate.stops * candidate.pitLoss_s) /
               Math.max(1, computed.derived.raceLaps))],
    ]));

    host.replaceChildren(frag);
  }

  miniTable(title, rows) {
    const box = el('div', 'helper');
    box.append(el('h4', null, title));
    const t = el('div', 'table mini');
    for (const [label, value] of rows) {
      const row = el('div', 'trow');
      row.append(el('div', 'tcell tlabel', label));
      row.append(el('div', 'tcell tvalue', value));
      t.append(row);
    }
    box.append(t);
    return box;
  }

  renderIssues(computed) {
    const box = document.getElementById('issues');
    const issues = computed.derived.issues;
    if (!issues.length) { box.replaceChildren(); box.hidden = true; return; }
    box.hidden = false;
    const frag = document.createDocumentFragment();
    const errors = issues.filter(i => i.severity === 'error').length;
    frag.append(el('h4', null, errors
      ? `${errors} thing${errors > 1 ? 's' : ''} that stop${errors > 1 ? '' : 's'} this plan being run`
      : `${issues.length} thing${issues.length > 1 ? 's' : ''} to be aware of`));
    const ul = el('ul');
    for (const i of issues) {
      ul.append(el('li', `sev-${i.severity}`, i.message));
    }
    frag.append(ul);
    box.replaceChildren(frag);
  }

  renderChart(computed) {
    chart.render(document.getElementById('chart-pane'), computed, this.candidate(computed));
  }

  candidate(computed) {
    const list = computed.derived.candidates;
    return list.find(c => c.id === this.selected) || list[0] || null;
  }

  render(computed) {
    this.renderInputs();
    this.renderSummary(computed);
    this.renderStrategies(computed);
    this.renderIssues(computed);
    this.renderDetail(computed);
    this.renderChart(computed);
  }
}

function bindingWord(cap) {
  if (cap.binding === 'tyre') return `tyre-limited, tank would carry ${cap.fuelLaps}`;
  if (cap.binding === 'fuel') return `fuel-limited, tyres would last ${cap.tyreLaps}`;
  if (cap.binding === 'both') return 'fuel and tyres run out together';
  return 'neither constraint set';
}

function bindingSummary(candidate) {
  const kinds = [...new Set(candidate.stints.map(s => s.binding))];
  return kinds.join(', ');
}
