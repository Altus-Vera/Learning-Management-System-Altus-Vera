// End-to-end API test for every role and feature. Run: node e2e.mjs
const BASE = 'http://localhost:5100'
const results = []
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`) }

async function req(token, method, path, body, isForm) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, { method, headers, body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined })
  let data = null
  const text = await res.text()
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}
const login = async (email, password) => (await req(null, 'POST', '/api/auth/login', { email, password })).data
const boot = async (t) => (await req(t, 'GET', '/api/v1/bootstrap')).data
const acts = (b) => b.lms.courses.flatMap((c) => c.sections.flatMap((s) => s.activities.map((a) => ({ ...a, courseId: c.id, section: s.id }))))

const stamp = Date.now().toString().slice(-5)

// ── Auth ──
const bad = await req(null, 'POST', '/api/auth/login', { email: 'dvdsilva@students.altusvera.lk', password: 'wrong' })
ok('auth: wrong password rejected', bad.status === 401)
const noAuth = await req(null, 'GET', '/api/v1/bootstrap')
ok('auth: bootstrap requires token', noAuth.status === 401)
const S = await login('dvdsilva@students.altusvera.lk', 'Student@123')
const S2 = await login('gpadnilwala@students.altusvera.lk', 'Student@123')
const L = await login('kperera@altusvera.lk', 'Lecturer@123')
const L2 = await login('sfernando@altusvera.lk', 'Lecturer@123')
const A = await login('admin@altusvera.lms', 'Admin@123')
ok('auth: student/lecturer/admin login', S?.token && L?.token && A?.token, `${S?.role}/${L?.role}/${A?.role}`)

// clean slate for DVD: remove any blocks
await req(A.token, 'POST', '/api/v1/registrar/unblocks', { studentIds: [S.userId], courseId: null, all: true })

let bs = await boot(S.token), bl = await boot(L.token), ba = await boot(A.token)
ok('bootstrap: student sees only enrolled courses', bs.lms.courses.length >= 1 && bs.lms.courses.length <= ba.lms.courses.length, `${bs.lms.courses.length} courses`)
ok('bootstrap: lecturer sees only own courses', bl.lms.courses.every((c) => c.lecturerId === L.userId), `${bl.lms.courses.length} courses`)
ok('bootstrap: admin sees all courses + audit + payments', ba.lms.courses.length === 6 && Array.isArray(ba.admin.audit) && Object.keys(ba.admin.payments).length > 0)
ok('bootstrap: student gets no payments/audit', Object.keys(bs.admin.payments).length === 0 && bs.admin.audit.length === 0)
ok('bootstrap: student sees no hidden activities', acts(bs).every((a) => a.visible))
ok('bootstrap: student sees only own submissions', Object.values(bs.lms.submissions).every((s) => s.studentId === S.userId))

let course = bs.lms.courses.find((c) => c.shortName === 'BS401.3')
const freshAssign = (await req(L.token, 'POST', `/api/v1/sections/${course.sections[2].id}/activities`, { type: 'assign', name: 'E2E Fresh ' + stamp })).data.id
bs = await boot(S.token); bl = await boot(L.token)
course = bs.lms.courses.find((c) => c.shortName === 'BS401.3')
const all = acts(bs).filter((a) => a.courseId === course.id)
const lAll = acts(bl).filter((a) => a.courseId === course.id)
const by = (n) => all.find((a) => a.name === n)
const assignOpen = all.find((a) => a.id === freshAssign)
const assignClosed = all.find((a) => a.type === 'assign' && new Date(a.assign.cutOffDate) < new Date())
const assignFuture = all.find((a) => a.type === 'assign' && new Date(a.assign.allowSubmissionsFrom) > new Date())

// ── Course state & completion ──
let r = await req(S.token, 'PUT', `/api/v1/courses/${course.id}/state`, { starred: true, hidden: false, touch: true })
ok('course: star + touch', r.status === 204)
const res1 = all.find((a) => a.type === 'resource')
const before = !!bs.lms.completion[res1.id]
r = await req(S.token, 'POST', `/api/v1/activities/${res1.id}/completion`)
bs = await boot(S.token)
ok('course: toggle completion persists', r.status === 204 && !!bs.lms.completion[res1.id] === !before)
await req(S.token, 'POST', `/api/v1/activities/${res1.id}/completion`)

// ── Assignment: student flow ──
ok('assign: found an open assignment', !!assignOpen, assignOpen?.name)
const pdf = () => { const f = new FormData(); f.append('file', new Blob(['%PDF test ' + stamp]), `e2e_${stamp}.pdf`); return f }
const exe = () => { const f = new FormData(); f.append('file', new Blob(['MZ']), 'bad.exe'); return f }
r = await req(S.token, 'POST', `/api/v1/assignments/${assignOpen.id}/files`, exe(), true)
ok('assign: wrong file type rejected', r.status === 400, r.data?.error)
r = await req(S.token, 'PUT', `/api/v1/assignments/${assignOpen.id}/submission`, { onlineText: '' })
ok('assign: save without file rejected', r.status === 400, r.data?.error)
r = await req(S.token, 'POST', `/api/v1/assignments/${assignOpen.id}/files`, pdf(), true)
const fileId = r.data?.id
ok('assign: upload pdf', r.status === 200 && fileId)
r = await req(S.token, 'POST', `/api/v1/assignments/${assignOpen.id}/files`, pdf(), true)
ok('assign: max files enforced', r.status === 400, r.data?.error)
r = await req(S.token, 'PUT', `/api/v1/assignments/${assignOpen.id}/submission`, { onlineText: '' })
bs = await boot(S.token)
ok('assign: save → draft', r.status === 204 && bs.lms.submissions[`${assignOpen.id}:${S.userId}`]?.status === 'draft')
r = await req(S.token, 'POST', `/api/v1/assignments/${assignOpen.id}/submit`, { statementAccepted: false })
ok('assign: submit requires statement', r.status === 400)
r = await req(S.token, 'POST', `/api/v1/assignments/${assignOpen.id}/submit`, { statementAccepted: true })
bs = await boot(S.token)
ok('assign: submit → submitted', r.status === 204 && bs.lms.submissions[`${assignOpen.id}:${S.userId}`]?.status === 'submitted')
ok('assign: submission notification created', bs.social.notifications.some((n) => n.subject === 'Submission received'))
r = await req(S.token, 'DELETE', `/api/v1/submission-files/${fileId}`)
ok('assign: cannot change after submit', r.status === 400)
r = await req(S.token, 'GET', `/api/v1/submission-files/${fileId}`)
ok('assign: owner can download', r.status === 200)
r = await req(S2.token, 'GET', `/api/v1/submission-files/${fileId}`)
ok('assign: other student cannot download', r.status === 403)
r = await req(L.token, 'GET', `/api/v1/submission-files/${fileId}`)
ok('assign: lecturer can download', r.status === 200)
r = await req(L2.token, 'GET', `/api/v1/submission-files/${fileId}`)
ok('assign: other lecturer cannot download', r.status === 403)
if (assignClosed) { r = await req(S.token, 'POST', `/api/v1/assignments/${assignClosed.id}/files`, pdf(), true); ok('assign: closed (cut-off) rejected', r.status === 400, r.data?.error) }
if (assignFuture) { r = await req(S.token, 'POST', `/api/v1/assignments/${assignFuture.id}/files`, pdf(), true); ok('assign: not-yet-open rejected', r.status === 400, r.data?.error) }

// comments
r = await req(S.token, 'POST', `/api/v1/assignments/${assignOpen.id}/comments`, { studentId: S.userId, text: 'Student comment ' + stamp })
const cId = r.data?.id
ok('comments: student adds', r.status === 200 && cId)
r = await req(S2.token, 'POST', `/api/v1/assignments/${assignOpen.id}/comments`, { studentId: S.userId, text: 'spy' })
ok('comments: other student blocked', r.status === 403)
r = await req(L.token, 'POST', `/api/v1/assignments/${assignOpen.id}/comments`, { studentId: S.userId, text: 'Lecturer reply ' + stamp })
ok('comments: lecturer replies', r.status === 200)
r = await req(S.token, 'DELETE', `/api/v1/submission-comments/${cId}`)
ok('comments: author deletes', r.status === 204)

// ── Lecturer grading ──
r = await req(S.token, 'PUT', `/api/v1/assignments/${assignOpen.id}/submissions/${S.userId}/grade`, { grade: 100, feedback: '' })
ok('grade: student forbidden', r.status === 403)
r = await req(L2.token, 'PUT', `/api/v1/assignments/${assignOpen.id}/submissions/${S.userId}/grade`, { grade: 80, feedback: '' })
ok('grade: other lecturer forbidden', r.status === 403)
r = await req(L.token, 'PUT', `/api/v1/assignments/${assignOpen.id}/submissions/${S.userId}/grade`, { grade: 150, feedback: '' })
ok('grade: out of range rejected', r.status === 400)
r = await req(L.token, 'PUT', `/api/v1/assignments/${assignOpen.id}/submissions/${S.userId}/grade`, { grade: 77, feedback: 'Good ' + stamp })
bs = await boot(S.token)
ok('grade: saved and visible to student', r.status === 204 && bs.lms.submissions[`${assignOpen.id}:${S.userId}`]?.grade === 77)
ok('grade: student notified', bs.social.notifications.some((n) => n.subject === `${assignOpen.name} has been graded`))
r = await req(S.token, 'DELETE', `/api/v1/assignments/${assignOpen.id}/submission`)
ok('assign: graded submission cannot be removed', r.status === 400)
r = await req(L.token, 'PUT', `/api/v1/assignments/${assignOpen.id}/submissions/${S2.userId}/status`, { status: 'draft' })
ok('grade: lecturer reverts status', r.status === 204)

// ── Lecturer activity editing ──
const lAssign = lAll.find((a) => a.id === assignOpen.id)
r = await req(L.token, 'PUT', `/api/v1/activities/${assignOpen.id}`, { assign: { ...lAssign.assign, acceptingSubmissions: false } })
ok('settings: lecturer disables submissions', r.status === 204)
r = await req(S2.token, 'POST', `/api/v1/assignments/${assignOpen.id}/files`, pdf(), true)
ok('settings: disabled assignment rejects student', r.status === 400, r.data?.error)
await req(L.token, 'PUT', `/api/v1/activities/${assignOpen.id}`, { assign: { ...lAssign.assign, acceptingSubmissions: true } })
r = await req(S.token, 'PUT', `/api/v1/activities/${assignOpen.id}`, { name: 'hack' })
ok('settings: student cannot edit activity', r.status === 403)
const sec = course.sections[5]
r = await req(L.token, 'POST', `/api/v1/sections/${sec.id}/activities`, { type: 'assign', name: 'E2E Assignment ' + stamp })
const newAct = r.data?.id
ok('activity: lecturer adds assignment', r.status === 200 && newAct)
r = await req(L.token, 'PUT', `/api/v1/activities/${newAct}`, { visible: false })
bs = await boot(S.token)
ok('activity: hidden activity not sent to student', !acts(bs).some((a) => a.id === newAct))
r = await req(L.token, 'DELETE', `/api/v1/activities/${newAct}`)
ok('activity: lecturer deletes', r.status === 204)
r = await req(L2.token, 'POST', `/api/v1/sections/${sec.id}/activities`, { type: 'page', name: 'x' })
ok('activity: other lecturer cannot add', r.status === 403)

// ── Forums ──
const news = by('Announcements'), disc = by('Discussion Forum')
r = await req(S.token, 'POST', `/api/v1/forums/${news.id}/discussions`, { subject: 'x', message: 'x', pinned: false })
ok('forum: student cannot post announcement', r.status === 403)
r = await req(L.token, 'POST', `/api/v1/forums/${news.id}/discussions`, { subject: 'E2E announcement ' + stamp, message: 'Hello class', pinned: true })
ok('forum: lecturer posts announcement', r.status === 200)
r = await req(S.token, 'POST', `/api/v1/forums/${disc.id}/discussions`, { subject: 'E2E topic ' + stamp, message: 'Question?', pinned: true })
const dId = r.data?.id
ok('forum: student starts discussion', r.status === 200 && dId)
bs = await boot(S.token)
const myD = bs.activity.forums[disc.id].find((d) => d.id === dId)
ok('forum: student pin flag ignored', myD && !myD.pinned)
r = await req(S2.token, 'POST', `/api/v1/discussions/${dId}/posts`, { parentId: myD.posts[0].id, message: 'Answer ' + stamp })
const pId = r.data?.id
ok('forum: another student replies', r.status === 200 && pId)
r = await req(S.token, 'PUT', `/api/v1/posts/${pId}`, { message: 'edit someone else' })
ok('forum: cannot edit others post', r.status === 403)
r = await req(S2.token, 'PUT', `/api/v1/posts/${pId}`, { message: 'Edited answer' })
ok('forum: edit own post', r.status === 204)
r = await req(S.token, 'PUT', `/api/v1/discussions/${dId}`, { locked: true })
ok('forum: student cannot lock', r.status === 403)
r = await req(L.token, 'PUT', `/api/v1/discussions/${dId}`, { locked: true })
ok('forum: lecturer locks', r.status === 204)
r = await req(S2.token, 'POST', `/api/v1/discussions/${dId}/posts`, { parentId: myD.posts[0].id, message: 'late' })
ok('forum: locked discussion rejects reply', r.status === 400)
r = await req(S.token, 'POST', `/api/v1/discussions/${dId}/star`)
ok('forum: star', r.status === 204)
r = await req(S.token, 'POST', `/api/v1/forums/${disc.id}/subscription`)
ok('forum: subscribe toggle', r.status === 204)
r = await req(L.token, 'DELETE', `/api/v1/discussions/${dId}`)
ok('forum: lecturer deletes discussion', r.status === 204)

// ── Quiz ──
const quizOpen = all.find((a) => a.type === 'quiz' && new Date(a.quiz.openDate) < new Date() && new Date(a.quiz.closeDate) > new Date())
const quizClosed = all.find((a) => a.type === 'quiz' && new Date(a.quiz.closeDate) < new Date())
if (quizClosed) { r = await req(S2.token, 'POST', `/api/v1/quizzes/${quizClosed.id}/attempts`); ok('quiz: closed quiz rejects attempt', r.status === 400) }
const lQuiz = lAll.find((a) => a.id === quizOpen.id)
await req(L.token, 'PUT', `/api/v1/activities/${quizOpen.id}`, { quiz: { ...lQuiz.quiz, attemptsAllowed: 0 } })
r = await req(S2.token, 'POST', `/api/v1/quizzes/${quizOpen.id}/attempts`)
const att = r.data
ok('quiz: start attempt', r.status === 200 && att?.id)
r = await req(S.token, 'POST', `/api/v1/quiz-attempts/${att.id}/finish`, { answers: { 0: 1 } })
ok('quiz: cannot finish others attempt', r.status === 403)
r = await req(S2.token, 'POST', `/api/v1/quiz-attempts/${att.id}/finish`, { answers: { 0: 1, 1: 0, 2: 1, 3: 2, 4: 1 } })
ok('quiz: server scores 5/5', r.status === 200 && r.data.score === 5, `score ${r.data?.score}`)
const used = (bs2 => (bs2.activity.attempts[quizOpen.id] ?? []).filter((x) => x.finishedAt).length)(await boot(S2.token))
await req(L.token, 'PUT', `/api/v1/activities/${quizOpen.id}`, { quiz: { ...lQuiz.quiz, attemptsAllowed: used } })
r = await req(S2.token, 'POST', `/api/v1/quizzes/${quizOpen.id}/attempts`)
await req(L.token, 'PUT', `/api/v1/activities/${quizOpen.id}`, { quiz: lQuiz.quiz })
ok('quiz: attempt limit enforced', r.status === 400, r.data?.error)
bl = await boot(L.token)
ok('quiz: lecturer sees student attempts', (bl.activity.attempts[quizOpen.id] ?? []).some((x) => x.userId === S2.userId))

// ── Feedback ──
const fb = by('Student Feedback Form')
r = await req(S2.token, 'POST', `/api/v1/feedback/${fb.id}/responses`, { q1: 4 })
ok('feedback: incomplete rejected', r.status === 400)
r = await req(S2.token, 'POST', `/api/v1/feedback/${fb.id}/responses`, { q1: 4, q2: 4, q3: 5, q4: 3, q5: 4, q6: 'E2E' })
const fbAgain = await req(S2.token, 'POST', `/api/v1/feedback/${fb.id}/responses`, { q1: 4, q2: 4, q3: 5, q4: 3, q5: 4 })
ok('feedback: submit once only', (r.status === 204 || r.status === 400) && fbAgain.status === 400)
bl = await boot(L.token)
ok('feedback: lecturer sees anonymous responses', (bl.activity.feedback[fb.id] ?? []).length > 0 && !('userId' in bl.activity.feedback[fb.id][0]))
bs = await boot(S.token)
ok('feedback: student cannot see responses', Object.keys(bs.activity.feedback).length === 0)

// ── Group choice ──
const ch = by('Assignment Group Enrollment')
const groups = bs.activity.groups[ch.id]
const full = groups.find((g) => g.members.length >= g.capacity), open = groups.find((g) => g.members.length < g.capacity)
if (full) { r = await req(S2.token, 'POST', `/api/v1/choices/${ch.id}/join`, { groupId: full.id }); ok('choice: full group rejected', r.status === 400) }
r = await req(S2.token, 'POST', `/api/v1/choices/${ch.id}/join`, { groupId: open.id })
ok('choice: join open group', r.status === 204)
r = await req(L.token, 'POST', `/api/v1/choices/${ch.id}/join`, { groupId: open.id })
ok('choice: lecturer cannot join', r.status === 400)
r = await req(S2.token, 'POST', `/api/v1/choices/${ch.id}/join`, { groupId: null })
ok('choice: leave group', r.status === 204)

// ── Calendar ──
r = await req(S.token, 'POST', '/api/v1/calendar/events', { title: 'E2E event', date: new Date().toISOString(), type: 'user', courseId: null })
const evId = r.data?.id
ok('calendar: student adds user event', r.status === 200)
r = await req(S.token, 'POST', '/api/v1/calendar/events', { title: 'x', date: new Date().toISOString(), type: 'site', courseId: null })
ok('calendar: student cannot add site event', r.status === 403)
r = await req(S2.token, 'DELETE', `/api/v1/calendar/events/${evId}`)
ok('calendar: cannot delete others event', r.status === 403)
r = await req(S.token, 'DELETE', `/api/v1/calendar/events/${evId}`)
ok('calendar: delete own event', r.status === 204)
r = await req(L.token, 'POST', '/api/v1/calendar/events', { title: 'E2E course event', date: new Date().toISOString(), type: 'course', courseId: course.id })
ok('calendar: lecturer adds course event', r.status === 200)
bs = await boot(S.token)
ok('calendar: student sees course event', bs.lms.events.some((e) => e.title === 'E2E course event'))
await req(L.token, 'DELETE', `/api/v1/calendar/events/${r.data.id}`)

// ── Messaging ──
r = await req(S.token, 'POST', '/api/v1/conversations', { userId: S2.userId })
const cv = r.data?.id
ok('messages: start private conversation', r.status === 200 && cv)
r = await req(S.token, 'POST', `/api/v1/conversations/${cv}/messages`, { text: 'Hi ' + stamp })
const mId = r.data?.id
ok('messages: send', r.status === 200)
let b2 = await boot(S2.token)
const c2 = b2.social.conversations.find((c) => c.id === cv)
ok('messages: recipient receives + unread', c2 && c2.unread > 0 && c2.messages.some((m) => m.text === 'Hi ' + stamp))
r = await req(L2.token, 'POST', `/api/v1/conversations/${cv}/messages`, { text: 'intrude' })
ok('messages: non-member cannot post', r.status === 403)
await req(S2.token, 'PUT', `/api/v1/conversations/${cv}/member`, { markRead: true })
await req(S2.token, 'PUT', `/api/v1/conversations/${cv}/member`, { starred: true, markRead: false })
b2 = await boot(S2.token)
ok('messages: mark read + star', b2.social.conversations.find((c) => c.id === cv)?.unread === 0 && b2.social.conversations.find((c) => c.id === cv)?.starred)
r = await req(S2.token, 'POST', `/api/v1/conversations/${cv}/delete-messages`, { messageIds: [mId] })
b2 = await boot(S2.token); bs = await boot(S.token)
ok('messages: delete for me only', !b2.social.conversations.find((c) => c.id === cv)?.messages.some((m) => m.id === mId) && bs.social.conversations.find((c) => c.id === cv)?.messages.some((m) => m.id === mId))
await req(S2.token, 'POST', `/api/v1/contacts/${S.userId}/block`)
r = await req(S.token, 'POST', `/api/v1/conversations/${cv}/messages`, { text: 'blocked?' })
ok('messages: blocked user cannot message', r.status === 400)
await req(S2.token, 'POST', `/api/v1/contacts/${S.userId}/unblock`)
r = await req(S.token, 'POST', `/api/v1/contacts/${S2.userId}/remove`)
r = await req(S.token, 'POST', `/api/v1/contacts/${S2.userId}/request`)
b2 = await boot(S2.token)
ok('contacts: request received', b2.social.requests.includes(S.userId))
await req(S2.token, 'POST', `/api/v1/contacts/${S.userId}/accept`)
bs = await boot(S.token)
ok('contacts: accepted both ways', bs.social.contacts.includes(S2.userId))
r = await req(S.token, 'DELETE', `/api/v1/conversations/${cv}`)
bs = await boot(S.token)
ok('messages: delete conversation (for me)', r.status === 204 && !bs.social.conversations.some((c) => c.id === cv))

// ── Notifications & prefs ──
const n1 = bs.social.notifications.find((n) => !n.read)
if (n1) { await req(S.token, 'PUT', `/api/v1/notifications/${n1.id}/read`); bs = await boot(S.token); ok('notifications: mark one read', bs.social.notifications.find((n) => n.id === n1.id)?.read) }
await req(S.token, 'PUT', '/api/v1/notifications/read-all')
bs = await boot(S.token)
ok('notifications: mark all read', bs.social.notifications.every((n) => n.read))
r = await req(S.token, 'PUT', '/api/v1/me/preferences', { prefs: { language: 'English (en)', hideBlocks: false }, social: { privacy: 'courses', enterToSend: true } })
bs = await boot(S.token)
ok('prefs: saved and returned', r.status === 204 && bs.prefs?.prefs?.language === 'English (en)')

// ── Password ──
r = await req(S2.token, 'POST', '/api/auth/change-password', { currentPassword: 'nope', newPassword: 'NewPass@1234' })
ok('password: wrong current rejected', r.status === 400)
r = await req(S2.token, 'POST', '/api/auth/change-password', { currentPassword: 'Student@123', newPassword: 'NewPass@1234' })
const relog = await login('gpadnilwala@students.altusvera.lk', 'NewPass@1234')
await req(relog?.token, 'POST', '/api/auth/change-password', { currentPassword: 'NewPass@1234', newPassword: 'Student@123' })
ok('password: change + login with new + revert', r.status === 200 && relog?.token)

// ── Registrar ──
r = await req(L.token, 'POST', '/api/v1/registrar/blocks', { studentIds: [S.userId], courseId: null, reason: 'x' })
ok('registrar: lecturer forbidden', r.status === 403)
r = await req(A.token, 'POST', '/api/v1/registrar/blocks', { studentIds: [S.userId], courseId: course.id, reason: 'Outstanding payment for coursework' })
ok('registrar: block course', r.status === 204)
r = await req(S.token, 'POST', `/api/v1/forums/${disc.id}/discussions`, { subject: 'x', message: 'x', pinned: false })
ok('registrar: blocked student cannot post', r.status === 403)
r = await req(S.token, 'POST', `/api/v1/activities/${res1.id}/completion`)
ok('registrar: blocked student cannot act', r.status === 403)
ba = await boot(A.token)
r = await req(A.token, 'PUT', '/api/v1/registrar/payments', { courseId: course.id, studentId: S.userId, paid: false })
r = await req(A.token, 'PUT', '/api/v1/registrar/payments', { courseId: course.id, studentId: S.userId, paid: true })
bs = await boot(S.token)
ok('registrar: payment lifts payment block', r.status === 204 && !bs.admin.courseBlocks[`${course.id}:${S.userId}`])
r = await req(A.token, 'POST', '/api/v1/registrar/blocks', { studentIds: [S.userId], courseId: null, reason: 'Disciplinary action' })
bs = await boot(S.token)
ok('registrar: account block visible to student', !!bs.admin.accountBlocks[S.userId])
await req(A.token, 'POST', '/api/v1/registrar/unblocks', { studentIds: [S.userId], courseId: null, all: true })
bs = await boot(S.token)
ok('registrar: unblock all', !bs.admin.accountBlocks[S.userId] && Object.keys(bs.admin.courseBlocks).length === 0)
r = await req(A.token, 'PUT', '/api/v1/registrar/settings/auto-block', { enabled: false })
ok('registrar: auto-block setting', r.status === 204)
const extra = ba.people.find((p) => p.role === 'Student' && !(ba.admin.enrolments[course.id] ?? []).includes(p.id))
r = await req(A.token, 'POST', '/api/v1/registrar/enrolments', { courseId: course.id, studentIds: [extra.id], remove: false })
const ext = await login(extra.email, 'Student@123')
let be = await boot(ext.token)
ok('registrar: enrol gives student the course', be.lms.courses.some((c) => c.id === course.id))
await req(A.token, 'POST', '/api/v1/registrar/enrolments', { courseId: course.id, studentIds: [extra.id], remove: true })
be = await boot(ext.token)
ok('registrar: unenrol removes course', !be.lms.courses.some((c) => c.id === course.id))
r = await req(A.token, 'PUT', `/api/v1/registrar/courses/${course.id}/lecturer`, { lecturerId: L2.userId })
let bl2 = await boot(L2.token)
ok('registrar: assign lecturer', bl2.lms.courses.some((c) => c.id === course.id))
await req(A.token, 'PUT', `/api/v1/registrar/courses/${course.id}/lecturer`, { lecturerId: L.userId })
const until = new Date(Date.now() + 3 * 864e5).toISOString()
r = await req(A.token, 'PUT', '/api/v1/registrar/submissions', { activityId: assignOpen.id, studentId: S.userId, grade: 91, feedback: 'Override', status: 'submitted', extensionUntil: until })
bl = await boot(L.token); bs = await boot(S.token)
ok('registrar: override grade visible + flagged', r.status === 204 && bs.lms.submissions[`${assignOpen.id}:${S.userId}`]?.grade === 91 && !!bl.admin.overrides[`${assignOpen.id}:${S.userId}`])
ok('registrar: extension visible to student', !!bs.admin.extensions[`${assignOpen.id}:${S.userId}`])
const s2Boot = await boot(S2.token)
const closedEmpty = all.find((a) => a.type === 'assign' && new Date(a.assign.cutOffDate) < new Date() && !(s2Boot.lms.submissions[`${a.id}:${S2.userId}`]?.files.length))
if (closedEmpty) {
  r = await req(S2.token, 'POST', `/api/v1/assignments/${closedEmpty.id}/files`, pdf(), true)
  ok('registrar: closed assignment rejects before extension', r.status === 400)
  await req(A.token, 'PUT', '/api/v1/registrar/submissions', { activityId: closedEmpty.id, studentId: S2.userId, grade: null, feedback: '', status: 'new', extensionUntil: until })
  r = await req(S2.token, 'POST', `/api/v1/assignments/${closedEmpty.id}/files`, pdf(), true)
  ok('registrar: extension lets student submit after cut-off', r.status === 200, r.data?.error)
  if (r.data?.id) await req(S2.token, 'DELETE', `/api/v1/submission-files/${r.data.id}`)
  await req(A.token, 'PUT', '/api/v1/registrar/submissions', { activityId: closedEmpty.id, studentId: S2.userId, grade: null, feedback: '', status: 'new', extensionUntil: null })
}
r = await req(A.token, 'POST', '/api/v1/registrar/payments/block-unpaid')
ok('registrar: block all unpaid', r.status === 200, `blocked ${r.data?.blocked}`)
const blockedNow = await boot(A.token)
await req(A.token, 'POST', '/api/v1/registrar/unblocks', { studentIds: blockedNow.people.map((p) => p.id), courseId: null, all: true })
ba = await boot(A.token)
ok('registrar: audit log records actions', ba.admin.audit.some((e) => e.kind === 'override') && ba.admin.audit.some((e) => e.kind === 'enrol') && ba.admin.audit.some((e) => e.kind === 'grade'))

// ── Analytics (if present) ──
r = await req(L.token, 'GET', '/api/v1/analytics/at-risk')
if (r.status !== 404) {
  ok('analytics: lecturer gets at-risk list', r.status === 200 && Array.isArray(r.data?.students), `${r.data?.students?.length} students`)
  ok('analytics: each has score + reasons', (r.data?.students ?? []).every((s) => typeof s.riskScore === 'number' && Array.isArray(s.reasons)))
  r = await req(S.token, 'GET', '/api/v1/analytics/at-risk')
  ok('analytics: student forbidden', r.status === 403)
  r = await req(S.token, 'GET', '/api/v1/analytics/me')
  ok('analytics: student gets own insights', r.status === 200 && typeof r.data?.riskScore === 'number')
  r = await req(A.token, 'GET', '/api/v1/analytics/at-risk')
  ok('analytics: registrar sees all courses', r.status === 200 && r.data?.courses?.length === 6)
}

await req(L.token, 'DELETE', `/api/v1/activities/${freshAssign}`)
const failed = results.filter((x) => !x.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(' - ' + f.name + (f.info ? ` (${f.info})` : ''))) }
