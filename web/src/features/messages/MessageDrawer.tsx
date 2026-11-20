import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Search, Settings, Users, ChevronDown, ChevronLeft, Star, Send, MoreVertical, Ban, UserPlus, UserMinus, Trash2, BellOff, Bell, Check, CheckSquare } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { useSocialStore, PEOPLE, personName, type Conversation } from '../../store/socialStore'
import { useMe } from '../../store/activityStore'
import { Confirm } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { initials } from '../../lib/format'

type View = { kind: 'list' } | { kind: 'conv'; id: number } | { kind: 'contacts' } | { kind: 'settings' }

const convTitle = (c: Conversation, me: string) => (c.type === 'group' ? c.name : personName(c.members.find((m) => m !== me) ?? me))
const dayLabel = (iso: string) => { const d = new Date(iso); return isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, d MMMM yyyy') }

function Avatar({ name, size = 36, group }: { name: string; size?: number; group?: boolean }) {
  return <span className="rounded-full grid place-items-center font-bold shrink-0" style={{ width: size, height: size, fontSize: size * 0.34, background: group ? 'var(--color-accent-soft)' : 'var(--color-primary-soft)', color: group ? 'var(--color-accent)' : 'var(--color-primary)' }}>{group ? <Users size={size * 0.45} /> : initials(name)}</span>
}

function Section({ title, count, children, defaultOpen = true }: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider muted hover:bg-[var(--color-bg-subtle)]">
        <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />{title} <span className="ml-auto badge badge-gray">{count}</span>
      </button>
      {open && children}
    </div>
  )
}

export function MessageDrawer({ open, onClose, startWith }: { open: boolean; onClose: () => void; startWith?: string | null }) {
  const me = useMe()
  const st = useSocialStore()
  const [view, setView] = useState<View>({ kind: 'list' })
  const [q, setQ] = useState('')

  useEffect(() => {
    if (open && startWith) void st.startPrivate(me.id, startWith).then((id) => id && setView({ kind: 'conv', id }))
  }, [open, startWith]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = st.conversations.filter((c) => c.members.includes(me.id))
  const lastMsg = (c: Conversation) => c.messages[c.messages.length - 1]
  const sorted = [...mine].sort((a, b) => (lastMsg(b)?.at ?? '').localeCompare(lastMsg(a)?.at ?? ''))

  const searchResults = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return null
    return {
      people: PEOPLE.filter((p) => p.id !== me.id && p.name.toLowerCase().includes(t)),
      messages: mine.flatMap((c) => c.messages.filter((m) => m.text.toLowerCase().includes(t)).map((m) => ({ c, m }))),
    }
  }, [q, mine, me.id])

  if (!open) return null

  const row = (c: Conversation) => {
    const last = lastMsg(c); const title = convTitle(c, me.id)
    return (
      <button key={c.id} onClick={() => { st.markConvRead(c.id); setView({ kind: 'conv', id: c.id }) }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-bg-subtle)]">
        <Avatar name={title} group={c.type === 'group'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5"><span className="font-semibold text-sm truncate" style={{ color: 'var(--color-heading)' }}>{title}</span>{c.muted && <BellOff size={12} className="muted" />}<span className="ml-auto text-[11px] muted shrink-0">{last ? (isToday(new Date(last.at)) ? format(new Date(last.at), 'h:mm a') : format(new Date(last.at), 'd MMM')) : ''}</span></div>
          <div className="flex items-center gap-2"><span className="text-xs muted truncate flex-1">{last ? `${last.from === me.id ? 'You: ' : c.type === 'group' ? personName(last.from).split(' ')[0] + ': ' : ''}${last.text}` : 'No messages'}</span>{c.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white grid place-items-center" style={{ background: 'var(--color-primary)' }}>{c.unread}</span>}</div>
        </div>
      </button>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-[61] w-full max-w-[400px] flex flex-col border-l animate-in" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)', boxShadow: '-12px 0 40px var(--color-shadow)' }}>
        {view.kind === 'list' && (
          <>
            <div className="flex items-center gap-1 px-4 h-16 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-bold mr-auto">Messages</h2>
              <button className="icon-btn relative" title="Contacts" onClick={() => setView({ kind: 'contacts' })}><Users size={18} />{st.requests.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: 'var(--color-red)' }} />}</button>
              <button className="icon-btn" title="Settings" onClick={() => setView({ kind: 'settings' })}><Settings size={18} /></button>
              <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="p-3 shrink-0"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
            <div className="flex-1 overflow-y-auto">
              {searchResults ? (
                <>
                  <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider muted">Contacts and non-contacts</div>
                  {searchResults.people.length === 0 && <div className="px-4 py-2 text-sm muted">No results</div>}
                  {searchResults.people.map((p) => (
                    <button key={p.id} onClick={() => { setQ(''); void st.startPrivate(me.id, p.id).then((id) => id && setView({ kind: 'conv', id })) }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-bg-subtle)] text-left">
                      <Avatar name={p.name} size={32} /><span className="text-sm font-medium flex-1" style={{ color: 'var(--color-heading)' }}>{p.name}</span>{st.contacts.includes(p.id) && <span className="badge badge-blue">Contact</span>}{st.blocked.includes(p.id) && <span className="badge badge-red">Blocked</span>}
                    </button>
                  ))}
                  <div className="px-4 py-2 mt-2 text-xs font-bold uppercase tracking-wider muted">Messages</div>
                  {searchResults.messages.length === 0 && <div className="px-4 py-2 text-sm muted">No results</div>}
                  {searchResults.messages.map(({ c, m }) => (
                    <button key={m.id} onClick={() => { setQ(''); setView({ kind: 'conv', id: c.id }) }} className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-bg-subtle)]">
                      <div className="text-sm font-medium" style={{ color: 'var(--color-heading)' }}>{convTitle(c, me.id)}</div><div className="text-xs muted truncate">{m.text}</div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <Section title="Starred" count={sorted.filter((c) => c.starred).length}>{sorted.filter((c) => c.starred).map(row)}{!sorted.some((c) => c.starred) && <p className="px-4 pb-3 text-sm muted">No starred conversations</p>}</Section>
                  <Section title="Group" count={sorted.filter((c) => !c.starred && c.type === 'group').length}>{sorted.filter((c) => !c.starred && c.type === 'group').map(row)}{!sorted.some((c) => !c.starred && c.type === 'group') && <p className="px-4 pb-3 text-sm muted">No group conversations</p>}</Section>
                  <Section title="Private" count={sorted.filter((c) => !c.starred && c.type === 'private').length}>{sorted.filter((c) => !c.starred && c.type === 'private').map(row)}{!sorted.some((c) => !c.starred && c.type === 'private') && <p className="px-4 pb-3 text-sm muted">No private conversations</p>}</Section>
                </>
              )}
            </div>
          </>
        )}
        {view.kind === 'conv' && <ConversationView id={view.id} onBack={() => setView({ kind: 'list' })} onClose={onClose} />}
        {view.kind === 'contacts' && <ContactsView onBack={() => setView({ kind: 'list' })} onOpen={(pid) => void st.startPrivate(me.id, pid).then((id) => id && setView({ kind: 'conv', id }))} />}
        {view.kind === 'settings' && <SettingsView onBack={() => setView({ kind: 'list' })} onClose={onClose} />}
      </aside>
    </>
  )
}

function Header({ title, onBack, children }: { title: React.ReactNode; onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 h-16 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
      <button className="icon-btn" onClick={onBack} aria-label="Back"><ChevronLeft size={20} /></button>
      <div className="flex-1 min-w-0">{title}</div>
      {children}
    </div>
  )
}

function ConversationView({ id, onBack, onClose }: { id: number; onBack: () => void; onClose: () => void }) {
  const me = useMe()
  const st = useSocialStore()
  const c = st.conversations.find((x) => x.id === id)
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [confirm, setConfirm] = useState<null | 'block' | 'delete' | 'deleteSel'>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView() }, [c?.messages.length])
  if (!c) return null
  const other = c.type === 'private' ? c.members.find((m) => m !== me.id) ?? '' : ''
  const blocked = other && st.blocked.includes(other)
  const isContact = other && st.contacts.includes(other)
  const pending = other && st.sentRequests.includes(other)
  const title = convTitle(c, me.id)

  const send = () => {
    const t = text.trim(); if (!t) return
    if (blocked) return toast('You have blocked this user', 'error')
    st.send(c.id, me.id, t); setText('')
  }

  let lastDay = ''
  return (
    <>
      <Header onBack={onBack} title={<div className="flex items-center gap-2.5"><Avatar name={title} size={34} group={c.type === 'group'} /><div className="min-w-0"><div className="font-bold text-sm truncate" style={{ color: 'var(--color-heading)' }}>{title}</div><div className="text-[11px] muted">{c.type === 'group' ? `${c.members.length} participants` : blocked ? 'Blocked' : isContact ? 'Contact' : 'Not a contact'}</div></div></div>}>
        {selecting ? <button className="btn btn-ghost btn-sm" onClick={() => { setSelecting(false); setSelected([]) }}>Cancel</button> : (
          <div className="relative">
            <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="Conversation actions"><MoreVertical size={18} /></button>
            {menu && (
              <div className="dropdown-menu right-0 top-11 w-60" onClick={() => setMenu(false)}>
                <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => st.toggleStar(c.id)}><Star size={15} />{c.starred ? 'Unstar conversation' : 'Star conversation'}</button>
                <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => st.toggleMute(c.id)}>{c.muted ? <Bell size={15} /> : <BellOff size={15} />}{c.muted ? 'Unmute' : 'Mute'}</button>
                {other && !isContact && <button className="dropdown-item w-[calc(100%-12px)]" disabled={!!pending} onClick={() => { st.addContact(other); toast('Contact request sent') }}><UserPlus size={15} />{pending ? 'Contact request sent' : 'Add to contacts'}</button>}
                {other && isContact && <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => { st.removeContact(other); toast('Removed from contacts') }}><UserMinus size={15} />Remove from contacts</button>}
                {other && (blocked ? <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => { st.unblock(other); toast('User unblocked') }}><Ban size={15} />Unblock user</button> : <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => setConfirm('block')}><Ban size={15} />Block user</button>)}
                <button className="dropdown-item w-[calc(100%-12px)]" onClick={() => setSelecting(true)}><CheckSquare size={15} />Select messages</button>
                <button className="dropdown-item w-[calc(100%-12px)]" style={{ color: 'var(--color-red)' }} onClick={() => setConfirm('delete')}><Trash2 size={15} />Delete conversation</button>
              </div>
            )}
          </div>
        )}
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </Header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5" style={{ background: 'var(--color-bg-page)' }}>
        {c.messages.length === 0 && <div className="text-center text-sm muted py-10">No messages yet. Say hello!</div>}
        {c.messages.map((m) => {
          const day = dayLabel(m.at); const showDay = day !== lastDay; lastDay = day
          const mineMsg = m.from === me.id; const sel = selected.includes(m.id)
          return (
            <div key={m.id}>
              {showDay && <div className="text-center my-3"><span className="text-[11px] font-semibold muted px-3 py-1 rounded-full" style={{ background: 'var(--color-bg-subtle)' }}>{day}</span></div>}
              <div className={`flex gap-2 items-end ${mineMsg ? 'justify-end' : ''}`} onClick={() => selecting && setSelected(sel ? selected.filter((x) => x !== m.id) : [...selected, m.id])}>
                {selecting && <span className={`w-5 h-5 rounded-md border-2 grid place-items-center shrink-0 ${mineMsg ? 'order-last' : ''}`} style={{ borderColor: 'var(--color-primary)', background: sel ? 'var(--color-primary)' : 'transparent' }}>{sel && <Check size={12} color="#fff" strokeWidth={3} />}</span>}
                <div className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm ${mineMsg ? 'rounded-br-md text-white' : 'rounded-bl-md'} ${selecting ? 'cursor-pointer' : ''}`} style={{ background: mineMsg ? 'var(--color-primary)' : 'var(--color-bg-card)', color: mineMsg ? '#fff' : 'var(--color-heading)', border: mineMsg ? 'none' : '1px solid var(--color-border)' }}>
                  {c.type === 'group' && !mineMsg && <div className="text-[11px] font-bold mb-0.5" style={{ color: 'var(--color-accent)' }}>{personName(m.from)}</div>}
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  <div className={`text-[10px] mt-1 text-right ${mineMsg ? 'text-white/70' : 'muted'}`}>{format(new Date(m.at), 'h:mm a')}</div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>

      {selecting ? (
        <div className="p-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm muted mr-auto">{selected.length} selected</span>
          <button className="btn btn-danger btn-sm" disabled={!selected.length} onClick={() => setConfirm('deleteSel')}><Trash2 size={14} /> Delete selected messages</button>
        </div>
      ) : blocked ? (
        <div className="p-4 border-t text-center text-sm" style={{ borderColor: 'var(--color-border)' }}>You have blocked this user. <button className="font-semibold" style={{ color: 'var(--color-link)' }} onClick={() => st.unblock(other)}>Unblock user</button></div>
      ) : (
        <div className="p-3 border-t flex items-end gap-2" style={{ borderColor: 'var(--color-border)' }}>
          <textarea rows={1} className="form-control !h-auto min-h-[40px] max-h-32 resize-none" placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && st.enterToSend) { e.preventDefault(); send() } }} />
          <button className="btn btn-primary !w-10 !px-0 shrink-0" onClick={send} disabled={!text.trim()} aria-label="Send message"><Send size={17} /></button>
        </div>
      )}

      <Confirm open={confirm === 'block'} danger title="Block user" confirmLabel="Block" message={`Are you sure you want to block ${title}? They will not be able to message you.`} onConfirm={() => { st.block(other); toast('User blocked') }} onClose={() => setConfirm(null)} />
      <Confirm open={confirm === 'delete'} danger title="Delete conversation" confirmLabel="Delete" message="Are you sure you would like to delete this entire personal conversation? This will not delete it for other conversation participants." onConfirm={() => { st.deleteConversation(c.id); onBack(); toast('Conversation deleted') }} onClose={() => setConfirm(null)} />
      <Confirm open={confirm === 'deleteSel'} danger title="Delete messages" confirmLabel="Delete" message={`Are you sure you would like to delete the ${selected.length} selected message(s)? This will not delete them for other conversation participants.`} onConfirm={() => { st.deleteMessages(c.id, selected); setSelected([]); setSelecting(false); toast('Messages deleted') }} onClose={() => setConfirm(null)} />
    </>
  )
}

function ContactsView({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const st = useSocialStore()
  const [tab, setTab] = useState<'contacts' | 'requests'>('contacts')
  return (
    <>
      <Header onBack={onBack} title={<span className="font-bold" style={{ color: 'var(--color-heading)' }}>Contacts</span>} />
      <div className="flex border-b px-2" style={{ borderColor: 'var(--color-border)' }}>
        <button className={`tab ${tab === 'contacts' ? 'tab-active' : ''}`} onClick={() => setTab('contacts')}>Contacts</button>
        <button className={`tab ${tab === 'requests' ? 'tab-active' : ''}`} onClick={() => setTab('requests')}>Requests {st.requests.length > 0 && <span className="badge badge-red ml-1">{st.requests.length}</span>}</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'contacts' ? (
          st.contacts.length === 0 ? <p className="p-6 text-center text-sm muted">No contacts</p> : st.contacts.map((id) => (
            <button key={id} onClick={() => onOpen(id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-subtle)] text-left"><Avatar name={personName(id)} size={34} /><span className="font-medium text-sm" style={{ color: 'var(--color-heading)' }}>{personName(id)}</span></button>
          ))
        ) : (
          st.requests.length === 0 ? <p className="p-6 text-center text-sm muted">No contact requests</p> : st.requests.map((id) => (
            <div key={id} className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-3 mb-3"><Avatar name={personName(id)} size={34} /><div><div className="font-medium text-sm" style={{ color: 'var(--color-heading)' }}>{personName(id)}</div><div className="text-xs muted">Would like to contact you</div></div></div>
              <div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => { st.acceptRequest(id); toast('Added to contacts') }}>Accept and add to contacts</button><button className="btn btn-secondary btn-sm" onClick={() => st.declineRequest(id)}>Decline</button></div>
            </div>
          ))
        )}
        {st.blocked.length > 0 && tab === 'contacts' && (
          <div className="mt-4"><div className="px-4 py-2 text-xs font-bold uppercase tracking-wider muted">Blocked users</div>
            {st.blocked.map((id) => <div key={id} className="flex items-center gap-3 px-4 py-2.5"><Avatar name={personName(id)} size={30} /><span className="text-sm flex-1" style={{ color: 'var(--color-heading)' }}>{personName(id)}</span><button className="btn btn-secondary btn-sm" onClick={() => st.unblock(id)}>Unblock</button></div>)}
          </div>
        )}
      </div>
    </>
  )
}

function SettingsView({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const st = useSocialStore()
  return (
    <>
      <Header onBack={onBack} title={<span className="font-bold" style={{ color: 'var(--color-heading)' }}>Settings</span>} />
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <section>
          <h3 className="font-bold mb-1">Privacy</h3>
          <p className="text-xs muted mb-3">You can restrict who can message you</p>
          {([['contacts', 'My contacts only'], ['courses', 'My contacts and anyone in my courses']] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-3 py-2 cursor-pointer text-sm" style={{ color: 'var(--color-heading)' }}><input type="radio" name="privacy" checked={st.privacy === v} onChange={() => st.setPrivacy(v)} className="accent-[var(--color-primary)]" />{l}</label>
          ))}
        </section>
        <section>
          <h3 className="font-bold mb-2">Notification preferences</h3>
          <Link to="/preferences/notifications" onClick={onClose} className="text-sm font-semibold">Manage notification preferences</Link>
        </section>
        <section>
          <h3 className="font-bold mb-2">General</h3>
          <label className="flex items-center justify-between cursor-pointer"><span className="text-sm" style={{ color: 'var(--color-heading)' }}>Use enter to send</span><button className="switch" data-on={st.enterToSend} onClick={() => st.setEnterToSend(!st.enterToSend)} aria-label="Use enter to send" /></label>
        </section>
      </div>
    </>
  )
}
