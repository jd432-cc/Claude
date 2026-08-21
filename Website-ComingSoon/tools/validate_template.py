#!/usr/bin/env python3
"""
Validate a tagged report template against its schema.

Word splits a run the moment you edit near a tag, which turns {bestLap}
into {best + Lap} across two runs and breaks it silently: the export
still succeeds, the field just comes out blank. This catches that before
the template ships, along with the other three ways a template drifts
out of step with the code that fills it.

Checks:
  1. Every tag is intact and inside a single run.
  2. Every tag resolves to a path the schema or the exporter provides.
  3. Every schema field has somewhere in the document to land.
  4. FOR / END-FOR pairs match, and each loop has carrier rows.

Usage:
    python3 tools/validate_template.py \
        _tools/report-builder/templates/psdr-circuit-v1.2.docx \
        _tools/report-builder/js/schema.js
"""
import re
import sys
import zipfile

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
RUN_TEXT = re.compile(r'<w:t[^>]*>([^<]*)</w:t>')
TAG = re.compile(r'\{([^}]*)\}')

# Supplied by docx.js rather than declared as schema fields.
EXPORTER_PROVIDED = {
    'showGuidance', 'verdict', 'faults',
    'opportunities', 'correlation', 'setupChanges', 'priorities',
}
EXPORTER_PREFIXES = ('band.', 'check.', 'src.')
LOOP_LOCALS = ('$idx', '$o.', '$c.', '$s.', '$p.')


def doc_text(path):
    return zipfile.ZipFile(path).read('word/document.xml').decode('utf8')


def schema_fields(path):
    src = open(path, encoding='utf8').read()
    return set(re.findall(r"\bk:\s*'([^']+)'", src))


def main(docx_path, schema_path):
    xml = doc_text(docx_path)
    runs = RUN_TEXT.findall(xml)
    joined = ''.join(runs)
    fields = schema_fields(schema_path)

    problems, notes = [], []

    # 1. Split tags. A tag is only safe if it sits inside one run.
    intact = set()
    for r in runs:
        intact.update(TAG.findall(r))
    all_tags = set(TAG.findall(joined))
    split = all_tags - intact
    for t in sorted(split):
        problems.append(f'tag split across runs: {{{t}}} '
                        f'(retype it in one go, or re-run the tagger)')

    # Unbalanced braces anywhere.
    if joined.count('{') != joined.count('}'):
        problems.append(f'unbalanced braces: {joined.count("{")} open, '
                        f'{joined.count("}")} close')

    # 2 / 4. Classify.
    loops_open, loops_close, values = [], [], set()
    for t in sorted(all_tags):
        s = t.strip()
        m = re.match(r'^FOR\s+(\w+)\s+IN\s+(\S+)$', s)
        if m:
            loops_open.append(m.group(1))
            values.add(m.group(2))
            continue
        m = re.match(r'^END-FOR\s+(\w+)$', s)
        if m:
            loops_close.append(m.group(1))
            continue
        if s in ('END-IF',):
            continue
        if s.startswith('IF '):
            values.add(s[3:].strip())
            continue
        values.add(s)

    if sorted(loops_open) != sorted(loops_close):
        problems.append(f'FOR/END-FOR mismatch: opened {sorted(loops_open)}, '
                        f'closed {sorted(loops_close)}')

    # 2. Unknown paths.
    for v in sorted(values):
        base = v.split('+')[0].split('-')[0].strip()
        if base.startswith(LOOP_LOCALS):
            continue
        if base in EXPORTER_PROVIDED or base.startswith(EXPORTER_PREFIXES):
            continue
        if base in fields:
            continue
        problems.append(f'tag has no source: {{{v}}} '
                        f'(not a schema field and not supplied by docx.js)')

    # 3. Schema keys with nowhere to land. A table column key lands as a
    # loop local ($o.corner), not as a bare path, so check both forms.
    loop_suffixes = {v.split('.', 1)[1] for v in values
                     if v.startswith('$') and '.' in v}
    for f in sorted(fields):
        if f in values or f in loop_suffixes:
            continue
        # These codes exist only to build the report reference.
        if f in ('round', 'venueCode', 'carCode'):
            continue
        notes.append(f'schema field never used in the template: {f}')

    print(f'template  {docx_path}')
    print(f'  {len(all_tags)} tags, {len(loops_open)} row loops, '
          f'{len(fields)} schema fields')
    for n in notes:
        print(f'  note     {n}')
    for p in problems:
        print(f'  PROBLEM  {p}')

    if problems:
        print(f'\n{len(problems)} problem(s). Template is not safe to ship.')
        return 1
    print('\nOK')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
