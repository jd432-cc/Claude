/* =============================================================
   TheRacingData — Run Plan & Setup Log
   The diff engine. Pure functions, no DOM, importable by Node.

   Two functions and one doctrine. `diff` says what moved between
   two revisions. `reconcile` says whether what moved is what the
   run said it would move, and it is the one that earns the tool
   its place: a run that declared one change and made three has
   learned nothing, and on paper it looks exactly like a run that
   declared one change and made one.

   Both are silent failures. Both are trivial to detect once the
   two revisions are objects and someone bothers to compare them.
   ============================================================= */

/* ---------- diff ----------

   Grouped by subsystem in register order, unchanged parameters
   omitted. A numeric parameter carries a signed delta; an
   enumerated or text one carries from -> to and nothing else,
   because the difference between "Medium" and "Soft" is not a
   number and printing one would be a lie. */
export function diff(revA, revB, register) {
  const a = revA?.values || {};
  const b = revB?.values || {};
  const out = [];

  for (const param of register.entered) {
    const from = a[param.key];
    const to = b[param.key];
    const fromBlank = from === '' || from == null;
    const toBlank = to === '' || to == null;
    if (fromBlank && toBlank) continue;
    if (String(from ?? '') === String(to ?? '')) continue;

    const row = {
      key: param.key, group: param.group, label: param.label,
      unit: param.unit || '', from: fromBlank ? null : from, to: toBlank ? null : to,
      delta: null, deltaPct: null, numeric: false,
    };

    const nf = Number(from), nt = Number(to);
    if (!fromBlank && !toBlank && Number.isFinite(nf) && Number.isFinite(nt)) {
      row.numeric = true;
      row.delta = nt - nf;
      row.deltaPct = nf !== 0 ? ((nt - nf) / Math.abs(nf)) * 100 : null;
    }
    out.push(row);
  }

  out.sort((x, y) => register.order(x.key) - register.order(y.key));
  return out;
}

/* Derived parameters do not appear in a diff — they cannot be
   changed, only caused — but the sheet is read by people who want to
   know that cross weight moved. This is that list, kept apart so
   nothing confuses a consequence with a change. */
export function derivedDiff(revA, revB, register) {
  const out = [];
  for (const param of register.params) {
    if (!param.computed) continue;
    const from = register.value(revA?.values, param.key);
    const to = register.value(revB?.values, param.key);
    if (from === null && to === null) continue;
    if (String(from) === String(to)) continue;
    out.push({
      key: param.key, group: param.group, label: param.label,
      unit: param.unit || '',
      from: register.format(revA?.values, param.key),
      to: register.format(revB?.values, param.key),
    });
  }
  return out;
}

/* ---------- reconcile ----------

   What the run said it changed, against what actually moved between
   the revision it was run on and the one before it.

     declared    the run's own `change`, or null
     actual      every parameter that moved
     undeclared  moved but not declared  — the run taught you nothing
     notApplied  declared but did not move — the run was never made

   Both are common. Both are invisible on paper. */
export function reconcile(run, revA, revB, register) {
  const actual = diff(revA, revB, register);
  const declaredKey = run?.change?.param || null;
  const declared = declaredKey
    ? {
        key: declaredKey,
        label: register.byKey(declaredKey)?.label || declaredKey,
        group: register.byKey(declaredKey)?.group || '',
        from: run.change.from,
        to: run.change.to,
        rationale: run.change.rationale || '',
      }
    : null;

  const undeclared = actual.filter(row => row.key !== declaredKey);

  const notApplied = [];
  if (declared && !actual.some(row => row.key === declaredKey)) {
    notApplied.push(declared);
  }

  return { declared, actual, undeclared, notApplied };
}

/* ---------- the one-variable gate ----------

   Modelled on `section.gate` in the report engine: a condition that
   locks what comes after it until it is met, with the reason stated
   in the message rather than left to be inferred. The engine's gate
   is per report and this one is per run, so it is the pattern that
   is reused rather than the function.

   A run that moved more than one parameter is not forbidden. It is
   locked until someone ticks `deliberate` and writes down why, which
   is the difference between a scan and an accident. */
export function runGate(run, reconciliation) {
  const extra = reconciliation.undeclared;
  if (!extra.length) return { gated: false };

  const deliberate = !!run?.multiChange?.deliberate;
  const reason = String(run?.multiChange?.reason ?? '').trim();
  if (deliberate && reason) return { gated: false, acknowledged: true, extra };

  const names = extra.map(r => r.label).join(', ');
  return {
    gated: true,
    extra,
    field: 'multiChange',
    message:
      `Run ${run?.n ?? '?'} declared ${reconciliation.declared
        ? `one change (${reconciliation.declared.label})` : 'no change'} ` +
      `but ${extra.length} other parameter${extra.length > 1 ? 's' : ''} moved: ${names}. ` +
      `The result cannot be attributed to any one of them. Tick "deliberate" and ` +
      `say why, or revert the ones you did not mean to change.`,
    lockMessage:
      `The result fields are closed because more than one parameter moved on this run ` +
      `(${names}). A finding from a multi-variable run is not a finding.`,
  };
}

/* ---------- revisions ----------

   History is never rewritten. A revert is a new revision that
   restores the previous value, so the sheet still says the change
   was made and then taken back — which is a different fact from the
   change never having been made, and the one that stops it being
   tried again next event. */
export function nextRev(setups) {
  return (setups || []).reduce((a, s) => Math.max(a, Number(s.rev) || 0), 0) + 1;
}

export function createRevision(setups, { basedOnRev, note, values, timestamp }) {
  const parent = (setups || []).find(s => Number(s.rev) === Number(basedOnRev));
  return {
    rev: nextRev(setups),
    timestamp: timestamp || new Date().toISOString(),
    basedOnRev: basedOnRev ?? parent?.rev ?? null,
    note: note || '',
    values: { ...(parent?.values || {}), ...(values || {}) },
  };
}

export function revertChange(setups, run, register) {
  const applied = (setups || []).find(s => Number(s.rev) === Number(run?.setupRev));
  const parent = (setups || []).find(s => Number(s.rev) === Number(applied?.basedOnRev));
  const key = run?.change?.param;
  if (!applied || !key) return null;

  const restored = parent?.values?.[key] ?? '';
  const label = register.byKey(key)?.label || key;
  return createRevision(setups, {
    basedOnRev: applied.rev,
    note: `Revert of run ${run.n}: ${label} back to ${restored === '' ? 'blank' : restored}.`,
    values: { [key]: restored },
  });
}

export function revisionByNumber(setups, rev) {
  return (setups || []).find(s => Number(s.rev) === Number(rev)) || null;
}
