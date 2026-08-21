#!/usr/bin/env python3
"""
Tag "PSDR v1.1 TEMPLATE.docx" into "psdr-circuit-v1.2.docx".

Word splits a typed tag across runs the moment you touch it, which silently
breaks templating. Doing this in code instead means the tags always land in a
single run, and the whole pass is reproducible: re-run it against a new
revision of the blank form and you get the tagged version back.

Tag syntax is docx-templates with cmdDelimiter ['{','}'].
  {name}                     insert a value
  {FOR x IN xs} ... {END-FOR x}   repeat a table row
  {IF showGuidance} / {END-IF}    keep or drop the italic guidance lines
"""
import copy
import shutil
import sys
import zipfile
from pathlib import Path

from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
QN = lambda t: f'{{{W}}}{t}'


# --------------------------------------------------------------------------
# Low-level paragraph / run helpers
# --------------------------------------------------------------------------

def para_text(p):
    return ''.join(t.text or '' for t in p.iter(QN('t')))


def new_run(p, text):
    """Build a run carrying the paragraph mark's run properties.

    That is what Word itself applies to text typed into an empty paragraph,
    so an inserted tag inherits the cell's intended body formatting rather
    than the document default.
    """
    r = etree.SubElement(p, QN('r'))
    pPr = p.find(QN('pPr'))
    if pPr is not None:
        rPr = pPr.find(QN('rPr'))
        if rPr is not None:
            r.append(copy.deepcopy(rPr))
    t = etree.SubElement(r, QN('t'))
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = text
    return r


def replace_in_para(p, needle, replacement):
    """Replace `needle` in a paragraph even when it spans several runs.

    The replacement is written whole into the run holding the first matched
    character; the remainder of the match is blanked from the following runs.
    That keeps the tag in one run, which is what the template engine needs.
    """
    ts = list(p.iter(QN('t')))
    full = ''.join(t.text or '' for t in ts)
    idx = full.find(needle)
    if idx < 0:
        return False

    end = idx + len(needle)
    pos = 0
    for t in ts:
        txt = t.text or ''
        start, stop = pos, pos + len(txt)
        pos = stop
        if stop <= idx or start >= end:
            continue
        lo, hi = max(idx, start) - start, min(end, stop) - start
        head, tail = txt[:lo], txt[hi:]
        if start <= idx < stop:          # run holding the start of the match
            t.text = head + replacement + tail
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        else:                            # continuation runs
            t.text = head + tail
    return True


def set_cell(tc, text, append=False):
    """Put `text` into a table cell, replacing its contents unless appending."""
    ps = tc.findall(QN('p'))
    p = ps[0]
    if not append:
        for r in p.findall(QN('r')):
            p.remove(r)
    new_run(p, text)


def cell_replace(tc, needle, replacement):
    for p in tc.findall(QN('p')):
        if replace_in_para(p, needle, replacement):
            return True
    return False


def add_para(tc, text):
    """Append a paragraph to a cell, copying the last paragraph's properties."""
    ps = tc.findall(QN('p'))
    src = ps[-1]
    p = copy.deepcopy(src)
    for r in p.findall(QN('r')):
        p.remove(r)
    src.addnext(p)
    new_run(p, text)
    return p


SECTION_HEADING = __import__('re').compile(r'^\s*\d+\s*[-\u2013]')


def italic_run_count(p):
    n = 0
    for r in p.findall(QN('r')):
        rPr = r.find(QN('rPr'))
        if rPr is not None and rPr.find(QN('i')) is not None:
            n += 1
    return n


def is_guidance(p):
    """A guidance line is a long body paragraph that is not a section heading.

    The form states that italic lines are guidance, but only two of the five
    are actually italicised. Keying off italics alone would leave the other
    three in every issued report, so length and shape decide instead, and
    `italicise` below brings the stragglers into line with the stated rule.
    """
    txt = para_text(p).strip()
    if len(txt) < 60 or SECTION_HEADING.match(txt):
        return False
    return True


def italicise(p):
    """Mark every run in a paragraph italic, matching the form's convention."""
    changed = False
    for r in p.findall(QN('r')):
        rPr = r.find(QN('rPr'))
        if rPr is None:
            rPr = etree.Element(QN('rPr'))
            r.insert(0, rPr)
        if rPr.find(QN('i')) is None:
            etree.SubElement(rPr, QN('i'))
            changed = True
    return changed


# --------------------------------------------------------------------------
# Structural helpers
# --------------------------------------------------------------------------

def tables(body):
    return [el for el in body if etree.QName(el).localname == 'tbl']


def rows(tbl):
    return tbl.findall(QN('tr'))


def cells(tr):
    return tr.findall(QN('tc'))


def cell(tbl, ri, ci):
    return cells(rows(tbl)[ri])[ci]


def prepend_run(p, text):
    r = new_run(p, text)
    runs = p.findall(QN('r'))
    if runs[0] is not r:
        p.remove(r)
        runs[0].addprevious(r)
    return r


def open_row_loop(tbl, first_row, last_row):
    """Reduce a block of fixed rows to a body row plus a terminator row.

    docx-templates repeats everything between FOR and END-FOR. Both tags in
    one row repeats that row's *cells*, giving one very wide row. Putting
    FOR in the body row itself still leaks the cell it sits in as a stray
    leading cell on every iteration.

    So each command gets a row of its own: a FOR carrier, the body row, and
    an END-FOR carrier. A row holding nothing but a command is dropped by
    the engine, so neither carrier reaches the finished document and only
    the body row repeats.

    Loop tags are not written here: filling a cell clears its runs, which
    would wipe a tag written too early. Call close_row_loop last.
    """
    rs = rows(tbl)
    for_row, body_row, term_row = rs[first_row:first_row + 3]
    for tr in rs[first_row + 3:last_row + 1]:
        tbl.remove(tr)
    for tc in cells(for_row) + cells(term_row):
        set_cell(tc, '')
    return for_row, body_row, term_row


def close_row_loop(for_row, term_row, var, collection):
    set_cell(cells(for_row)[0], f'{{FOR {var} IN {collection}}}')
    set_cell(cells(term_row)[0], f'{{END-FOR {var}}}')


def wrap_guidance(body):
    """Bracket every italic guidance paragraph with IF / END-IF.

    The command-only paragraphs are removed by the engine, so a RELEASE build
    drops the guidance entirely instead of relying on someone to delete it.
    """
    count = normalised = 0
    for p in list(body):
        if etree.QName(p).localname != 'p' or not is_guidance(p):
            continue
        if italic_run_count(p) == 0 and italicise(p):
            normalised += 1
        before = copy.deepcopy(p)
        for r in before.findall(QN('r')):
            before.remove(r)
        after = copy.deepcopy(before)
        p.addprevious(before)
        new_run(before, '{IF showGuidance}')
        p.addnext(after)
        new_run(after, '{END-IF}')
        count += 1
    return count, normalised


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
            import re as _re
            runs = [t for t in p.iter(QN('t'))]
            joined = ''.join(t.text or '' for t in runs)
            spans = list(_re.finditer(r'_{4,}', joined))
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


# --------------------------------------------------------------------------

def main(src, dst):
    shutil.copy(src, dst)
    zin = zipfile.ZipFile(src)
    doc = zin.read('word/document.xml')
    root = etree.fromstring(doc)
    body = root.find(QN('body'))

    log = tag(body)

    out = etree.tostring(root, xml_declaration=True,
                         encoding='UTF-8', standalone=True)

    # Rewrite the package, swapping in the tagged document part.
    tmp = Path(str(dst) + '.tmp')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = out if item.filename == 'word/document.xml' else zin.read(item.filename)
            zout.writestr(item, data)
    tmp.replace(dst)

    for line in log:
        print('  ' + line)
    print(f'\nWrote {dst}')


if __name__ == '__main__':
    main(sys.argv[1], Path(sys.argv[2]))
