#!/usr/bin/env python3
"""
Shared docx tagging helpers.

Word splits a typed tag across runs the moment you touch it, which
silently breaks templating: {bestLap} becomes {best + Lap} across two
runs, the export still succeeds, and the field comes out blank. Doing
the whole pass in code means the tags always land in a single run, and
re-running against a new revision of a blank form gives the tagged
version back.

Every tagger in this directory is the same two things: a map from the
blank form's tables to tag names, and a call to `retag`. Nothing in
here knows about any particular report.

Tag syntax is docx-templates with cmdDelimiter ['{','}'].
  {name}                          insert a value
  {FOR x IN xs} ... {END-FOR x}   repeat a table row
  {IF showGuidance} / {END-IF}    keep or drop the italic guidance lines
"""
import copy
import re
import shutil
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


def new_run(p, text, bold=False):
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
    if bold:
        embolden(r)
    t = etree.SubElement(r, QN('t'))
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = text
    return r


def embolden(r):
    """Mark one run bold, in place."""
    rPr = r.find(QN('rPr'))
    if rPr is None:
        rPr = etree.Element(QN('rPr'))
        r.insert(0, rPr)
    if rPr.find(QN('b')) is None:
        etree.SubElement(rPr, QN('b'))
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


# A private-use code point: legal in XML, and not something a form
# would ever contain.
MARKER = '\ue000'


def run_like(src, text, bold=False):
    """A run with `src`'s formatting and new text."""
    r = etree.Element(QN('r'))
    rPr = src.find(QN('rPr'))
    if rPr is not None:
        r.append(copy.deepcopy(rPr))
    if bold:
        embolden(r)
    t = etree.SubElement(r, QN('t'))
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = text
    return r


def replace_with_runs(p, needle, parts):
    """Replace `needle` with a sequence of (text, bold) runs.

    Emphasis cannot come from the data: the engine substitutes text, not
    formatting. So the template carries the emphasis and the value is split
    to match — a plain run, a bold run, a plain run — and whichever token the
    payload puts in the middle is the one that comes out bold.
    """
    if not replace_in_para(p, needle, MARKER):
        return False
    for r in list(p.findall(QN('r'))):
        for t in r.findall(QN('t')):
            if not t.text or MARKER not in t.text:
                continue
            head, tail = t.text.split(MARKER, 1)
            t.text = head
            at = r
            for text, bold in parts:
                nr = run_like(r, text, bold)
                at.addnext(nr)
                at = nr
            if tail:
                nr = run_like(r, tail)
                at.addnext(nr)
            return True
    return False


def set_cell_runs(tc, parts):
    """Replace a cell's first paragraph with a sequence of (text, bold) runs."""
    p = tc.findall(QN('p'))[0]
    for r in p.findall(QN('r')):
        p.remove(r)
    for text, bold in parts:
        new_run(p, text, bold)
    return p


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


SECTION_HEADING = re.compile(r'^\s*\d+\s*[-\u2013]')


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


def carrier_row(tbl, ref, before=True):
    """Add an empty row modelled on `ref`, to carry a loop command.

    A row holding nothing but a command is dropped by the engine, so the
    carrier never reaches the finished document. Modelling it on a real row
    keeps the table's grid consistent in the meantime.
    """
    row = copy.deepcopy(ref)
    for tc in cells(row):
        set_cell(tc, '')
    (ref.addprevious if before else ref.addnext)(row)
    return row


def drop_tables(body, victims):
    """Remove whole tables from the body."""
    for t in victims:
        body.remove(t)
    return len(victims)


def close_row_loop(for_row, term_row, var, collection):
    set_cell(cells(for_row)[0], f'{{FOR {var} IN {collection}}}')
    set_cell(cells(term_row)[0], f'{{END-FOR {var}}}')


def bracket(p, condition='showGuidance'):
    """Put IF / END-IF paragraphs either side of `p`.

    A paragraph holding nothing but a command is removed by the engine, so
    a RELEASE build drops what is bracketed instead of relying on someone
    to delete it.
    """
    before = copy.deepcopy(p)
    for r in before.findall(QN('r')):
        before.remove(r)
    after = copy.deepcopy(before)
    p.addprevious(before)
    new_run(before, '{IF %s}' % condition)
    p.addnext(after)
    new_run(after, '{END-IF}')
    return p


def loop_rows(tbl, first, last, var, collection):
    """Reduce rows[first..last] to one repeating body row.

    The command rows are added rather than taken from the block, so a table
    whose rows are not all part of the loop keeps the rest of them.
    """
    rs = rows(tbl)
    body = rs[first]
    for tr in rs[first + 1:last + 1]:
        tbl.remove(tr)
    for_row = carrier_row(tbl, body, before=True)
    term_row = carrier_row(tbl, body, before=False)
    return for_row, body, term_row


def wrap_guidance(body, predicate=None):
    """Bracket every guidance paragraph with IF / END-IF.

    The command-only paragraphs are removed by the engine, so a RELEASE build
    drops the guidance entirely instead of relying on someone to delete it.

    `predicate` decides what counts as guidance. The default reads the PSDR
    form's shape; a form that marks its guidance differently passes its own.
    """
    predicate = predicate or is_guidance
    count = normalised = 0
    for p in list(body):
        if etree.QName(p).localname != 'p' or not predicate(p):
            continue
        if italic_run_count(p) == 0 and italicise(p):
            normalised += 1
        bracket(p)
        count += 1
    return count, normalised


# --------------------------------------------------------------------------
# Package rewrite
# --------------------------------------------------------------------------

def retag(src, dst, tag_fn):
    """Run `tag_fn` over the document body and write the tagged package.

    Everything but word/document.xml is copied through untouched, so styles,
    numbering, images and the section properties survive exactly as authored.
    """
    dst = Path(dst)
    shutil.copy(src, dst)
    zin = zipfile.ZipFile(src)
    root = etree.fromstring(zin.read('word/document.xml'))
    body = root.find(QN('body'))

    log = tag_fn(body)

    out = etree.tostring(root, xml_declaration=True,
                         encoding='UTF-8', standalone=True)

    tmp = Path(str(dst) + '.tmp')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = out if item.filename == 'word/document.xml' else zin.read(item.filename)
            zout.writestr(item, data)
    tmp.replace(dst)

    for line in log:
        print('  ' + line)
    print(f'\nWrote {dst}')
