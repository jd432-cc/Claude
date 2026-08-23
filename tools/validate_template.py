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

Nothing here is specific to one report. What the schema offers is read
off the schema: field keys, collection keys, tick paths, and whatever
the schema's own `payload` hook adds, which it declares in `provides`.

Usage:
    python3 tools/validate_template.py \
        _tools/report-builder/templates/psdr-circuit-v1.2.docx \
        _tools/report-builder/js/schemas/psdr-circuit.js
"""
import re
import sys
import zipfile

RUN_TEXT = re.compile(r'<w:t[^>]*>([^<]*)</w:t>')
TAG = re.compile(r'\{([^}]*)\}')

# Supplied by docx.js for every report, whatever its schema says.
UNIVERSAL = {'showGuidance'}

# Codes that exist only to build the report reference and the filename.
REFERENCE_ONLY = {'round', 'venueCode', 'carCode'}


def doc_text(path):
    return zipfile.ZipFile(path).read('word/document.xml').decode('utf8')


def read_schema(path):
    """What this schema offers a template, read off its source.

    Parsed rather than imported: the schema is an ES module that pulls in
    the rest of the tool, and this has to run without a browser.
    """
    src = open(path, encoding='utf8').read()
    keys = lambda text: set(re.findall(r"\bk:\s*'([^']+)'", text))
    columns = keys(columns_src(src))
    grid = keys(fixed_src(src))
    return {
        # Field keys. Table column keys are held apart because they land as
        # loop locals, and fixed-grid keys because they land under their
        # grid's own name.
        'fields': keys(src) - columns - grid,
        'columns': columns - grid,
        # A schema may reshape its own rows on the way to the template.
        'hook': 'payload(' in src,
        # Collection keys: `table: { key: 'opportunities'` and check grids.
        'collections': set(re.findall(r"\bkey:\s*'([^']+)'", src)),
        # Tick columns beside a field.
        'checks': set(re.findall(r"\bcheck:\s*'([^']+)'", src)),
        # Anything the schema's payload hook adds, declared by name. A
        # trailing dot means everything under it.
        'provides': set(re.findall(r"'([^']+)'", provides_block(src))),
    }


def provides_block(src):
    m = re.search(r'provides:\s*\[(.*?)\]', src, re.S)
    return m.group(1) if m else ''


def blocks(src, opener, open_ch, close_ch):
    """The text of every `opener` block, bracket-matched."""
    out = []
    for m in re.finditer(opener, src):
        depth, i = 0, m.end() - 1
        while i < len(src):
            if src[i] == open_ch:
                depth += 1
            elif src[i] == close_ch:
                depth -= 1
                if depth == 0:
                    out.append(src[m.end():i])
                    break
            i += 1
    return '\n'.join(out)


def columns_src(src):
    return blocks(src, r'columns:\s*\[', '[', ']')


def fixed_src(src):
    """Fixed grids name their cells `<key>.<row>.<column>`, so neither the
    row keys nor the column keys are paths in their own right."""
    return blocks(src, r'fixed:\s*\{', '{', '}')


def main(docx_path, schema_path):
    xml = doc_text(docx_path)
    runs = RUN_TEXT.findall(xml)
    joined = ''.join(runs)
    schema = read_schema(schema_path)

    problems, notes = [], []

    # 1. Split tags. A tag is only safe if it sits inside one run.
    intact = set()
    for r in runs:
        intact.update(TAG.findall(r))
    all_tags = set(TAG.findall(joined))
    for t in sorted(all_tags - intact):
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

    # A loop local is only a local if some FOR declared it.
    locals_ = {'$idx'} | {f'${v}.' for v in loops_open}

    # Everything a tag is allowed to name.
    known = (schema['fields'] | schema['columns'] | schema['collections']
             | schema['checks'] | schema['provides'] | UNIVERSAL)
    prefixes = tuple(k for k in schema['provides'] if k.endswith('.'))
    prefixes += tuple(f'{k}.' for k in schema['collections'])
    # A tick path is dotted; accept its parent as a prefix too.
    prefixes += tuple(f'{c.split(".", 1)[0]}.' for c in schema['checks'] if '.' in c)

    # 2. Unknown paths.
    for v in sorted(values):
        base = v.split('+')[0].split('-')[0].strip()
        if base.startswith(tuple(locals_)):
            continue
        if base in known or base.startswith(prefixes):
            continue
        problems.append(f'tag has no source: {{{v}}} '
                        f'(not a schema field and not supplied by docx.js)')

    # 3. Schema keys with nowhere to land.
    loop_suffixes = {v.split('.', 1)[1] for v in values
                     if v.startswith('$') and '.' in v}
    loop_suffixes |= {s.split('.', 1)[0] for s in loop_suffixes if '.' in s}
    # A grid row named in a constant rather than inline still reaches the
    # document, as the middle of a `<grid>.<row>.<column>` path.
    segments = {part for v in values for part in v.lstrip('$').split('.')}
    for f in sorted(schema['fields']):
        if f in values or f in loop_suffixes or f in REFERENCE_ONLY:
            continue
        if '.' not in f and f in segments:
            continue
        notes.append(f'schema field never used in the template: {f}')

    # A column key lands as a loop local ($o.corner), unless the schema
    # reshapes its rows first, in which case only the hook knows.
    if not schema['hook']:
        for c in sorted(schema['columns']):
            if c in loop_suffixes or c in values:
                continue
            notes.append(f'table column never used in the template: {c}')

    print(f'template  {docx_path}')
    print(f'  {len(all_tags)} tags, {len(loops_open)} row loops, '
          f'{len(schema["fields"])} schema fields, '
          f'{len(schema["columns"])} table columns')
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
