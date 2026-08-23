#!/usr/bin/env python3
"""
Build the four Event Pack Builder templates.

Same arrangement as tools/make_run_plan_templates.py: there is no
blank Word form to re-tag, so this draws the documents and tags them
in one pass, with every tag written as exactly one run.

  event-brief-v1.0.docx     the cover document: event, crew, vehicles, contacts
  timetable-card-v1.0.docx  one card per session, A5, for a pit board clip
  checklist-v1.0.docx       tick sheet, one page per list
  contact-sheet-v1.0.docx   emergency and officials, single page, large type

Usage:  python3 tools/make_event_pack_templates.py
"""
import pathlib

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm

OUT = pathlib.Path(__file__).resolve().parent.parent / '_tools/event-pack/templates'

INK = RGBColor(0x0A, 0x0A, 0x0B)
MUTED = RGBColor(0x5A, 0x5A, 0x60)
SIGNAL = RGBColor(0x97, 0x00, 0x00)
BODY = 'Archivo'


def run(paragraph, text, *, size=10, bold=False, italic=False,
        colour=INK, caps=False, spacing=None):
    r = paragraph.add_run(text)
    r.font.name = BODY
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    r.font.color.rgb = colour
    r.font.all_caps = caps
    if spacing is not None:
        el = OxmlElement('w:spacing')
        el.set(qn('w:val'), str(int(spacing * 20)))
        r._element.get_or_add_rPr().append(el)
    return r


def para(doc, text='', **kw):
    p = doc.add_paragraph()
    if text:
        run(p, text, **kw)
    return p


def eyebrow(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run(p, text, size=7.5, bold=True, colour=MUTED, caps=True, spacing=1.8)
    return p


def heading(doc, text, size=20):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    run(p, text, size=size, bold=True, colour=INK, caps=True)
    return p


def rule(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    pr = p._p.get_or_add_pPr()
    borders = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:color'), '0A0A0B')
    borders.append(bottom)
    pr.append(borders)
    return p


def guidance(doc, text):
    para(doc, '{IF showGuidance}', size=8, colour=MUTED)
    p = doc.add_paragraph()
    run(p, text, size=8.5, italic=True, colour=MUTED)
    para(doc, '{END-IF}', size=8, colour=MUTED)


def cell_text(cell, text, *, size=9, bold=False, colour=INK, caps=False, spacing=None):
    cell.text = ''
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    if text:
        run(p, text, size=size, bold=bold, colour=colour, caps=caps, spacing=spacing)


def table(doc, cols, widths=None, header=None):
    t = doc.add_table(rows=0, cols=cols)
    t.style = 'Table Grid'
    t.autofit = False
    if header:
        r = t.add_row()
        for cell, label in zip(r.cells, header):
            cell_text(cell, label, size=7.5, bold=True, colour=MUTED, caps=True, spacing=1.4)
    if widths:
        for r in t.rows:
            for cell, w in zip(r.cells, widths):
                cell.width = Cm(w)
        t._widths = widths
    return t


def row(t, values, **kw):
    r = t.add_row()
    for cell, value in zip(r.cells, values):
        cell_text(cell, value, **kw)
    widths = getattr(t, '_widths', None)
    if widths:
        for cell, w in zip(r.cells, widths):
            cell.width = Cm(w)
    return r


def carrier(t, command):
    r = t.add_row()
    cell_text(r.cells[0], command, size=8, colour=MUTED)
    for cell in r.cells[1:]:
        cell_text(cell, '')
    return r


def section(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(4)
    run(p, text, size=11, bold=True, colour=SIGNAL, caps=True, spacing=1.2)
    return p


def header_block(doc, title, pairs, size=20):
    eyebrow(doc, 'TheRacingData — Race Operations')
    heading(doc, title, size=size)
    rule(doc)
    t = table(doc, 4, widths=[3.2, 5.0, 3.2, 5.0])
    for i in range(0, len(pairs), 2):
        chunk = list(pairs[i:i + 2])
        while len(chunk) < 2:
            chunk.append(('', ''))
        row(t, [chunk[0][0], chunk[0][1], chunk[1][0], chunk[1][1]])
        for cell, bold in zip(t.rows[-1].cells, [True, False, True, False]):
            for p in cell.paragraphs:
                for r in p.runs:
                    r.bold = bold
                    if bold:
                        r.font.color.rgb = MUTED
                        r.font.size = Pt(7.5)
                        r.font.all_caps = True
    para(doc)
    return t


def base_document(width_cm=21.0, height_cm=29.7, margin=1.6):
    doc = Document()
    doc.styles['Normal'].font.name = BODY
    doc.styles['Normal'].font.size = Pt(10)
    for s in doc.sections:
        s.page_width = Cm(width_cm)
        s.page_height = Cm(height_cm)
        s.left_margin = s.right_margin = Cm(margin)
        s.top_margin = s.bottom_margin = Cm(margin)
    return doc


def footer(doc, note):
    para(doc)
    p = doc.add_paragraph()
    run(p, note, size=7.5, colour=MUTED)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT


# --------------------------------------------------------------------------

def event_brief(path):
    doc = base_document()
    header_block(doc, 'Event brief', [
        ('Event', '{event.name}'), ('Championship', '{event.championship}'),
        ('Round', '{event.round}'), ('Reference', '{reportRef}'),
        ('Venue', '{event.venue}'), ('Country', '{event.country}'),
        ('From', '{event.dateFrom}'), ('To', '{event.dateTo}'),
        ('Time zone', '{event.timezone}'), ('First call', '{firstCall}'),
        ('Sessions', '{sessionCount}'), ('Crew', '{crewCount}'),
        ('Vehicles', '{vehicleCount}'), ('Packed', '{packedTotal}'),
        ('Tyre sets', '{tyreSets}'), ('Fuel, l', '{fuelTotal}'),
    ])

    guidance(doc, 'Every time on this document is derived from the session starts '
                  'and the build-up profile. Change a session start and every call '
                  'time moves with it; nothing here is typed twice.')

    section(doc, 'Crew')
    t = table(doc, 5, widths=[4.2, 3.6, 2.8, 3.2, 4.0],
              header=['Name', 'Role', 'Arrival', 'Licence', 'Credential'])
    carrier(t, '{FOR c IN crewRows}')
    row(t, ['{$c.name}', '{$c.role}', '{$c.arrival}', '{$c.licence}', '{$c.credential}'])
    carrier(t, '{END-FOR c}')

    section(doc, 'Vehicles')
    v = table(doc, 5, widths=[2.4, 3.0, 4.6, 3.8, 4.0],
              header=['Car', 'Class', 'Driver', 'Chassis', 'Engine seal'])
    carrier(v, '{FOR v IN vehicleRows}')
    row(v, ['{$v.carNo}', '{$v.class}', '{$v.driver}', '{$v.chassis}', '{$v.engineSeal}'])
    carrier(v, '{END-FOR v}')

    section(doc, 'Officials and contacts')
    c = table(doc, 4, widths=[3.6, 4.6, 4.0, 5.6],
              header=['Role', 'Name', 'Phone', 'Note'])
    carrier(c, '{FOR k IN contactRows}')
    row(c, ['{$k.role}', '{$k.name}', '{$k.phone}', '{$k.note}'])
    carrier(c, '{END-FOR k}')

    section(doc, 'Sessions')
    s = table(doc, 6, widths=[3.4, 2.6, 2.2, 2.2, 2.4, 5.0],
              header=['Session', 'Date', 'Start', 'Mins', 'Tyres', 'Objective'])
    carrier(s, '{FOR x IN sessionCards}')
    row(s, ['{$x.label}', '{$x.date}', '{$x.start}', '{$x.duration}',
            '{$x.tyres}', '{$x.objective}'])
    carrier(s, '{END-FOR x}')

    section(doc, 'Timetable collisions')
    guidance(doc, 'Two sessions whose build-up windows overlap for the same crew or '
                  'the same car. This is the planning failure a paper timetable hides.')
    k = table(doc, 5, widths=[3.0, 3.0, 4.6, 2.6, 4.6],
              header=['Session A', 'Session B', 'Shared', 'Overlap', 'Window'])
    carrier(k, '{FOR z IN collisionRows}')
    row(k, ['{$z.a}', '{$z.b}', '{$z.shared}', '{$z.overlap}', '{$z.window}'])
    carrier(k, '{END-FOR z}')

    section(doc, 'Spares allocation')
    sp = table(doc, 3, widths=[8.0, 2.4, 7.4], header=['Part', 'Qty', 'Location'])
    carrier(sp, '{FOR q IN spareRows}')
    row(sp, ['{$q.part}', '{$q.qty}', '{$q.location}'])
    carrier(sp, '{END-FOR q}')

    section(doc, 'Notes')
    para(doc, '{notes}')

    footer(doc, 'TheRacingData — event-brief-v1.0.')
    doc.save(path)
    return path


def timetable_card(path):
    # A5, so it prints two to a sheet and lives on a pit board clip.
    doc = base_document(width_cm=14.8, height_cm=21.0, margin=1.0)
    eyebrow(doc, '{event.name}')
    heading(doc, 'Timetable', size=16)
    rule(doc)

    guidance(doc, 'One card per session. Times are in event-local time; the offset is '
                  'printed beside the start so a phone set to another country can be '
                  'checked against it.')

    t = table(doc, 4, widths=[1.8, 2.0, 6.2, 2.8],
              header=['Off', 'Time', 'Task', 'Owner'])
    carrier(t, '{FOR x IN sessionCards}')
    # The card's own head, inside the session loop.
    row(t, ['{$x.label}', '{$x.date}', '{$x.start}', '{$x.offset}'],
        size=11, bold=True)
    row(t, ['', '', '{$x.objective}', '{$x.tyres}'], size=8, colour=MUTED)
    carrier(t, '{FOR y IN $x.tasks}')
    row(t, ['{$y.offset}', '{$y.time}', '{$y.task}', '{$y.owner}'])
    carrier(t, '{END-FOR y}')
    carrier(t, '{END-FOR x}')

    footer(doc, 'TheRacingData — timetable-card-v1.0. Reference {reportRef}. '
                'Time zone {event.timezone}.')
    doc.save(path)
    return path


def checklist(path):
    doc = base_document()
    header_block(doc, 'Checklists', [
        ('Event', '{event.name}'), ('Reference', '{reportRef}'),
        ('Venue', '{event.venue}'), ('From', '{event.dateFrom}'),
        ('Packed', '{packedTotal}'), ('To', '{event.dateTo}'),
    ])

    guidance(doc, 'Tick sheet. A box already ticked was packed in the tool; the rest '
                  'are ticked with a pen against the van.')

    t = table(doc, 4, widths=[1.2, 9.4, 4.2, 2.0],
              header=['', 'Item', 'Category', 'Qty'])
    carrier(t, '{FOR l IN checklistBlocks}')
    row(t, ['{$l.title}', '{$l.note}', '{$l.progress}', ''], size=11, bold=True)
    carrier(t, '{FOR i IN $l.items}')
    row(t, ['{$i.box}', '{$i.text}', '{$i.category}', '{$i.qty}'])
    carrier(t, '{END-FOR i}')
    carrier(t, '{END-FOR l}')

    footer(doc, 'TheRacingData — checklist-v1.0. Scrutineering items must be confirmed '
                'against the current year\'s regulations.')
    doc.save(path)
    return path


def contact_sheet(path):
    doc = base_document(margin=1.8)
    eyebrow(doc, '{event.name} — {event.venue}')
    heading(doc, 'Contacts', size=30)
    rule(doc)

    guidance(doc, 'The one page that is read when nothing else is. Large type, single '
                  'page, on the wall of the garage and in every crew pocket.')

    t = table(doc, 3, widths=[4.6, 6.4, 6.4], header=['Role', 'Name', 'Phone'])
    carrier(t, '{FOR k IN contactRows}')
    r = row(t, ['{$k.role}', '{$k.name}', '{$k.phone}'], size=14, bold=True)
    carrier(t, '{END-FOR k}')

    para(doc)
    section(doc, 'Event')
    e = table(doc, 4, widths=[3.4, 4.4, 3.4, 6.2])
    row(e, ['Reference', '{reportRef}', 'Time zone', '{event.timezone}'], size=12)
    row(e, ['From', '{event.dateFrom}', 'To', '{event.dateTo}'], size=12)
    row(e, ['Championship', '{event.championship}', 'Round', '{event.round}'], size=12)
    row(e, ['Country', '{event.country}', 'First call', '{firstCall}'], size=12)

    footer(doc, 'TheRacingData — contact-sheet-v1.0.')
    doc.save(path)
    return path


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for fn, name in [(event_brief, 'event-brief-v1.0.docx'),
                     (timetable_card, 'timetable-card-v1.0.docx'),
                     (checklist, 'checklist-v1.0.docx'),
                     (contact_sheet, 'contact-sheet-v1.0.docx')]:
        path = fn(OUT / name)
        print(f'  wrote  {path.name}')
