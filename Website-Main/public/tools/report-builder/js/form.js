/* =============================================================
   TheRacingData — Report Builder
   Schema-driven form rendering.

   Everything is built from SCHEMA, so the other five report types
   need a schema and no new form code.
   ============================================================= */

import { SCHEMA, SYSTEMS_CHECK } from './schema.js';
import { get, set, resolveField, validate, isGated, completion } from './store.js';

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
    rail.replaceChildren();
    const gated = isGated(this.report);
    for (const s of SCHEMA.sections) {
      const pct = completion(this.report, s);
      const locked = gated && !['event', 'sources'].includes(s.id);
      const b = el('button', 'rail-item' + (s.id === this.active ? ' active' : '') +
                              (locked ? ' locked' : ''));
      b.append(el('span', 'rail-n', s.n));
      b.append(el('span', 'rail-title', s.title));
      const dot = el('span', 'rail-dot');
      dot.style.setProperty('--fill', `${Math.round(pct * 100)}%`);
      if (locked) dot.textContent = '\u00b7';
      b.append(dot);
      b.addEventListener('click', () => { this.active = s.id; this.render(); });
      rail.append(b);
    }
  }

  renderIssues() {
    const box = document.getElementById('issues');
    const issues = validate(this.report);
    box.replaceChildren();
    if (!issues.length) { box.hidden = true; return; }
    box.hidden = false;
    box.append(el('h4', null, `${issues.length} thing${issues.length > 1 ? 's' : ''} to resolve before issue`));
    const ul = el('ul');
    for (const i of issues) {
      const li = el('li');
      const a = el('button', 'link', i.message);
      a.addEventListener('click', () => { this.active = i.section; this.render(); });
      li.append(a);
      ul.append(li);
    }
    box.append(ul);
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

  checkgrid(section) {
    const wrap = el('div', 'checkgrid');
    SYSTEMS_CHECK.forEach((label, i) => {
      const key = `check.c${i + 1}`;
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
    const section = SCHEMA.sections.find(s => s.id === this.active);
    const pane = document.getElementById('pane');
    pane.replaceChildren();

    const gated = isGated(this.report) && !['event', 'sources'].includes(section.id);

    const h = el('header', 'pane-head');
    h.append(el('p', 'eyebrow', `Section ${section.n}`));
    h.append(el('h2', null, section.title));
    if (section.blurb) h.append(el('p', 'blurb', section.blurb));
    pane.append(h);

    if (gated) {
      const lock = el('div', 'lock');
      lock.append(el('p', null,
        'Section 1 has not confirmed a clean reference lap. A bad reference makes every number below it wrong, so this section stays closed until it is.'));
      const go = el('button', 'add', 'Go to section 1');
      go.addEventListener('click', () => { this.active = 'sources'; this.render(); });
      lock.append(go);
      pane.append(lock);
      this.renderRail(); this.renderIssues();
      return;
    }

    if (section.fields) {
      const grid = el('div', 'grid');
      for (const f of section.fields) grid.append(this.field(f));
      pane.append(grid);
    }
    if (section.checkgrid) pane.append(this.checkgrid(section));
    if (section.table) pane.append(this.table(section));

    this.renderRail();
    this.renderIssues();
  }
}
