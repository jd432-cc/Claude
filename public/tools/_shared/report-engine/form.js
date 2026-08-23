/* =============================================================
   TheRacingData — shared report engine
   Schema-driven form rendering.

   Everything is built from SCHEMA, which is whichever report type is
   loaded. Switching type re-renders this form against a different
   schema; there is no per-report form code to switch between.
   ============================================================= */

import { SCHEMA } from './registry.js';
import { get, set, derive, resolveField, validate, isLocked, completion } from './store.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export class Form {
  constructor(root, report, onChange) {
    this.root = root;
    this.report = report;
    this.onChange = onChange;
    this.active = SCHEMA.sections[0].id;
  }

  change() {
    this.onChange(this.report);
    this.renderRail();
    this.renderIssues();
  }

  /* ---------- section rail ---------- */
  renderRail() {
    const rail = document.getElementById('rail');
    const frag = document.createDocumentFragment();
    for (const s of SCHEMA.sections) {
      const pct = completion(this.report, s);
      const locked = isLocked(this.report, s);
      const b = el('button', 'rail-item' + (s.id === this.active ? ' active' : '') +
                              (locked ? ' locked' : ''));
      b.append(el('span', 'rail-n', s.n));
      b.append(el('span', 'rail-title', s.title));
      const dot = el('span', 'rail-dot');
      dot.style.setProperty('--fill', `${Math.round(pct * 100)}%`);
      if (locked) dot.textContent = '\u00b7';
      b.append(dot);
      b.addEventListener('click', () => { this.active = s.id; this.render(); });
      frag.append(b);
    }
    rail.replaceChildren(frag);
  }

  renderIssues() {
    const box = document.getElementById('issues');
    const issues = validate(this.report);
    if (!issues.length) { box.replaceChildren(); box.hidden = true; return; }
    box.hidden = false;
    const frag = document.createDocumentFragment();
    frag.append(el('h4', null, `${issues.length} thing${issues.length > 1 ? 's' : ''} to resolve before issue`));
    const ul = el('ul');
    for (const i of issues) {
      const li = el('li');
      const a = el('button', 'link', i.message);
      a.addEventListener('click', () => { this.active = i.section; this.render(); });
      li.append(a);
      ul.append(li);
    }
    frag.append(ul);
    box.replaceChildren(frag);
  }

  /* ---------- fields ---------- */
  field(f) {
    const wrap = el('div', 'field' + (f.type === 'textarea' ? ' wide' : ''));
    const label = el('label', null, f.label);
    const id = `f_${f.k.replace(/\./g, '_')}`;
    label.htmlFor = id;
    wrap.append(label);

    const row = el('div', 'field-row');
    let input;
    if (f.computed || f.mirror) {
      input = el('input', 'derived');
      input.readOnly = true;
      input.id = id;
      input.value = resolveField(this.report, f);
      input.title = 'Derived \u2014 change the source field instead.';
    } else if (f.type === 'textarea') {
      input = el('textarea');
      input.id = id;
      input.rows = f.rows || 3;
      input.value = get(this.report, f.k) ?? '';
      input.addEventListener('input', () => {
        set(this.report, f.k, input.value); this.change();
      });
    } else {
      input = el('input');
      input.id = id;
      input.inputMode = f.numeric ? 'decimal' : 'text';
      if (f.placeholder) input.placeholder = f.placeholder;
      input.value = get(this.report, f.k) ?? '';
      input.addEventListener('input', () => {
        set(this.report, f.k, input.value); this.change();
      });
    }
    row.append(input);

    if (f.check) {
      const cb = el('label', 'tick');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = !!get(this.report, f.check);
      box.addEventListener('change', () => {
        set(this.report, f.check, box.checked); this.change(); this.render();
      });
      cb.append(box, el('span', null, 'Checked'));
      row.append(cb);
    }
    wrap.append(row);
    if (f.hint) wrap.append(el('p', 'hint', f.hint));
    return wrap;
  }

  /* ---------- repeating table ---------- */
  table(section) {
    const t = section.table;
    const wrap = el('div', 'table-wrap');
    const rows = this.report[t.key];

    const head = el('div', 'trow thead');
    head.append(el('div', 'tcell tnum', '#'));
    for (const c of t.columns) {
      const d = el('div', 'tcell', c.label);
      d.style.flex = `${c.w} 1 0`;
      head.append(d);
    }
    head.append(el('div', 'tcell tdel'));
    wrap.append(head);

    rows.forEach((row, i) => {
      const tr = el('div', 'trow');
      tr.append(el('div', 'tcell tnum', String(i + 1)));
      for (const c of t.columns) {
        const cell = el('div', 'tcell');
        cell.style.flex = `${c.w} 1 0`;
        let input;
        if (c.options) {
          input = el('select');
          input.append(new Option('\u2014', ''));
          for (const o of c.options) {
            input.append(new Option(c.optionLabels?.[o] || o, o));
          }
          input.value = row[c.k] ?? '';
        } else {
          input = el('input');
          input.inputMode = c.numeric ? 'decimal' : 'text';
          input.value = row[c.k] ?? '';
        }
        const hasContent = t.columns.some(x => String(row[x.k] ?? '').trim() !== '');
        if (c.required && hasContent && !String(row[c.k] ?? '').trim()) {
          input.classList.add('missing');
          input.title = c.requiredMsg || '';
        }
        input.addEventListener('input', () => {
          row[c.k] = input.value; this.change();
        });
        input.addEventListener('change', () => {
          row[c.k] = input.value; this.change(); this.render();
        });
        cell.append(input);
        tr.append(cell);
      }
      const del = el('div', 'tcell tdel');
      const x = el('button', 'icon', '\u00d7');
      x.title = 'Remove row';
      x.addEventListener('click', () => {
        rows.splice(i, 1); this.change(); this.render();
      });
      del.append(x);
      tr.append(del);
      wrap.append(tr);
    });

    const add = el('button', 'add', `+ ${t.addLabel}`);
    if (t.max && rows.length >= t.max) {
      add.disabled = true;
      add.textContent = `${t.addLabel} \u2014 limit ${t.max}`;
      add.title = 'The form caps this section deliberately.';
    }
    add.addEventListener('click', () => {
      rows.push(Object.fromEntries(t.columns.map(c => [c.k, ''])));
      this.change(); this.render();
    });
    wrap.append(add);
    return wrap;
  }

  /* ---------- fixed grid ----------
     A matrix whose rows are the document's own: they cannot be added or
     removed, only filled. */
  fixedTable(section) {
    const g = section.fixed;
    const wrap = el('div', 'table-wrap');
    // The totals row sits in the same table as the cells it sums, so it
    // refreshes on every keystroke rather than waiting for a blur.
    const totalCells = [];
    const refresh = () => {
      for (const { input, row, col } of totalCells) {
        input.value = derive(this.report, row.derive)[col.k] ?? '';
      }
    };

    const head = el('div', 'trow thead');
    const lead = el('div', 'tcell', g.label || '');
    lead.style.flex = `${g.labelWidth || 22} 1 0`;
    head.append(lead);
    for (const c of g.columns) {
      const d = el('div', 'tcell', c.label);
      d.style.flex = `${c.w} 1 0`;
      head.append(d);
    }
    wrap.append(head);

    for (const row of g.rows) {
      const tr = el('div', 'trow');
      const label = el('div', 'tcell tlabel', row.label);
      label.style.flex = `${g.labelWidth || 22} 1 0`;
      tr.append(label);
      const totals = row.derive ? derive(this.report, row.derive) : null;
      for (const c of g.columns) {
        const cell = el('div', 'tcell');
        cell.style.flex = `${c.w} 1 0`;
        const at = `${g.key}.${row.k}.${c.k}`;
        let input;
        if (totals) {
          input = el('input', 'derived');
          input.readOnly = true;
          input.value = totals[c.k] ?? '';
          input.title = 'Derived from the rows above.';
          totalCells.push({ input, row, col: c });
        } else if (c.options) {
          input = el('select');
          input.append(new Option('\u2014', ''));
          for (const o of c.options) input.append(new Option(c.optionLabels?.[o] || o, o));
          input.value = get(this.report, at) ?? '';
        } else {
          input = el('input');
          input.inputMode = c.numeric ? 'decimal' : 'text';
          if (c.placeholder) input.placeholder = c.placeholder;
          input.value = get(this.report, at) ?? '';
        }
        if (!totals) {
          input.addEventListener('input', () => {
            set(this.report, at, input.value); refresh(); this.change();
          });
          input.addEventListener('change', () => {
            set(this.report, at, input.value); refresh(); this.change();
          });
        }
        cell.append(input);
        tr.append(cell);
      }
      wrap.append(tr);
    }
    return wrap;
  }

  checkgrid(section) {
    const wrap = el('div', 'checkgrid');
    const cg = section.checkgrid;
    cg.items.forEach((label, i) => {
      // The form groups its boxes under headings; the tags do not care.
      const heading = cg.groups?.[i + 1];
      if (heading) wrap.append(el('h4', 'checkgroup', heading));
      const key = `${cg.key}.c${i + 1}`;
      const item = el('label', 'checkitem');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = !!get(this.report, key);
      box.addEventListener('change', () => {
        set(this.report, key, box.checked); this.change();
      });
      item.append(box, el('span', null, `${i + 1}.  ${label}`));
      wrap.append(item);
    });
    return wrap;
  }

  /* ---------- main ---------- */
  render() {
    // Section ids are per-schema: after a report swap the previously
    // active one may not exist here.
    const section = SCHEMA.sections.find(s => s.id === this.active)
                 || SCHEMA.sections[0];
    this.active = section.id;
    const pane = document.getElementById('pane');
    const frag = document.createDocumentFragment();

    const gated = isLocked(this.report, section);
    const gateSection = SCHEMA.sections.find(s => s.gate);

    const h = el('header', 'pane-head');
    h.append(el('p', 'eyebrow', `Section ${section.n}`));
    h.append(el('h2', null, section.title));
    if (section.blurb) h.append(el('p', 'blurb', section.blurb));
    frag.append(h);

    if (gated) {
      const lock = el('div', 'lock');
      lock.append(el('p', null, gateSection.gate.lockMessage || gateSection.gate.message));
      const go = el('button', 'add', `Go to section ${gateSection.n}`);
      go.addEventListener('click', () => { this.active = gateSection.id; this.render(); });
      lock.append(go);
      frag.append(lock);
      pane.replaceChildren(frag);
      this.renderRail(); this.renderIssues();
      return;
    }

    if (section.fields) {
      const grid = el('div', 'grid');
      for (const f of section.fields) grid.append(this.field(f));
      frag.append(grid);
    }
    if (section.fixed) frag.append(this.fixedTable(section));
    if (section.checkgrid) frag.append(this.checkgrid(section));
    if (section.table) frag.append(this.table(section));

    pane.replaceChildren(frag);
    this.renderRail();
    this.renderIssues();
  }
}
