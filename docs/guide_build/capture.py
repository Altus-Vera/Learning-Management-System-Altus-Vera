"""Capture LMS screenshots for the product guide. Usage: python capture.py [shot_id ...]"""
import json, sys, os
import content as C
MARKS = {}
for f in C.SIGNATURE:
    for sc in f['screens']: MARKS[sc['shot']] = sc['marks']
for g in C.STANDARD:
    for sc in g['screens']: MARKS[sc['shot']] = sc['marks']
SCOPE = {'m': 'main', 'p': 'body', 'h': 'header', 's': 'aside'}
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5101'
OUT = os.path.join(os.path.dirname(__file__), 'shots'); os.makedirs(OUT, exist_ok=True)
ACC = {'admin': ('admin@altusvera.lms', 'Admin@123'), 'lect': ('kperera@altusvera.lk', 'Lecturer@123'), 'stud': ('dvdsilva@students.altusvera.lk', 'Student@123'), 'stud2': ('hnkanakarathne@students.altusvera.lk', 'Student@123')}
# (id, role, url, clicks)
SHOTS = [
 ('login', None, '/login', []),
 ('a_dash', 'admin', '/dashboard', []),
 ('a_overview', 'admin', '/admin', []),
 ('a_students', 'admin', '/admin/students', []),
 ('a_payments', 'admin', '/admin/payments', []),
 ('a_enrol', 'admin', '/admin/enrolment', []),
 ('a_subs', 'admin', '/admin/submissions', []),
 ('a_audit', 'admin', '/admin/audit', []),
 ('a_insights', 'admin', '/insights', []),
 ('a_courses', 'admin', '/courses', []),
 ('l_dash', 'lect', '/dashboard', []),
 ('l_course', 'lect', '/courses/1', []),
 ('l_edit', 'lect', '/courses/1', ['EDITMODE']),
 ('l_participants', 'lect', '/courses/1?tab=participants', []),
 ('l_cgrades', 'lect', '/courses/1?tab=grades', []),
 ('l_qbank', 'lect', '/courses/1?tab=questions', []),
 ('l_assign', 'lect', '/courses/1/assign/31', []),
 ('l_assign_subs', 'lect', '/courses/1/assign/31?tab=submissions', []),
 ('l_assign_an', 'lect', '/courses/1/assign/31?tab=analytics', []),
 ('l_assign_set', 'lect', '/courses/1/assign/31?tab=settings', []),
 ('l_quiz', 'lect', '/courses/1/mod/33', []),
 ('l_quiz_res', 'lect', '/courses/1/mod/33', ['button:has-text("Results")']),
 ('l_quiz_an', 'lect', '/courses/1/mod/33', ['button:has-text("Analytics")']),
 ('l_quiz_set', 'lect', '/courses/1/mod/33', ['button:has-text("Settings")']),
 ('l_forum', 'lect', '/courses/1/mod/3', []),
 ('l_forum_an', 'lect', '/courses/1/mod/3', ['button:has-text("Analytics")']),
 ('l_feedback', 'lect', '/courses/1/mod/7', []),
 ('l_choice', 'lect', '/courses/1/mod/29', []),
 ('l_insights', 'lect', '/insights', []),
 ('l_grades', 'lect', '/grades', []),
 ('l_msg', 'lect', '/dashboard', ['button[aria-label="Messages"]']),
 ('s_dash', 'stud', '/dashboard', []),
 ('s_dark', 'stud', '/dashboard', ['button[aria-label="Toggle theme"]']),
 ('s_courses', 'stud', '/courses', []),
 ('s_course', 'stud', '/courses/1', []),
 ('s_assign', 'stud', '/courses/1/assign/31', []),
 ('s_quiz', 'stud', '/courses/1/mod/33', []),
 ('s_forum', 'stud', '/courses/1/mod/3', []),
 ('s_page', 'stud', '/courses/1/mod/4', []),
 ('s_folder', 'stud', '/courses/1/mod/34', []),
 ('s_url', 'stud', '/courses/1/mod/6', []),
 ('s_resource', 'stud', '/courses/1/mod/8', []),
 ('s_feedback', 'stud', '/courses/1/mod/7', []),
 ('s_choice', 'stud', '/courses/1/mod/29', []),
 ('s_index', 'stud', '/courses/1?tab=assign', []),
 ('s_grades', 'stud', '/grades', []),
 ('s_calendar', 'stud', '/calendar', []),
 ('s_myinsights', 'stud', '/insights/me', []),
 ('s_profile', 'stud', '/profile', []),
 ('s_prefs', 'stud', '/preferences', []),
 ('s_notifs', 'stud', '/notifications', []),
 ('s_badges', 'stud', '/badges', []),
 ('s_files', 'stud', '/files', []),
 ('s_search', 'stud', '/search?q=software', []),
 ('s_attempt', 'stud2', '/courses/1/mod/33', ['button:has-text("Continue your attempt")']),
 ('s_msg', 'stud', '/dashboard', ['button[aria-label="Messages"]']),
]
want = set(sys.argv[1:])
info = {}
marks = json.load(open('marks.json')) if os.path.exists('marks.json') else {}
with sync_playwright() as p:
    br = p.chromium.launch(channel='msedge', headless=True)
    ctxs = {}
    def ctx_for(role):
        if role in ctxs: return ctxs[role]
        c = br.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        pg = c.new_page()
        if role:
            pg.goto(BASE + '/login'); pg.fill('#email', ACC[role][0]); pg.fill('#password', ACC[role][1])
            pg.click('button[type=submit]'); pg.wait_for_url('**/dashboard', timeout=20000); pg.wait_for_timeout(1500)
        ctxs[role] = pg; return pg
    for sid, role, url, clicks in SHOTS:
        if want and sid not in want: continue
        pg = ctx_for(role)
        pg.goto(BASE + url); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(1200)
        for c in clicks:
            try:
                if c == 'EDITMODE':
                    pg.get_by_text('Edit mode', exact=False).first.click()
                else: pg.locator(c).first.click()
                pg.wait_for_timeout(1500)
            except Exception as e: print('click fail', sid, c, e)
        pg.screenshot(path=os.path.join(OUT, sid + '.png'))
        boxes = []
        for i, (sc, sel, el, ex) in enumerate(MARKS.get(sid, [])):
            box = None
            try:
                loc = pg.locator(SCOPE[sc]).first.locator(sel)
                for k in range(min(loc.count(), 8)):
                    b = loc.nth(k).bounding_box()
                    if b and b['width'] > 2 and b['height'] > 2 and 0 <= b['y'] < 890 and b['x'] >= 0 and b['x'] + b['width'] <= 1440:
                        box = b; break
            except Exception as e: print('  sel err', sid, sel, e)
            if not box: print('  MISS', sid, el, sel)
            boxes.append(box)
        marks[sid] = boxes
        texts = []
        info[sid] = texts
        if sid == 's_dark': pg.locator('button[aria-label="Toggle theme"]').first.click()
        print('ok', sid)
    br.close()
old = json.load(open('texts.json')) if os.path.exists('texts.json') else {}
json.dump(marks, open('marks.json', 'w'), indent=0)
old.update(info); json.dump(old, open('texts.json', 'w'), indent=0)
