#!/usr/bin/env python3
"""
Tag "PSDR v1.1 TEMPLATE.docx" into "psdr-circuit-v1.2.docx".

Re-runnable against a new revision of the blank form. The helpers live in
docx_tagging.py; everything below is the map from this form's tables to the
tag names the PSDR schema fills.

Usage:
    python3 tools/tag_psdr_circuit.py "PSDR v1.1 TEMPLATE.docx" \
        _tools/report-builder/templates/psdr-circuit-v1.2.docx
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from docx_tagging import (QN, add_para, cell, cell_replace, cells, para_text,
                          replace_in_para, retag, rows, set_cell, tables,
                          close_row_loop, open_row_loop, wrap_guidance)


# --------------------------------------------------------------------------
# The tag map
# --------------------------------------------------------------------------

def tag(body):
    log = []
    T = tables(body)

    def note(msg):
        log.append(msg)

    # -- Table 1: header block -------------------------------------------
    t1 = T[0]
    cell_replace(cell(t1, 0, 0), '[EVENT]', '{eventName}')
    cell_replace(cell(t1, 0, 0), '[SESSION]', '{sessionType}')
    header = [
        (1, 0, '[insert here]', '{eventSession}'),
        (1, 1, '[insert here]', '{circuit}'),
        (1, 2, '[dd.mm.yyyy - dd.mm.yyyy]', '{dates}'),
        (2, 0, '[insert here]', '{seriesClass}'),
        (2, 1, '[insert here]', '{carNumber}'),
        (2, 2, '[name / name]', '{drivers}'),
        (3, 0, '[name here]', '{weather}'),
        (3, 1, '[insert here]', '{temps}'),
        (3, 2, '[name here]', '{engineer}'),
        (4, 0, '[insert here]', '{bestLap}'),
        (4, 1, '[insert here]', '{theoreticalBest}'),
        (4, 2, '[insert here]', '{gapToTheoretical}'),
    ]
    for ri, ci, needle, repl in header:
        if not cell_replace(cell(t1, ri, ci), needle, repl):
            note(f'MISS header [{ri},{ci}] {needle}')
    note('table 1  header block, 14 tags')

    # -- Table 2: data sources -------------------------------------------
    src = ['logger', 'sampleRate', 'channels', 'referenceLap',
           'comparisonLap', 'noise']
    for i, key in enumerate(src, start=1):
        set_cell(cell(T[1], i, 1), f'{{src.{key}}}')
        set_cell(cell(T[1], i, 2), f'{{src.{key}Checked}}')
    note('table 2  data sources, 12 tags')

    # -- Table 3: verdict -------------------------------------------------
    # The blank form gives the verdict a heading but no row to write in.
    # Add the paragraph the heading implies.
    add_para(cell(T[2], 0, 0), '{verdict}')
    note('table 3  verdict, 1 tag (added missing paragraph)')

    # -- Table 4: headline figures ---------------------------------------
    set_cell(cell(T[3], 1, 0), '{totalRecoverable}')
    set_cell(cell(T[3], 1, 1), '{projectedBest}')
    set_cell(cell(T[3], 1, 2), '{biggestOpportunity}')
    note('table 4  headline figures, 3 tags')

    # -- Table 5: lap time opportunities (row loop) ----------------------
    for_row, body_row, term_row = open_row_loop(T[4], 1, 5)
    cs = cells(body_row)
    set_cell(cs[0], '{$idx+1}')
    for ci, key in enumerate(
            ['corner', 'evidence', 'rootCause', 'gain', 'owner'], start=1):
        set_cell(cs[ci], f'{{$o.{key}}}')
    close_row_loop(for_row, term_row, 'o', 'opportunities')
    note('table 5  opportunities, row loop over `opportunities`')

    # -- Table 6: total recoverable --------------------------------------
    set_cell(cell(T[5], 0, 1), '{totalRecoverable}')
    note('table 6  total recoverable, 1 tag')

    # -- Table 7: driver feedback correlation (row loop) -----------------
    for_row, body_row, term_row = open_row_loop(T[6], 1, 6)
    cs = cells(body_row)
    for ci, key in enumerate(
            ['corner', 'words', 'balance', 'evidence', 'verdict']):
        set_cell(cs[ci], f'{{$c.{key}}}')
    close_row_loop(for_row, term_row, 'c', 'correlation')
    note('table 7  correlation, row loop over `correlation`')

    # -- Table 9: stint and consistency ----------------------------------
    stint = [
        (1, 1, 'bestLap'), (1, 3, 'window'),
        (2, 1, 'theoretical'), (2, 3, 'windowPct'),
        (3, 1, 'gap'), (3, 3, 'degradation'),
        (4, 1, 'within1pct'), (4, 3, 'errorLaps'),
    ]
    for ri, ci, key in stint:
        set_cell(cell(T[8], ri, ci), f'{{stint.{key}}}')
    note('table 9  stint metrics, 8 tags')

    # -- Table 10: consistency banding -----------------------------------
    # Static reference scale: keep every band visible and mark the one
    # achieved, rather than printing the achieved band alone.
    for ri, key in enumerate(
            ['novice', 'experienced', 'frontRunner', 'pro'], start=2):
        set_cell(cell(T[9], ri, 1), f'{{band.{key}}}', append=True)
    note('table 10 consistency banding, 4 marker tags')

    # -- Table 11: vehicle and systems check -----------------------------
    n = 0
    for tr in rows(T[10])[1:]:
        for tc in cells(tr):
            for p in tc.findall(QN('p')):
                if '\u2610' in para_text(p):
                    n += 1
                    replace_in_para(p, '\u2610', f'{{check.c{n}}}')
    note(f'table 11 systems check, {n} checkbox tags')

    # -- Table 12: faults for the mechanics ------------------------------
    add_para(cell(T[11], 0, 0), '{faults}')
    note('table 12 faults, 1 tag (added missing paragraph)')

    # -- Table 13: setup changes (row loop) ------------------------------
    for_row, body_row, term_row = open_row_loop(T[12], 1, 4)
    cs = cells(body_row)
    for ci, key in enumerate(
            ['change', 'reason', 'expected', 'measured', 'keepRevert']):
        set_cell(cs[ci], f'{{$s.{key}}}')
    close_row_loop(for_row, term_row, 's', 'setupChanges')
    note('table 13 setup changes, row loop over `setupChanges`')

    # -- Table 14: next session priorities (row loop) --------------------
    for_row, body_row, term_row = open_row_loop(T[13], 1, 3)
    cs = cells(body_row)
    set_cell(cs[0], '{$idx+1}')
    for ci, key in enumerate(['action', 'owner', 'measure'], start=1):
        set_cell(cs[ci], f'{{$p.{key}}}')
    close_row_loop(for_row, term_row, 'p', 'priorities')
    note('table 14 priorities, row loop over `priorities`')

    # -- Table 15: target for next session -------------------------------
    tc = cell(T[14], 0, 0)
    for p in tc.findall(QN('p')):
        txt = para_text(p)
        if '____' in txt:
            runs = [t for t in p.iter(QN('t'))]
            joined = ''.join(t.text or '' for t in runs)
            spans = list(re.finditer(r'_{4,}', joined))
            for needle, repl in zip(
                    [m.group(0) for m in spans],
                    ['{targetLapTime}', '{targetWindow}']):
                replace_in_para(p, needle, repl)
    note('table 15 next-session target, 2 tags')

    # -- Table 16: sign off ----------------------------------------------
    signoff = [
        (1, 1, '[name here]', '{preparedBy}'),
        (1, 3, '[RND-EVT-PSDR-CAR]', '{reportRef}'),
        (2, 1, '[location here]', '{dataArchivedTo}'),
        (2, 3, '[insert here]', '{session}'),
    ]
    for ri, ci, needle, repl in signoff:
        if not cell_replace(cell(T[15], ri, ci), needle, repl):
            note(f'MISS signoff [{ri},{ci}] {needle}')
    note('table 16 sign off, 4 tags')

    # -- Guidance ---------------------------------------------------------
    g, norm = wrap_guidance(body)
    note(f'guidance  {g} paragraphs wrapped in IF showGuidance '
         f'({norm} italicised to match the form\'s own convention)')

    return log


if __name__ == '__main__':
    retag(sys.argv[1], Path(sys.argv[2]), tag)
