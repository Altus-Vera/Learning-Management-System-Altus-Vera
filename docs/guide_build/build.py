# -*- coding: utf-8 -*-
"""Build docs/AltusVera_LMS_Guide.docx from content.py + annotated screenshots."""
import json, os
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor, Emu
import content as C

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'AltusVera_LMS_Guide.docx')
LOGO = os.path.join(HERE, '..', '..', 'web', 'public', 'brand', 'logo-full.png')
BLUE = RGBColor(0x00, 0x33, 0xA0); DARK = RGBColor(0x1F, 0x29, 0x37); GREY = RGBColor(0x6B, 0x72, 0x80); RED = RGBColor(0xDC, 0x26, 0x26)
marks = json.load(open(os.path.join(HERE, 'marks.json')))

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.27), Inches(11.69)
sec.left_margin = sec.right_margin = Inches(0.79); sec.top_margin = sec.bottom_margin = Inches(0.9)
TEXT_W = sec.page_width - sec.left_margin - sec.right_margin

st = doc.styles
st['Normal'].font.name = 'Arial'; st['Normal'].font.size = Pt(10.5)
st['Normal'].element.rPr.rFonts.set(qn('w:eastAsia'), 'Arial')
st['Normal'].paragraph_format.space_after = Pt(6)
for name, size, color in [('Heading 1', 20, BLUE), ('Heading 2', 15, BLUE), ('Heading 3', 12.5, DARK)]:
    h = st[name]; h.font.name = 'Arial'; h.font.size = Pt(size); h.font.bold = True; h.font.color.rgb = color
    h.element.rPr.rFonts.set(qn('w:asciiTheme'), 'Arial') if False else None
    rf = h.element.rPr.rFonts; [rf.attrib.pop(qn(k), None) for k in ('w:asciiTheme', 'w:hAnsiTheme', 'w:eastAsiaTheme', 'w:cstheme')]
    rf.set(qn('w:ascii'), 'Arial'); rf.set(qn('w:hAnsi'), 'Arial')
    h.paragraph_format.space_before = Pt({'Heading 1': 18, 'Heading 2': 14, 'Heading 3': 12}[name]); h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr(); s = OxmlElement('w:shd')
    s.set(qn('w:val'), 'clear'); s.set(qn('w:color'), 'auto'); s.set(qn('w:fill'), hexcolor); tcPr.append(s)


def cell_margins(table, top=80, bottom=80, left=110, right=110):
    tblPr = table._tbl.tblPr; m = OxmlElement('w:tblCellMar')
    for k, v in (('top', top), ('left', left), ('bottom', bottom), ('right', right)):
        e = OxmlElement(f'w:{k}'); e.set(qn('w:w'), str(v)); e.set(qn('w:type'), 'dxa'); m.append(e)
    tblPr.append(m)


def borders(table, color='C9D2E3'):
    tblPr = table._tbl.tblPr; b = OxmlElement('w:tblBorders')
    for k in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{k}'); e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '6'); e.set(qn('w:color'), color); b.append(e)
    tblPr.append(b)


def field(par, instr):
    r = par.add_run(); f1 = OxmlElement('w:fldChar'); f1.set(qn('w:fldCharType'), 'begin'); r._r.append(f1)
    r = par.add_run(); t = OxmlElement('w:instrText'); t.set(qn('xml:space'), 'preserve'); t.text = instr; r._r.append(t)
    r = par.add_run(); f2 = OxmlElement('w:fldChar'); f2.set(qn('w:fldCharType'), 'separate'); r._r.append(f2)
    r = par.add_run('1'); r = par.add_run(); f3 = OxmlElement('w:fldChar'); f3.set(qn('w:fldCharType'), 'end'); r._r.append(f3)


def table(rows, widths, header=True, font=9.5, first_bold=False):
    t = doc.add_table(rows=len(rows), cols=len(rows[0])); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    borders(t); cell_margins(t)
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            c = t.cell(i, j); c.width = widths[j]; p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(0)
            r = p.add_run(str(val)); r.font.size = Pt(font)
            if header and i == 0:
                r.bold = True; r.font.color.rgb = RGBColor(255, 255, 255); shade(c, '0033A0')
            else:
                if first_bold and j == 0: r.bold = True
                if val in ('✓', '—') or str(val).startswith('✓ ('):
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    if val.startswith('✓'): r.font.color.rgb = RGBColor(0x16, 0xA3, 0x4A)
                if i % 2 == 0 and header: shade(c, 'F3F6FB')
    if header:
        trPr = t.rows[0]._tr.get_or_add_trPr(); e = OxmlElement('w:tblHeader'); e.set(qn('w:val'), 'true'); trPr.append(e)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def para(text, bold_lead=None, color=None, size=None, italic=False, after=6, align=None):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(after)
    if align: p.alignment = align
    if bold_lead:
        r = p.add_run(bold_lead); r.bold = True
        if color: r.font.color.rgb = color
    r = p.add_run(text); r.italic = italic
    if size: r.font.size = Pt(size)
    return p


def bullets(items, numbered=False):
    for it in items:
        p = doc.add_paragraph(style='List Number' if numbered else 'List Bullet'); p.paragraph_format.space_after = Pt(3)
        p.add_run(it)


def restart_numbering(p):
    """Make a 'List Number' paragraph restart at 1 with a fresh num instance."""
    numbering = doc.part.numbering_part.element
    style_numId = doc.styles['List Number'].element.pPr.numPr.numId.val
    absId = numbering.num_having_numId(style_numId).abstractNumId.val
    num = numbering.add_num(absId)
    lo = num.add_lvlOverride(ilvl=0); lo.add_startOverride(1)
    pPr = p._p.get_or_add_pPr(); numPr = pPr.get_or_add_numPr(); numPr.get_or_add_ilvl().val = 0; numPr.get_or_add_numId().val = num.numId


def numbered(items):
    first = True
    for it in items:
        p = doc.add_paragraph(style='List Number'); p.paragraph_format.space_after = Pt(3); p.add_run(it)
        if first: restart_numbering(p); first = False


def screen(sc, tag):
    doc.add_heading(sc['title'], level=3)
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(6)
    r = p.add_run(f'{sc["role"]}   '); r.bold = True; r.font.color.rgb = BLUE
    r = p.add_run('What it does: '); r.bold = True
    p.add_run(sc['what']); p.paragraph_format.keep_with_next = True
    img = os.path.join(HERE, 'annotated', sc['shot'] + '.png')
    ip = doc.add_paragraph(); ip.alignment = WD_ALIGN_PARAGRAPH.CENTER; ip.paragraph_format.space_after = Pt(4)
    ip.paragraph_format.keep_with_next = True
    ip.add_run().add_picture(img, width=TEXT_W)
    boxes = marks.get(sc['shot'], [])
    rows = [[str(n), el, ex] for n, (el, ex) in enumerate([(m[2], m[3]) for m, b in zip(sc['marks'], boxes) if b], 1)]
    if rows:
        table(rows, [Inches(0.4), Inches(1.9), TEXT_W - Inches(2.3)], header=False, first_bold=False)
        t = doc.tables[-1]
        for row in t.rows:
            c = row.cells[0]; shade(c, 'DC2626'); rr = c.paragraphs[0].runs[0]; rr.bold = True; rr.font.color.rgb = RGBColor(255, 255, 255)
            c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            row.cells[1].paragraphs[0].runs[0].bold = True
            for cc in row.cells: cc.paragraphs[0].paragraph_format.keep_with_next = True
    if sc.get('leads') and sc['leads'] != '—':
        p = doc.add_paragraph(); r = p.add_run('Leads to:  '); r.bold = True
        for i, l in enumerate(sc['leads'].split(', ')):
            r = p.add_run(('     ' if i else '') + '➜ ' + l); r.font.color.rgb = BLUE


# ------------------------------------------------------------ header / footer
hp = sec.header.paragraphs[0]; hp.paragraph_format.tab_stops.add_tab_stop(TEXT_W, WD_TAB_ALIGNMENT.RIGHT)
r = hp.add_run('\tAltus Vera (Pvt) Ltd'); r.font.size = Pt(9); r.font.color.rgb = GREY; r.bold = True
fp = sec.footer.paragraphs[0]; ts = fp.paragraph_format.tab_stops
ts.add_tab_stop(TEXT_W // 2, WD_TAB_ALIGNMENT.CENTER); ts.add_tab_stop(TEXT_W, WD_TAB_ALIGNMENT.RIGHT)
for t in ('© 2026 Altus Vera\t' + C.FOOTER + '\tPage ',):
    r = fp.add_run(t); r.font.size = Pt(8.5); r.font.color.rgb = GREY
field(fp, 'PAGE'); r = fp.add_run(' of '); r.font.size = Pt(8.5); r.font.color.rgb = GREY; field(fp, 'NUMPAGES')
for r in fp.runs: r.font.size = Pt(8.5); r.font.color.rgb = GREY
sec.different_first_page_header_footer = True

# ------------------------------------------------------------ cover
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(40)
p.add_run().add_picture(LOGO, width=Inches(2.6))
p = para('', after=0); p.paragraph_format.space_before = Pt(36)
for text, size, color, bold, after in [(C.TITLE, 32, BLUE, True, 4), (C.SUBTITLE, 16, DARK, False, 18), (C.TAGLINE, 12.5, GREY, False, 60)]:
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(after)
    r = p.add_run(text); r.font.size = Pt(size); r.font.color.rgb = color; r.bold = bold
for lead, val in [('Document date    ', 'November 2026'), ('Prepared by ', 'Altus Vera (Pvt) Ltd'), ('Contact : ', 'contact@altusvera.com / 0776887542')]:
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(4)
    r = p.add_run(lead); r.bold = True; r.font.color.rgb = DARK; r = p.add_run(val); r.font.color.rgb = GREY
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

# ------------------------------------------------------------ contents
p = doc.add_paragraph(); r = p.add_run('Contents'); r.bold = True; r.font.size = Pt(20); r.font.color.rgb = BLUE
p = doc.add_paragraph(); field(p, 'TOC \\o "1-2" \\h \\z \\u')
p.runs[3].text = 'Right-click and choose Update Field to refresh the contents.'
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

# ------------------------------------------------------------ 1. About
doc.add_heading('1. About Altus Vera LMS', level=1)
para(C.ABOUT)
table(C.ROLES_TABLE, [Inches(1.2)] + [(TEXT_W - Inches(1.2)) // 3] * 3, first_bold=True)
doc.add_heading('How Altus Vera LMS compares', level=2)
table(C.COMPARE_TABLE, [Inches(1.5), Inches(2.3), TEXT_W - Inches(3.8)], first_bold=True)
doc.add_heading('How this guide is organised', level=2)
bullets(C.ORGANISED)
para(C.ORGANISED_NOTE)

# ------------------------------------------------------------ 2. Signature
doc.add_page_break()
doc.add_heading('2. Signature Features — What Makes Altus Vera LMS Different', level=1)
para(C.SIGNATURE_INTRO)
table([['Feature', 'What it gives the institute']] + [[f'{i}. {f["name"]}', f['summary']] for i, f in enumerate(C.SIGNATURE, 1)],
      [Inches(2.0), TEXT_W - Inches(2.0)], first_bold=True)
for i, f in enumerate(C.SIGNATURE, 1):
    doc.add_page_break()
    doc.add_heading(f'2.{i}  {f["name"]} — {f["tagline"]}', level=2)
    bt = doc.add_table(rows=1, cols=1); bt.alignment = WD_TABLE_ALIGNMENT.CENTER; cell_margins(bt, 160, 160, 220, 220)
    c = bt.cell(0, 0); c.width = TEXT_W; shade(c, 'EAF0FB')
    bp = c.paragraphs[0]; bp.paragraph_format.space_after = Pt(0)
    r = bp.add_run(f'Signature feature {i}'); r.font.size = Pt(9); r.bold = True; r.font.color.rgb = RED
    bp = c.add_paragraph(); bp.paragraph_format.space_after = Pt(0); r = bp.add_run(f['name']); r.font.size = Pt(18); r.bold = True; r.font.color.rgb = BLUE
    bp = c.add_paragraph(); bp.paragraph_format.space_after = Pt(0); r = bp.add_run(f['tagline'][0].upper() + f['tagline'][1:]); r.font.size = Pt(11); r.font.color.rgb = DARK
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    para(f['why'], bold_lead='Why clients want it: ')
    p = doc.add_paragraph(); r = p.add_run('How it works'); r.bold = True; r.font.color.rgb = BLUE
    numbered(f['how'])
    for sc in f['screens']: screen(sc, f['name'])

# ------------------------------------------------------------ 3. Standard
doc.add_page_break()
doc.add_heading('3. Standard Features', level=1)
para(C.STANDARD_INTRO)
table([['Area', 'Pages covered']] + [[g['group'], ', '.join(s['title'] for s in g['screens'])] for g in C.STANDARD],
      [Inches(1.8), TEXT_W - Inches(1.8)], first_bold=True)
for gi, g in enumerate(C.STANDARD, 1):
    doc.add_heading(f'3.{gi}  {g["group"]}', level=2)
    for sc in g['screens']: screen(sc, g['group'])

# ------------------------------------------------------------ 4. Access
doc.add_page_break()
doc.add_heading('4. Who Can Use What', level=1)
para(C.ACCESS_NOTE)
table(C.ACCESS_TABLE, [TEXT_W - Inches(4.2), Inches(1.0), Inches(1.5), Inches(1.7)])
doc.add_heading('Quick tips', level=2)
table(C.TIPS, [Inches(2.0), TEXT_W - Inches(2.0)], first_bold=True)

# ask Word to refresh TOC / page fields on open
s = doc.settings.element; u = OxmlElement('w:updateFields'); u.set(qn('w:val'), 'true'); s.append(u)
doc.save(OUT)
print('saved', os.path.abspath(OUT))
