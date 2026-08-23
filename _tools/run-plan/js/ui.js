/* =============================================================
   TheRacingData — Run Plan & Setup Log
   Rendering.

   Two tabs, because there are two objects and they only make
   sense together. The run plan is a card list; the setup sheet is
   the register as a form with a revision selector and a compare
   control.

   The change picker is the focus of a run card, and the result
   fields below it are closed until the gate clears — with the
   reason stated, not merely the fact. A greyed field with no
   explanation teaches nobody anything.

   Changed cells carry a Signal Red left rule. The value text is
   never red on the dark ground: #970000 measures 2.18:1 on Ink
   and fails, which is why it is only ever a fill or a rule here.
   ============================================================= */

import { theRegister } from './state.js';
import {
  diff, derivedDiff, reconcile, runGate, revisionByNumber,
} from './calc/setup-diff.js';
import { VERDICTS, VERDICT_LABELS } from './schemas/run-plan.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export class UI {
  constructor(report, onChange) {
    this.report = report;
    this.onChange = onChange;
    this.tab = 'runs';
    this.openRun = null;
  }

  /* `structural` re-renders the pane. A keystroke must never do that:
     replacing an <input> mid-word takes the caret with it, and the
     blur that fires when focus moves on would replace the field being
     moved *to*. Only a select, a checkbox, or a run or revision being
     added or removed changes what inputs exist. */
  change(structural = false) {
    this.onChange(this.report, structural);
  }

  get register() { return theRegister(); }

  activeRevision() {
    return revisionByNumber(this.report.setups, this.report.activeRev)
      || this.report.setups.at(-1) || null;
  }

  compareRevision() {
    return this.report.compareRev == null
      ? null
      : revisionByNumber(this.report.setups, this.report.compareRev);
  }

  /* Everything a run card needs to know about itself: what moved,
     what was declared, and whether the gate is closed. */
  runContext(run) {
    const applied = revisionByNumber(this.report.setups, run.setupRev);
    const parent = applied
      ? revisionByNumber(this.report.setups, applied.basedOnRev)
      : null;
    const rec = reconcile(run, parent || { values: {} }, applied || { values: {} },
                          this.register);
    return { applied, parent, rec, gate: runGate(run, rec) };
  }

  /* ---------- chrome ---------- */
  renderTabs() {
    const host = document.getElementById('tabs');
    const frag = document.createDocumentFragment();
    for (const [id, label] of [['runs', 'Run plan'], ['setup', 'Setup sheet']]) {
      const b = el('button', 'tab' + (this.tab === id ? ' active' : ''), label);
      b.addEventListener('click', () => { this.tab = id; this.render(); });
      frag.append(b);
    }
    host.replaceChildren(frag);
  }

  renderHeader() {
    const host = document.getElementById('meta');
    const frag = document.createDocumentFragment();
    const fields = [
      ['car.name', 'Car'], ['car.class', 'Class'], ['car.chassisNo', 'Chassis'],
      ['event.name', 'Event'], ['event.venue', 'Venue'], ['event.date', 'Date'],
      ['event.sessionRef', 'Session'], ['engineer', 'Engineer'],
      ['round', 'Round code'], ['venueCode', 'Venue code'], ['carCode', 'Car code'],
    ];
    for (const [key, label] of fields) frag.append(this.textField(key, label));
    host.replaceChildren(frag);
  }

  textField(path, label) {
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

  /* ---------- the run plan ---------- */
  renderRuns() {
    const host = document.getElementById('pane');
    const frag = document.createDocumentFragment();

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'One variable at a time'));
    head.append(el('h2', null, 'Run plan'));
    head.append(el('p', 'blurb',
      'Each run states the one thing it changed and whether that change is kept. ' +
      'A run that moved more than one parameter has its result fields closed ' +
      'until somebody says the multi-change was deliberate and why.'));
    frag.append(head);

    if (!this.report.runs.length) {
      frag.append(el('p', 'empty', 'No runs yet.'));
    }

    for (const run of this.report.runs) {
      frag.append(this.runCard(run));
    }

    const add = el('button', 'add', '+ Add run');
    add.addEventListener('click', () => {
      const n = this.report.runs.reduce((a, r) => Math.max(a, Number(r.n) || 0), 0) + 1;
      this.report.runs.push(newRunFor(n, this.activeRevision()?.rev ?? ''));
      this.openRun = n;
      this.change(true);
    });
    frag.append(add);
    host.replaceChildren(frag);
  }

  runCard(run) {
    const ctx = this.runContext(run);
    const open = this.openRun === run.n;
    const card = el('article', 'card' + (open ? ' open' : '') + (ctx.gate.gated ? ' gated' : ''));
    card.id = `card_${run.n}`;

    const head = el('button', 'card-head');
    head.append(el('span', 'card-n', `Run ${run.n}`));
    head.append(el('span', 'card-title', run.objective || 'No objective set'));
    head.append(el('span', 'card-change', this.changeSummary(run)));
    head.append(el('span', `card-verdict v-${run.verdict || 'none'}`,
      run.verdict || (ctx.gate.gated ? 'locked' : 'open')));
    head.addEventListener('click', () => {
      this.openRun = open ? null : run.n;
      this.render();
    });
    card.append(head);

    if (!open) return card;

    const body = el('div', 'card-body');

    /* Plan */
    const plan = el('div', 'field-grid');
    plan.append(this.runField(run, 'objective', 'Objective', 'text'));
    plan.append(this.runField(run, 'driver', 'Driver', 'text'));
    plan.append(this.runRevPicker(run));
    plan.append(this.runField(run, 'tyreSet', 'Tyre set', 'text'));
    plan.append(this.runField(run, 'fuel_l', 'Fuel, l', 'number'));
    plan.append(this.runField(run, 'laps', 'Laps', 'number'));
    body.append(plan);

    /* The change picker, which is the point of the card. */
    body.append(this.changePicker(run, ctx));

    /* Reconciliation. */
    body.append(this.reconciliation(ctx));

    /* The gate, then the result fields. */
    if (ctx.gate.gated) body.append(this.gateBox(run, ctx));
    body.append(this.resultFields(run, ctx));

    card.append(body);
    return card;
  }

  changeSummary(run) {
    if (!run.change?.param) return 'no change declared';
    const param = this.register.byKey(run.change.param);
    const unit = param?.unit ? ` ${param.unit}` : '';
    return `${param?.label || run.change.param}: ${blankish(run.change.from)} → ` +
           `${blankish(run.change.to)}${unit}`;
  }

  runRevPicker(run) {
    const wrap = el('div', 'field');
    const lab = el('label', null, 'Setup revision');
    const select = el('select');
    select.id = `run_${run.n}_rev`;
    lab.htmlFor = select.id;
    select.append(new Option('—', ''));
    for (const s of this.report.setups) {
      select.append(new Option(`Rev ${s.rev}${s.note ? ` — ${s.note}` : ''}`, String(s.rev)));
    }
    select.value = run.setupRev == null ? '' : String(run.setupRev);
    select.addEventListener('change', () => {
      run.setupRev = select.value === '' ? '' : Number(select.value);
      this.change(true);
    });
    wrap.append(lab, select);
    return wrap;
  }

  /* Selecting a parameter records `from` automatically, off the
     revision the run is based on. Asking for it would be asking
     someone to retype a number the tool already has, and a retyped
     number is a number that can be typed wrong. */
  changePicker(run, ctx) {
    const box = el('div', 'picker-box');
    box.append(el('h4', null, 'The one change'));
    box.append(el('p', 'hint',
      'One parameter. Selecting it records what it was; you say what it becomes.'));

    const grid = el('div', 'field-grid');

    const wrap = el('div', 'field wide');
    const lab = el('label', null, 'Parameter');
    const select = el('select');
    select.id = `run_${run.n}_param`;
    lab.htmlFor = select.id;
    select.append(new Option('— nothing changed —', ''));
    for (const group of this.register.groups) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group;
      for (const param of this.register.inGroup(group)) {
        if (param.computed) continue;   // a consequence is not a change
        optgroup.append(new Option(param.label, param.key));
      }
      select.append(optgroup);
    }
    select.value = run.change.param || '';
    select.addEventListener('change', () => {
      run.change.param = select.value;
      run.change.from = select.value
        ? (ctx.parent?.values?.[select.value] ?? '')
        : '';
      this.change(true);
    });
    wrap.append(lab, select);
    grid.append(wrap);

    const from = el('div', 'field');
    const fromLab = el('label', null, 'From');
    const fromInput = el('input', 'derived');
    fromInput.readOnly = true;
    fromInput.id = `run_${run.n}_from`;
    fromLab.htmlFor = fromInput.id;
    fromInput.value = blankish(run.change.from);
    fromInput.title = 'Read off the revision this run is based on.';
    from.append(fromLab, fromInput);
    grid.append(from);

    grid.append(this.runField(run, 'change.to', 'To', 'text'));
    grid.append(this.runField(run, 'change.rationale', 'Rationale', 'textarea'));
    box.append(grid);
    return box;
  }

  reconciliation(ctx) {
    const box = el('div', 'recon');
    const rows = [
      ['Declared', ctx.rec.declared ? ctx.rec.declared.label : '—'],
      ['Actually moved', ctx.rec.actual.length
        ? ctx.rec.actual.map(r => r.label).join(', ') : '—'],
      ['Undeclared', ctx.rec.undeclared.length
        ? ctx.rec.undeclared.map(r => `${r.label} (${blankish(r.from)} → ${blankish(r.to)})`).join(', ')
        : '—'],
      ['Declared but not applied', ctx.rec.notApplied.length
        ? ctx.rec.notApplied.map(r => r.label).join(', ') : '—'],
    ];
    for (const [label, value] of rows) {
      const line = el('div', 'recon-row' +
        (label === 'Undeclared' && ctx.rec.undeclared.length ? ' flagged' : '') +
        (label === 'Declared but not applied' && ctx.rec.notApplied.length ? ' flagged' : ''));
      line.append(el('span', 'recon-label', label));
      line.append(el('span', 'recon-value', value));
      box.append(line);
    }
    return box;
  }

  gateBox(run, ctx) {
    const box = el('div', 'gate');
    box.append(el('p', 'gate-message', ctx.gate.message));

    const tick = el('label', 'tick');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = !!run.multiChange.deliberate;
    cb.addEventListener('change', () => {
      run.multiChange.deliberate = cb.checked;
      this.change();
      this.refreshRun(run);
    });
    tick.append(cb, el('span', null, 'This multi-change was deliberate'));
    box.append(tick);

    const reason = el('textarea');
    reason.rows = 2;
    reason.placeholder = 'Why more than one parameter moved on this run';
    reason.setAttribute('aria-label', 'Reason for the multi-change');
    reason.value = run.multiChange.reason || '';
    reason.addEventListener('input', () => {
      run.multiChange.reason = reason.value;
      this.change();
      this.refreshRun(run);
    });
    box.append(reason);
    return box;
  }

  resultFields(run, ctx) {
    const box = el('div', 'results' + (ctx.gate.gated ? ' locked' : ''));
    box.append(el('h4', null, 'Result'));
    const reason = el('p', 'lock-reason', ctx.gate.gated ? ctx.gate.lockMessage : '');
    reason.hidden = !ctx.gate.gated;
    box.append(reason);

    const grid = el('div', 'field-grid');
    grid.append(this.runField(run, 'expected', 'Expected', 'textarea'));
    grid.append(this.runField(run, 'measured', 'Measured', 'textarea'));
    grid.append(this.runField(run, 'bestLap_s', 'Best lap, s', 'number'));

    const verdict = el('div', 'field');
    const lab = el('label', null, 'Verdict');
    const select = el('select');
    select.id = `run_${run.n}_verdict`;
    lab.htmlFor = select.id;
    select.append(new Option('— not decided —', ''));
    for (const v of VERDICTS) select.append(new Option(VERDICT_LABELS[v], v));
    select.value = run.verdict || '';
    select.addEventListener('change', () => {
      run.verdict = select.value;
      this.change(true);
    });
    verdict.append(lab, select);
    grid.append(verdict);
    grid.append(this.runField(run, 'notes', 'Notes', 'textarea'));
    box.append(grid);

    if (run.verdict === 'revert' && run.change.param) {
      const btn = el('button', 'ghost', 'Create the reverting revision');
      btn.addEventListener('click', () => this.onRevert?.(run));
      box.append(btn);
      box.append(el('p', 'hint',
        'A revert is a new revision restoring the previous value. The revision ' +
        'that made the change stays on file — that it was tried and taken back ' +
        'is a different fact from it never having been tried.'));
    }

    const remove = el('button', 'ghost danger', 'Delete this run');
    remove.addEventListener('click', () => {
      if (!confirm(`Delete run ${run.n}? History is meant to be kept.`)) return;
      this.report.runs = this.report.runs.filter(r => r !== run);
      this.openRun = null;
      this.change(true);
    });
    box.append(remove);
    if (ctx.gate.gated) {
      for (const field of box.querySelectorAll('input, textarea, select, button')) {
        field.disabled = true;
      }
    }
    return box;
  }

  runField(run, path, label, type) {
    const wrap = el('div', 'field' + (type === 'textarea' ? ' wide' : ''));
    const id = `run_${run.n}_${path.replace(/\./g, '_')}`;
    const lab = el('label', null, label);
    lab.htmlFor = id;
    const input = type === 'textarea' ? el('textarea') : el('input');
    if (type === 'textarea') input.rows = 2;
    if (type === 'number') input.inputMode = 'decimal';
    input.id = id;
    input.value = get(run, path) ?? '';
    input.addEventListener('input', () => {
      set(run, path, input.value);
      this.change();
      this.refreshRun(run);
    });
    wrap.append(lab, input);
    return wrap;
  }

  /* What a typed character in a run card can move, without touching
     the input it was typed into: the card's own summary line, the
     reconciliation block, and whether the gate is closed. */
  refreshRun(run) {
    const card = document.getElementById(`card_${run.n}`);
    if (!card) return;
    const ctx = this.runContext(run);

    const summary = card.querySelector('.card-change');
    if (summary) summary.textContent = this.changeSummary(run);

    const verdict = card.querySelector('.card-verdict');
    if (verdict) {
      verdict.textContent = run.verdict || (ctx.gate.gated ? 'locked' : 'open');
      verdict.className = `card-verdict v-${run.verdict || (ctx.gate.gated ? 'locked' : 'none')}`;
    }

    const recon = card.querySelector('.recon');
    if (recon) recon.replaceWith(this.reconciliation(ctx));

    this.applyLock(card, ctx);
    card.classList.toggle('gated', ctx.gate.gated);
  }

  /* The result fields are always rendered. Greying them and saying why
     is the point; hiding them would leave nothing to explain. */
  applyLock(card, ctx) {
    const results = card.querySelector('.results');
    if (!results) return;
    results.classList.toggle('locked', ctx.gate.gated);
    const reason = results.querySelector('.lock-reason');
    if (reason) {
      reason.textContent = ctx.gate.gated ? ctx.gate.lockMessage : '';
      reason.hidden = !ctx.gate.gated;
    }
    for (const field of results.querySelectorAll('input, textarea, select, button')) {
      field.disabled = ctx.gate.gated;
    }
  }

  /* ---------- the setup sheet ---------- */
  renderSetup() {
    const host = document.getElementById('pane');
    const frag = document.createDocumentFragment();

    const head = el('header', 'pane-head');
    head.append(el('p', 'eyebrow', 'The car'));
    head.append(el('h2', null, 'Setup sheet'));
    frag.append(head);
    frag.append(this.revisionBar());

    const active = this.activeRevision();
    const compare = this.compareRevision();
    const moved = compare
      ? new Set(diff(compare, active, this.register).map(r => r.key))
      : new Set();

    if (compare) {
      const rows = diff(compare, active, this.register);
      const caused = derivedDiff(compare, active, this.register);
      const summary = el('div', 'compare-summary');
      summary.append(el('h4', null,
        `Rev ${compare.rev} → Rev ${active.rev}: ` +
        `${rows.length} change${rows.length === 1 ? '' : 's'}, ` +
        `${caused.length} consequence${caused.length === 1 ? '' : 's'}`));
      if (!rows.length) {
        summary.append(el('p', 'hint', 'Nothing moved between these two revisions.'));
      }
      for (const row of caused) {
        summary.append(el('p', 'hint',
          `${row.label}: ${row.from || '—'} → ${row.to || '—'} ${row.unit}`.trim()));
      }
      frag.append(summary);
    }

    for (const group of this.register.groups) {
      const box = el('section', 'group');
      box.append(el('h3', null, group));
      const grid = el('div', 'field-grid');
      for (const param of this.register.inGroup(group)) {
        grid.append(this.setupField(param, active, moved.has(param.key)));
      }
      box.append(grid);
      frag.append(box);
    }

    host.replaceChildren(frag);
  }

  revisionBar() {
    const bar = el('div', 'revbar');

    const activeWrap = el('label', 'picker');
    activeWrap.append(el('span', null, 'Revision'));
    const active = el('select');
    active.id = 'rev-active';
    for (const s of this.report.setups) {
      active.append(new Option(`Rev ${s.rev}${s.note ? ` — ${s.note}` : ''}`, String(s.rev)));
    }
    active.value = String(this.activeRevision()?.rev ?? '');
    active.addEventListener('change', () => {
      this.report.activeRev = Number(active.value);
      this.change(true);
    });
    activeWrap.append(active);
    bar.append(activeWrap);

    const compareWrap = el('label', 'picker');
    compareWrap.append(el('span', null, 'Compare with'));
    const compare = el('select');
    compare.id = 'rev-compare';
    compare.append(new Option('— nothing —', ''));
    for (const s of this.report.setups) {
      compare.append(new Option(`Rev ${s.rev}`, String(s.rev)));
    }
    compare.value = this.report.compareRev == null ? '' : String(this.report.compareRev);
    compare.addEventListener('change', () => {
      this.report.compareRev = compare.value === '' ? null : Number(compare.value);
      this.change(true);
    });
    compareWrap.append(compare);
    bar.append(compareWrap);

    bar.append(el('span', 'spacer'));

    const note = el('input');
    note.id = 'rev-note';
    note.placeholder = 'What this revision is';
    note.setAttribute('aria-label', 'Revision note');
    note.value = this.activeRevision()?.note || '';
    note.addEventListener('input', () => {
      const rev = this.activeRevision();
      if (rev) rev.note = note.value;
      this.change();
    });
    bar.append(note);

    const branch = el('button', 'ghost');
    branch.textContent = 'New revision from this';
    branch.addEventListener('click', () => this.onBranch?.());
    bar.append(branch);
    return bar;
  }

  setupField(param, revision, changed) {
    const wrap = el('div', 'field' + (changed ? ' changed' : '') +
                              (param.computed ? ' computed' : ''));
    const id = `p_${param.key.replace(/\./g, '_')}`;
    const lab = el('label', null, param.label);
    lab.htmlFor = id;
    wrap.append(lab);

    const row = el('div', 'field-row');
    let input;

    if (param.computed) {
      input = el('input', 'derived');
      input.readOnly = true;
      input.value = this.register.format(revision?.values, param.key);
      input.title = 'Computed from the entries it depends on. Change those instead.';
    } else if (param.options) {
      input = el('select');
      input.append(new Option('—', ''));
      for (const o of param.options) input.append(new Option(o, o));
      input.value = revision?.values?.[param.key] ?? '';
      input.addEventListener('change', () => {
        this.writeValue(revision, param, input.value);
        this.change();
        this.refreshComputed(revision);
        this.refreshChanged();
      });
    } else {
      input = el('input');
      input.inputMode = param.type === 'text' ? 'text' : 'decimal';
      input.value = revision?.values?.[param.key] ?? '';
      input.addEventListener('input', () => {
        this.writeValue(revision, param, input.value);
        this.change();
        this.refreshComputed(revision);
        this.refreshChanged();
      });
    }

    input.id = id;
    row.append(input);
    if (param.unit) row.append(el('span', 'unit', param.unit));
    wrap.append(row);
    if (param.hint) wrap.append(el('p', 'hint', param.hint));
    return wrap;
  }

  writeValue(revision, param, value) {
    if (!revision || param.computed) return;
    revision.values[param.key] = value;
  }

  /* The Signal Red rule on a changed cell follows the value, not the
     render, so a parameter typed back to what it was loses its rule
     immediately rather than at the next full draw. */
  refreshChanged() {
    const compare = this.compareRevision();
    if (!compare) return;
    const moved = new Set(
      diff(compare, this.activeRevision(), this.register).map(r => r.key));
    for (const param of this.register.params) {
      const input = document.getElementById(`p_${param.key.replace(/\./g, '_')}`);
      const field = input?.closest('.field');
      if (field) field.classList.toggle('changed', moved.has(param.key));
    }
  }

  /* Computed cells refresh on every keystroke rather than waiting for
     a blur: a cross weight that lags the corner weight above it is a
     cross weight somebody reads and writes down. */
  refreshComputed(revision) {
    for (const param of this.register.params) {
      if (!param.computed) continue;
      const input = document.getElementById(`p_${param.key.replace(/\./g, '_')}`);
      if (input) input.value = this.register.format(revision?.values, param.key);
    }
  }

  /* ---------- issues ---------- */
  renderIssues(issues) {
    const box = document.getElementById('issues');
    if (!issues.length) { box.replaceChildren(); box.hidden = true; return; }
    box.hidden = false;
    const frag = document.createDocumentFragment();
    frag.append(el('h4', null,
      `${issues.length} thing${issues.length > 1 ? 's' : ''} to resolve before issue`));
    const ul = el('ul');
    for (const i of issues) {
      const li = el('li');
      if (i.run != null) {
        const link = el('button', 'link', i.message);
        link.addEventListener('click', () => {
          this.tab = 'runs';
          this.openRun = i.run;
          this.render();
        });
        li.append(link);
      } else {
        li.textContent = i.message;
      }
      ul.append(li);
    }
    frag.append(ul);
    box.replaceChildren(frag);
  }

  render(issues = []) {
    this.renderTabs();
    this.renderHeader();
    if (this.tab === 'runs') this.renderRuns();
    else this.renderSetup();
    this.renderIssues(issues);
  }
}

function newRunFor(n, setupRev) {
  return {
    n, objective: '', driver: '', setupRev, tyreSet: '', fuel_l: '', laps: '',
    change: { param: '', from: '', to: '', rationale: '' },
    multiChange: { deliberate: false, reason: '' },
    expected: '', measured: '', verdict: '', bestLap_s: '', notes: '',
  };
}

function blankish(v) {
  return v === '' || v == null ? '—' : String(v);
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
