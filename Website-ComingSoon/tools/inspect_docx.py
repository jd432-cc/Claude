#!/usr/bin/env python3
"""Dump the table/cell structure of a .docx so fill points can be located."""
import sys, zipfile, re
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}


def cell_text(tc):
    return ''.join(tc.itertext()).strip()


def main(path, max_tables=99):
    z = zipfile.ZipFile(path)
    root = etree.fromstring(z.read('word/document.xml'))
    body = root.find(f'{{{W}}}body')
    ti = 0
    for el in body:
        tag = etree.QName(el).localname
        if tag == 'p':
            t = ''.join(el.itertext()).strip()
            if t:
                print(f'\nP  | {t[:110]}')
        elif tag == 'tbl':
            ti += 1
            if ti > max_tables:
                break
            rows = el.findall(f'{{{W}}}tr')
            print(f'\n=== TABLE {ti}  ({len(rows)} rows) ===')
            for ri, tr in enumerate(rows):
                cells = tr.findall(f'{{{W}}}tc')
                out = []
                for ci, tc in enumerate(cells):
                    out.append(f'[{ri},{ci}]{cell_text(tc)[:46]!r}')
                print('  ' + ' '.join(out))


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 99)
