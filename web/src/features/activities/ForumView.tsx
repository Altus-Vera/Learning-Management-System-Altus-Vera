import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pin, Lock, Star, Bell, BellOff, ChevronLeft, Reply, Pencil, Trash2, MessageSquare, Search, Unlock, PinOff, BarChart3 } from 'lucide-react'
import { ForumAnalytics } from './ForumAnalytics'
import { formatDistanceToNow } from 'date-fns'
import { useActivityStore, seedDiscussions, useMe, type Discussion, type ForumPost } from '../../store/activityStore'
import type { Activity } from '../../store/lmsStore'
import { Modal, Confirm } from '../../components/Modal'
import { toast } from '../../components/Toast'
import { fmtDate, fmtShort, initials } from '../../lib/format'

export function ForumView({ a }: { a: Activity }) {
  const me = useMe()
  const news = a.name === 'Announcements'
  const stored = useActivityStore((s) => s.forums[a.id])
  const discussions = stored ?? seedDiscussions(news)
  const st = useActivityStore()
  const subscribed = useActivityStore((s) => s.subscriptions[a.id] ?? news)
  const [openId, setOpenId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [pin, setPin] = useState(false)
  const [q, setQ] = useState('')
  const canPost = !news || me.teacher
  const [view, setView] = useState<'discussions' | 'analytics'>('discussions')

  const sorted = useMemo(() => {
    const t = q.trim().toLowerCase()
    const last = (d: Discussion) => d.posts[d.posts.length - 1]?.at ?? d.createdAt
    return discussions
      .filter((d) => !t || d.subject.toLowerCase().includes(t) || d.posts.some((p) => p.message.toLowerCase().includes(t)))
      .sort((x, y) => Number(y.pinned) - Number(x.pinned) || Number(!!st.starredDiscussions[y.id]) - Number(!!st.starredDiscussions[x.id]) || last(y).localeCompare(last(x)))
  }, [discussions, q, st.starredDiscussions])

  const open = discussions.find((d) => d.id === openId)
  if (open) return <DiscussionView forumId={a.id} news={news} d={open} onBack={() => setOpenId(null)} />

  const tabs = me.teacher && (
    <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
      {([['discussions', 'Discussions', MessageSquare], ['analytics', 'Analytics', BarChart3]] as const).map(([k, l, Icon]) => (
        <button key={k} className={`tab flex items-center gap-2 ${view === k ? 'tab-active' : ''}`} onClick={() => setView(k)}><Icon size={15} />{l}</button>
      ))}
    </div>
  )
  if (me.teacher && view === 'analytics') return <div className="space-y-4">{tabs}<ForumAnalytics a={a} onOpenDiscussion={(id) => { setView('discussions'); setOpenId(id) }} /></div>

  return (
    <div className="space-y-4">
      {tabs}
      {a.description && <p className="muted">{a.description}</p>}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="relative mr-auto"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 muted" /><input className="form-control pl-9 !h-9 !w-60" placeholder="Search forums" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <button className="btn btn-secondary btn-sm" onClick={() => { st.toggleSubscription(a.id); toast(subscribed ? 'You will no longer receive email copies of posts' : 'You will be notified of new posts') }}>{subscribed ? <><BellOff size={14} /> Unsubscribe from forum</> : <><Bell size={14} /> Subscribe to forum</>}</button>
          {canPost && <button className="btn btn-primary btn-sm" onClick={() => { setSubject(''); setMessage(''); setPin(false); setAdding(true) }}><Plus size={15} /> {news ? 'Add a new announcement' : 'Add discussion topic'}</button>}
        </div>
        <div className="px-4 py-2 text-xs muted">List of discussions. Showing {sorted.length} of {discussions.length} discussions</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider muted" style={{ background: 'var(--color-bg-subtle)' }}>
              <th className="px-4 py-3 w-16">Status</th><th className="px-4 py-3">Discussion</th><th className="px-4 py-3">Started by</th><th className="px-4 py-3">Last post</th><th className="px-4 py-3">Replies</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {sorted.map((d) => {
                const last = d.posts[d.posts.length - 1]
                const starred = !!st.starredDiscussions[d.id]
                return (
                  <tr key={d.id} className="border-t hover:bg-[var(--color-bg-card-hover)]" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3"><div className="flex gap-1">{d.pinned && <span title="Pinned"><Pin size={15} style={{ color: 'var(--color-primary)' }} /></span>}{d.locked && <span title="Locked"><Lock size={15} className="muted" /></span>}{starred && <span title="Starred"><Star size={15} fill="var(--color-amber)" color="var(--color-amber)" /></span>}</div></td>
                    <td className="px-4 py-3"><button onClick={() => setOpenId(d.id)} className="font-semibold text-left hover:underline" style={{ color: 'var(--color-heading)' }}>{d.subject}</button></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{initials(d.author)}</span><span>{d.author}<span className="block text-xs muted">{fmtShort(d.createdAt).split(',')[0]}</span></span></div></td>
                    <td className="px-4 py-3"><span className="block">{last.author}</span><span className="text-xs muted">{formatDistanceToNow(new Date(last.at), { addSuffix: true })}</span></td>
                    <td className="px-4 py-3"><span className="badge badge-gray"><MessageSquare size={12} />{d.posts.length - 1}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-0.5">
                      <button className="icon-btn !w-8 !h-8" title={starred ? 'Unstar this discussion' : 'Star this discussion'} onClick={() => st.toggleStarDiscussion(d.id)}><Star size={15} fill={starred ? 'var(--color-amber)' : 'none'} color={starred ? 'var(--color-amber)' : 'currentColor'} /></button>
                      {me.teacher && <>
                        <button className="icon-btn !w-8 !h-8" title={d.pinned ? 'Unpin' : 'Pin'} onClick={() => { if (!stored) useActivityStore.setState((s) => ({ forums: { ...s.forums, [a.id]: discussions } })); st.setDiscussionFlag(a.id, d.id, 'pinned', !d.pinned) }}>{d.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
                        <button className="icon-btn !w-8 !h-8" title={d.locked ? 'Unlock' : 'Lock'} onClick={() => { if (!stored) useActivityStore.setState((s) => ({ forums: { ...s.forums, [a.id]: discussions } })); st.setDiscussionFlag(a.id, d.id, 'locked', !d.locked) }}>{d.locked ? <Unlock size={15} /> : <Lock size={15} />}</button>
                      </>}
                    </div></td>
                  </tr>
                )
              })}
              {sorted.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center muted">{discussions.length ? 'No discussions match your search' : `(No ${news ? 'announcements' : 'discussion topics'} have been posted yet.)`}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={adding} title={news ? 'Add a new announcement' : 'Add discussion topic'} onClose={() => setAdding(false)} width={640}
        footer={<><button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" disabled={!subject.trim() || !message.trim()} onClick={() => { st.addDiscussion(a.id, news, subject.trim(), message.trim(), pin); setAdding(false); toast('Your post was successfully added') }}>Post to forum</button></>}>
        <div className="space-y-4">
          <div><label className="form-label">Subject *</label><input className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus maxLength={255} /></div>
          <div><label className="form-label">Message *</label><textarea rows={7} className="form-control" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
          {me.teacher && <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-heading)' }}><input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} className="w-4 h-4" /> Pinned</label>}
        </div>
      </Modal>
    </div>
  )
}

function DiscussionView({ forumId, news, d, onBack }: { forumId: number; news: boolean; d: Discussion; onBack: () => void }) {
  const me = useMe()
  const st = useActivityStore()
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [del, setDel] = useState<ForumPost | null>(null)
  const [delDisc, setDelDisc] = useState(false)
  const canReply = !d.locked && (!news || me.teacher)
  const ensure = () => { if (!useActivityStore.getState().forums[forumId]) useActivityStore.setState((s) => ({ forums: { ...s.forums, [forumId]: seedDiscussions(news) } })) }

  const children = (pid: number | null) => d.posts.filter((p) => p.parentId === pid)
  const renderPost = (p: ForumPost, depth: number): React.ReactNode => (
    <div key={p.id} style={{ marginLeft: Math.min(depth, 4) * 28 }} className="space-y-3">
      <article className="card p-5">
        <div className="flex items-start gap-3">
          <Link to={p.authorId.startsWith('s') || p.authorId.startsWith('l') ? `/user/${p.authorId}` : '#'} className="w-10 h-10 rounded-full grid place-items-center text-xs font-bold shrink-0" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>{initials(p.author)}</Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold" style={{ color: 'var(--color-heading)' }}>{depth === 0 ? d.subject : `Re: ${d.subject}`}</div>
            <div className="text-xs muted">by {p.author} - {fmtDate(p.at)}</div>
            {editing === p.id ? (
              <div className="mt-3 space-y-2"><textarea rows={4} className="form-control" value={text} onChange={(e) => setText(e.target.value)} /><div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={() => { ensure(); st.editPost(forumId, d.id, p.id, text.trim()); setEditing(null); toast('Post updated') }}>Save changes</button><button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button></div></div>
            ) : <p className="mt-3 whitespace-pre-wrap leading-relaxed">{p.message}</p>}
            <div className="flex gap-1 mt-3 -ml-2">
              {canReply && <button className="btn btn-ghost btn-sm" onClick={() => { setReplyTo(p.id); setText('') }}><Reply size={14} /> Reply</button>}
              {(p.authorId === me.id || me.teacher) && editing !== p.id && <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(p.id); setText(p.message) }}><Pencil size={14} /> Edit</button>}
              {(p.authorId === me.id || me.teacher) && depth > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setDel(p)}><Trash2 size={14} /> Delete</button>}
            </div>
            {replyTo === p.id && (
              <div className="mt-3 space-y-2"><textarea rows={4} className="form-control" placeholder="Write your reply…" value={text} onChange={(e) => setText(e.target.value)} autoFocus /><div className="flex gap-2"><button className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={() => { st.reply(forumId, news, d.id, p.id, text.trim()); setReplyTo(null); toast('Your post was successfully added') }}>Post to forum</button><button className="btn btn-secondary btn-sm" onClick={() => setReplyTo(null)}>Cancel</button></div></div>
            )}
          </div>
        </div>
      </article>
      {children(p.id).map((c) => renderPost(c, depth + 1))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost btn-sm mr-auto" onClick={onBack}><ChevronLeft size={16} /> Back to discussions</button>
        {d.locked && <span className="badge badge-gray"><Lock size={12} /> This discussion has been locked so you can no longer reply to it.</span>}
        {me.teacher && <>
          <button className="btn btn-secondary btn-sm" onClick={() => { ensure(); st.setDiscussionFlag(forumId, d.id, 'pinned', !d.pinned) }}>{d.pinned ? <><PinOff size={14} /> Unpin</> : <><Pin size={14} /> Pin</>}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { ensure(); st.setDiscussionFlag(forumId, d.id, 'locked', !d.locked) }}>{d.locked ? <><Unlock size={14} /> Unlock</> : <><Lock size={14} /> Lock</>}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setDelDisc(true)}><Trash2 size={14} /> Delete discussion</button>
        </>}
      </div>
      {children(null).map((p) => renderPost(p, 0))}
      <Confirm open={!!del} danger title="Delete post" confirmLabel="Delete" message="Are you sure you want to delete this post and all its replies?" onConfirm={() => { ensure(); st.deletePost(forumId, d.id, del!.id); toast('Post deleted') }} onClose={() => setDel(null)} />
      <Confirm open={delDisc} danger title="Delete discussion" confirmLabel="Delete" message={`Are you sure you want to delete the discussion “${d.subject}” and all its posts?`} onConfirm={() => { ensure(); st.deleteDiscussion(forumId, d.id); onBack(); toast('Discussion deleted') }} onClose={() => setDelDisc(false)} />
    </div>
  )
}
