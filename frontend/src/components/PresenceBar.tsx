// Stacked colored avatars of the other collaborators on this board, each tinted
// with the viewer-resolved highlight color and showing what that person is doing
// (editing / uploading a node, or just viewing). Avatars pop in when someone
// joins and pop out when they leave.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ActivityKind, MemberActivity } from '../realtime'
import {
  AwayIcon,
  DownloadIcon,
  EyeIcon,
  MergeIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TransferIcon,
} from './icons'

const MAX = 5
const LEAVE_MS = 280

type Row = MemberActivity & { leaving?: boolean }

function UploadGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V6" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  )
}

// Badge glyph + tooltip verb per activity. `active` drives the pulsing ring
// (reserved for "doing something"; viewing/away are calm).
const META: Record<ActivityKind, { icon: ReactNode; verb: string; active: boolean }> = {
  viewing: { icon: <EyeIcon />, verb: 'viewing', active: false },
  editing: { icon: <PencilIcon />, verb: 'editing', active: true },
  uploading: { icon: <UploadGlyph />, verb: 'uploading', active: true },
  gallery: { icon: <SearchIcon />, verb: 'browsing the gallery', active: true },
  merging: { icon: <MergeIcon />, verb: 'merging boards', active: true },
  transferring: { icon: <TransferIcon />, verb: 'importing / exporting', active: true },
  creating: { icon: <PlusIcon />, verb: 'creating', active: true },
  renaming: { icon: <PencilIcon />, verb: 'renaming', active: true },
  downloading: { icon: <DownloadIcon />, verb: 'downloading', active: true },
  away: { icon: <AwayIcon />, verb: 'away', active: false },
}

function label(r: MemberActivity): string {
  const m = META[r.status] ?? META.viewing
  const detail = r.detail && (r.status === 'editing' || r.status === 'uploading') ? ` “${r.detail}”` : ''
  return `${r.username} — ${m.verb}${detail}`
}

export default function PresenceBar({ members }: { members: MemberActivity[] }) {
  const [rows, setRows] = useState<Row[]>([])
  const timers = useRef<Record<string, number>>({})

  // Diff incoming members into the displayed rows: present members refresh in
  // place; departed ones linger (leaving=true) so they can animate out.
  useEffect(() => {
    setRows((prev) => {
      const present = new Set(members.map((m) => m.id))
      const next: Row[] = members.map((m) => ({ ...m, leaving: false }))
      for (const r of prev) if (!present.has(r.id)) next.push({ ...r, leaving: true })
      return next
    })
  }, [members])

  // Schedule removal of leaving rows; cancel if a member returns.
  useEffect(() => {
    for (const r of rows) {
      if (!r.leaving && timers.current[r.id]) {
        window.clearTimeout(timers.current[r.id])
        delete timers.current[r.id]
      } else if (r.leaving && !timers.current[r.id]) {
        timers.current[r.id] = window.setTimeout(() => {
          setRows((rs) => rs.filter((x) => x.id !== r.id))
          delete timers.current[r.id]
        }, LEAVE_MS)
      }
    }
  }, [rows])

  useEffect(() => {
    const t = timers.current
    return () => Object.values(t).forEach((id) => window.clearTimeout(id))
  }, [])

  const shown = rows.slice(0, MAX)
  const extra = Math.max(0, members.length - MAX)

  return (
    <div className="presence">
      {shown.map((r) => {
        const meta = META[r.status] ?? META.viewing
        return (
          <span
            key={r.id}
            className={
              'presence__avatar' +
              (r.leaving ? ' presence__avatar--leaving' : '') +
              (meta.active ? ' presence__avatar--active' : '')
            }
            style={{ background: r.color, ['--c' as string]: r.color } as React.CSSProperties}
            title={label(r)}
            aria-label={label(r)}
          >
            {r.username.slice(0, 1).toUpperCase()}
            <span className="presence__badge" style={{ color: r.color }}>
              {meta.icon}
            </span>
          </span>
        )
      })}
      {extra > 0 && <span className="presence__avatar presence__avatar--more">+{extra}</span>}
    </div>
  )
}
