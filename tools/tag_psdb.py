#!/usr/bin/env python3
"""
Tag "PSDB TEMPLATE v1.0.docx" into "psdb-v1.0.docx".

The debrief sheet is a printed form: the driver's balance is circled on a
scale, not written down. So the scale still prints in full and the chosen
token is emboldened in place — the payload splits the scale into the part
before the token, the token, and the part after, and the template carries
the emphasis on the middle run.

The seventeen corner blocks collapse to one, repeated by a row loop. An
unfilled sheet still prints seventeen blank blocks, because taking it to
the halt and circling it is what this form is for.

Usage:
    python3 tools/tag_psdb.py "PSDB TEMPLATE v1.0.docx" \
        _tools/report-builder/templates/psdb-v1.0.docx
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from docx_tagging import (QN, add_para, carrier_row, cell, cell_replace, cells,
                          close_row_loop, drop_tables, new_run, para_text,
                          replace_in_para, replace_with_runs, retag, rows,
                          set_cell, set_cell_runs, tables, wrap_guidance)

# The four phase rows of a corner block, in the order the form prints them.
PHASES = ['braking', 'entry', 'mid', 'exit']

# Header cells: the label is the cell, the value goes underneath it.
HEADER = [
    (0, 0, 'date'), (0, 1, 'event'), (0, 2, 'session'),
    (1, 0, 'driver'), (1, 1, 'carNumber'), (1, 2, 'engineer'),
    (2, 0, 'weather'), (2, 1, 'temps'), (2, 2, 'tyres'),
    (3, 0, 'outTime'), (3, 1, 'inTimeBest'), (3, 2, 'fuel'),
]


def is_guidance(p):
    """This form keeps its instructions inside tables, where they are part of
    the sheet. The only guidance line at body level is the one telling you
    how to fill the corner blocks in."""
    txt = para_text(p).strip()
    return len(txt) >= 20 and not re.match(r'^\s*\d+\s*[-–]', txt)


def tag(body):
    log = []
    T = tables(body)

    # -- Table 1: title --------------------------------------------------
    if not cell_replace(cell(T[0], 0, 0), '[TRACK]', '{circuit}'):
        log.append('MISS title [TRACK]')
    log.append('table 1  title, 1 tag')

    # -- Table 2: session header -----------------------------------------
    # Each cell holds its label and nothing else; the value goes into a
    # paragraph added beneath it, the way the printed sheet is written on.
    for ri, ci, key in HEADER:
        add_para(cell(T[1], ri, ci), '{%s}' % key)
    log.append(f'table 2  session header, {len(HEADER)} tags')

    # -- Table 4: the one thing to improve, and the focus boxes ----------
    # The heading is followed by two empty paragraphs to write the answer
    # into. The first of them takes the tag.
    improve = cell(T[3], 0, 0).findall(QN('p'))[1]
    for r in improve.findall(QN('r')):
        improve.remove(r)
    new_run(improve, '{improve}')

    n = 0
    for ci in (0, 1):
        tc = cell(T[3], 2, ci)
        for p in tc.findall(QN('p')):
            if '☐' in para_text(p):
                n += 1
                replace_in_para(p, '☐', f'{{focus.c{n}}}')
    log.append(f'table 4  improvement note plus {n} focus boxes')

    # -- Table 5: notes ---------------------------------------------------
    add_para(cell(T[4], 0, 0), '{notes}')
    log.append('table 5  notes, 1 tag')

    # -- Table 8: the corner block, repeated ------------------------------
    # r0 is the column header and stays put. r1 is the corner header and
    # r2..r5 the four phases; those five rows become the loop body.
    block = T[7]
    rs = rows(block)
    head_row, phase_rows = rs[1], rs[2:6]

    # Corner header: three fill-in rules and a confidence scale to circle.
    p = head_row.find(f'{QN("tc")}/{QN("p")}')
    joined = para_text(p)
    for needle, repl in zip([m.group(0) for m in re.finditer(r'_{4,}', joined)],
                            ['{$k.number}', '{$k.name}', '{$k.gear}']):
        replace_in_para(p, needle, repl)
    conf = re.search(r'1\s+2\s+3\s+4\s+5', para_text(p))
    replace_with_runs(p, conf.group(0), [
        ('{$k.conf.pre}', False), ('{$k.conf.pick}', True), ('{$k.conf.post}', False)])
    log.append('table 8  corner header, 3 tags plus a confidence scale')

    # Phase rows: the balance scale prints whole with one token emboldened.
    scale = para_text(cells(phase_rows[0])[1].findall(QN('p'))[0])
    for phase, tr in zip(PHASES, phase_rows):
        cs = cells(tr)
        set_cell_runs(cs[1], [(f'{{$k.{phase}.pre}}', False),
                              (f'{{$k.{phase}.pick}}', True),
                              (f'{{$k.{phase}.post}}', False)])
        set_cell(cs[2], f'{{$k.{phase}.notes}}')
    log.append(f'table 8  {len(PHASES)} phase rows, scale {scale.strip()!r}')

    for_row = carrier_row(block, head_row, before=True)
    term_row = carrier_row(block, phase_rows[-1], before=False)
    close_row_loop(for_row, term_row, 'k', 'cornerBlocks')
    log.append('table 8  row loop over `cornerBlocks`')

    # -- Tables 9-24: the other sixteen printed blocks --------------------
    dropped = drop_tables(body, T[8:])
    log.append(f'tables 9-24  {dropped} repeated blocks removed; the loop '
               f'reproduces them')

    # -- Guidance ---------------------------------------------------------
    g, norm = wrap_guidance(body, is_guidance)
    log.append(f'guidance  {g} paragraph(s) wrapped in IF showGuidance '
               f'({norm} italicised)')

    return log


if __name__ == '__main__':
    retag(sys.argv[1], Path(sys.argv[2]), tag)
