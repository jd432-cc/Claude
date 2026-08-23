/* =============================================================
   TheRacingData — Run Plan & Setup Log
   The schema.

   One report, three documents. The shared engine holds the store,
   the validation and the DOCX export; this declares what a run
   plan is, what the arithmetic in it is, and which rules it
   refuses to break.

   The setup register is not declared here — it is data, loaded at
   boot and handed to the schema — because a car class overrides
   it and a schema that hard-coded it would need forking per car.
   ============================================================= */

import { reference } from '../../../_shared/report-engine/values.js';

const VERDICTS = ['keep', 'revert', 'inconclusive'];
const VERDICT_LABELS = {
  keep: 'keep — the change stays on the car',
  revert: 'revert — put it back',
  inconclusive: 'inconclusive — the run did not answer the question',
};

/* The register is injected rather than imported: it is data, and a
   class register replaces it wholesale. Everything the schema needs
   to know about a parameter it asks this for. */
let register = null;
export function useRegister(next) { register = next; }

const setups = r => (r.setups || []);
const runs = r => (r.runs || []);

const DERIVED = {
  reportRef: r => reference(r, 'RUNP'),

  revisionCount: r => String(setups(r).length),

  currentRev(r) {
    const active = Number(r.activeRev);
    const hit = setups(r).find(s => Number(s.rev) === active);
    return hit ? `Rev ${hit.rev}` : (setups(r).length ? `Rev ${setups(r).at(-1).rev}` : '');
  },

  runCount: r => String(runs(r).filter(x => x.objective || x.change?.param).length),

  /* Kept and reverted, counted. A weekend that changed twelve things
     and kept two is a weekend that spent ten runs learning nothing,
     and nobody adds that up unless a tool does. */
  keptCount: r => String(runs(r).filter(x => x.verdict === 'keep').length),
  revertedCount: r => String(runs(r).filter(x => x.verdict === 'revert').length),
  inconclusiveCount: r => String(runs(r).filter(x => x.verdict === 'inconclusive').length),

  bestLap(r) {
    const laps = runs(r)
      .map(x => Number(x.bestLap_s))
      .filter(n => Number.isFinite(n) && n > 0);
    return laps.length ? Math.min(...laps).toFixed(2) : '';
  },
};

export const RUN_PLAN = {
  id: 'run-plan',
  version: 1,
  templateFile: 'templates/setup-sheet-v1.0.docx',
  documents: [
    { id: 'setup-sheet', label: 'Setup sheet', templateFile: 'templates/setup-sheet-v1.0.docx',
      suffix: 'SETUP' },
    { id: 'run-plan', label: 'Run plan', templateFile: 'templates/run-plan-v1.0.docx',
      suffix: 'RUNS' },
    { id: 'setup-diff', label: 'Setup diff', templateFile: 'templates/setup-diff-v1.0.docx',
      suffix: 'DIFF' },
  ],
  title: 'Run Plan & Setup Log',
  subtitle: '',
  menuLabel: 'Run plan and setup log',
  refCode: 'RUNP',
  derived: DERIVED,

  /* Everything the payload hook adds, so the template validator can
     tell a tag it does not recognise from one the schema supplies. */
  provides: [
    'setupGroups', 'setupGroups.', 'runRows', 'runRows.',
    'diffRows', 'diffRows.', 'derivedRows', 'derivedRows.',
    'reconRows', 'reconRows.', 'compare.', 'doc.',
    'rev', 'revNote', 'revBasedOn', 'revTimestamp',
  ],

  sections: [
    {
      id: 'car', n: '0', title: 'Car and event',
      blurb: 'Identifies the sheet. Every revision below belongs to this car.',
      fields: [
        { k: 'car.name', label: 'Car' },
        { k: 'car.class', label: 'Class' },
        { k: 'car.chassisNo', label: 'Chassis number' },
        { k: 'event.name', label: 'Event' },
        { k: 'event.venue', label: 'Venue' },
        { k: 'event.date', label: 'Date(s)', placeholder: 'dd.mm.yyyy' },
        { k: 'event.sessionRef', label: 'Session' },
        { k: 'engineer', label: 'Engineer' },
        { k: 'round', label: 'Round code', placeholder: 'R04' },
        { k: 'venueCode', label: 'Venue code', placeholder: 'SIL' },
        { k: 'carCode', label: 'Car code', placeholder: '11' },
        { k: 'reportRef', label: 'Reference', computed: 'reportRef' },
        { k: 'currentRev', label: 'Current revision', computed: 'currentRev' },
        { k: 'revisionCount', label: 'Revisions', computed: 'revisionCount' },
        { k: 'runCount', label: 'Runs', computed: 'runCount' },
        { k: 'keptCount', label: 'Kept', computed: 'keptCount' },
        { k: 'revertedCount', label: 'Reverted', computed: 'revertedCount' },
        { k: 'inconclusiveCount', label: 'Inconclusive', computed: 'inconclusiveCount' },
        { k: 'bestLap', label: 'Best lap of the session', computed: 'bestLap' },
      ],
    },
  ],

  /* ---------- doctrine ----------

     A finding without evidence is not a finding. The report engine
     enforces the generic rules; the ones that are specific to a run
     plan are here, in the same place the PEER puts its reconciliation
     rules. */
  issues(report) {
    const out = [];
    if (!register) return out;

    for (const run of runs(report)) {
      const named = `Run ${run.n ?? '?'}`;

      // A verdict is a claim. A claim with nothing measured behind it
      // is the thing this tool exists to stop.
      if ((run.verdict === 'keep' || run.verdict === 'revert')
          && !String(run.measured ?? '').trim()) {
        out.push({
          section: 'car', run: run.n,
          message: `${named}: a verdict of "${run.verdict}" needs a measured result. ` +
                   `A finding without evidence is not a finding.`,
        });
      }

      if (run.verdict && !VERDICTS.includes(run.verdict)) {
        out.push({
          section: 'car', run: run.n,
          message: `${named}: "${run.verdict}" is not one of ${VERDICTS.join(', ')}.`,
        });
      }

      // A declared change with no parameter is a rationale with
      // nothing attached to it.
      if (run.change?.to && !run.change?.param) {
        out.push({
          section: 'car', run: run.n,
          message: `${named}: a value was entered but no parameter was chosen for it.`,
        });
      }

      if (run.change?.param && !String(run.change.rationale ?? '').trim()) {
        out.push({
          section: 'car', run: run.n,
          message: `${named}: the change has no rationale. Why it was tried is the ` +
                   `only part of a run that is still useful next season.`,
        });
      }
    }

    // A run has to be run on a revision that exists.
    const revs = new Set(setups(report).map(s => Number(s.rev)));
    for (const run of runs(report)) {
      if (run.setupRev !== '' && run.setupRev != null && !revs.has(Number(run.setupRev))) {
        out.push({
          section: 'car', run: run.n,
          message: `Run ${run.n ?? '?'}: setup revision ${run.setupRev} does not exist.`,
        });
      }
    }

    return out;
  },

  /* ---------- payload ----------

     Three documents over one report. Which one is being built comes
     in on `options.document`, and each gets only the blocks it
     prints — a diff table in the setup sheet would print empty rows
     and a run table in the diff would print the wrong story. */
  payload(report, p, options = {}) {
    if (!register) return;
    const doc = options.document || 'setup-sheet';
    p.doc = { id: doc, label: this.documents.find(d => d.id === doc)?.label || '' };

    const active = revision(report, report.activeRev) || setups(report).at(-1) || null;

    if (doc === 'setup-sheet') {
      p.setupGroups = register.groups.map(group => ({
        group,
        params: register.inGroup(group).map(param => ({
          label: param.label,
          unit: param.unit || '',
          value: register.format(active?.values, param.key),
          // A derived figure is marked in the document as well as in
          // the form, so a printed sheet cannot be transcribed back
          // into a form as if it were an entry.
          derived: param.computed ? 'computed' : '',
        })),
      }));
      p.rev = active ? String(active.rev) : '';
      p.revNote = active?.note || '';
      p.revBasedOn = active?.basedOnRev == null ? '' : String(active.basedOnRev);
      p.revTimestamp = active?.timestamp || '';
    }

    if (doc === 'run-plan') {
      p.runRows = runs(report)
        .filter(r => r.objective || r.change?.param || r.measured)
        .map(r => ({
          n: String(r.n ?? ''),
          objective: r.objective || '',
          driver: r.driver || '',
          setupRev: r.setupRev == null ? '' : String(r.setupRev),
          tyreSet: r.tyreSet || '',
          fuel: r.fuel_l == null ? '' : String(r.fuel_l),
          laps: r.laps == null ? '' : String(r.laps),
          change: changeText(r),
          rationale: r.change?.rationale || '',
          expected: r.expected || '',
          measured: r.measured || '',
          verdict: r.verdict ? VERDICT_LABELS[r.verdict] || r.verdict : '',
          bestLap: r.bestLap_s == null ? '' : String(r.bestLap_s),
          notes: r.notes || '',
          multiChange: r.multiChange?.deliberate
            ? `Deliberate multi-change: ${r.multiChange.reason || ''}` : '',
        }));
    }

    if (doc === 'setup-diff') {
      const a = revision(report, report.compareRev);
      const b = active;
      p.compare = {
        a: a ? String(a.rev) : '', b: b ? String(b.rev) : '',
        aNote: a?.note || '', bNote: b?.note || '',
      };
      p.diffRows = (report._diff || []).map(row => ({
        group: row.group, label: row.label, unit: row.unit || '',
        from: row.from == null ? '' : String(row.from),
        to: row.to == null ? '' : String(row.to),
        delta: row.numeric ? signed(row.delta) : '',
        deltaPct: row.deltaPct == null ? '' : `${signed(row.deltaPct, 1)}%`,
      }));
      p.derivedRows = (report._derivedDiff || []).map(row => ({
        group: row.group, label: row.label, unit: row.unit || '',
        from: row.from, to: row.to,
      }));
      p.reconRows = (report._reconciliation || []).map(row => ({
        run: String(row.run ?? ''),
        declared: row.declared || '—',
        undeclared: row.undeclared || '—',
        notApplied: row.notApplied || '—',
        verdict: row.verdict || '',
      }));
    }
  },
};

function revision(report, rev) {
  return (report.setups || []).find(s => Number(s.rev) === Number(rev)) || null;
}

function changeText(run) {
  if (!run.change?.param || !register) return '';
  const label = register.byKey(run.change.param)?.label || run.change.param;
  const unit = register.byKey(run.change.param)?.unit || '';
  const from = run.change.from === '' || run.change.from == null ? 'blank' : run.change.from;
  const to = run.change.to === '' || run.change.to == null ? 'blank' : run.change.to;
  return `${label}: ${from} → ${to}${unit ? ` ${unit}` : ''}`;
}

function signed(n, dp = 2) {
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : ''}${n.toFixed(dp)}`;
}

export { VERDICTS, VERDICT_LABELS };
