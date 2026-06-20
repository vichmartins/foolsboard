// Stacked colored avatars of the other collaborators currently viewing this
// board. Hidden when you're the only one here.
import type { PresenceMember } from '../realtime'

const MAX = 5

export default function PresenceBar({ members }: { members: PresenceMember[] }) {
  // The container always renders (even when empty) so it stays the stable anchor
  // for the top bar's right-hand cluster.
  const shown = members.slice(0, MAX)
  const extra = members.length - shown.length
  const label = members.map((m) => m.username).join(', ')
  return (
    <div
      className="presence"
      title={members.length ? `Here now: ${label}` : undefined}
      aria-label={members.length ? `Here now: ${label}` : undefined}
    >
      {shown.map((m) => (
        <span key={m.id} className="presence__avatar" style={{ background: m.color }}>
          {m.username.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {extra > 0 && <span className="presence__avatar presence__avatar--more">+{extra}</span>}
    </div>
  )
}
