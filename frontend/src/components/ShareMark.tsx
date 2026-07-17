// Right-aligned sharing indicator for a board row/pill: a live presence dot
// followed by a person icon -- one person when you own and shared it out, two
// people when it's shared with you. It's accent-coloured only while its row is
// selected/active, otherwise muted. The tooltip carries the detail.
import OwnerIcon from './OwnerIcon'
import { realtime } from '../realtime'

export default function ShareMark({
  boardId,
  memberIds,
  owner,
  active,
  title,
}: {
  boardId: string
  memberIds?: string[]
  owner: boolean
  active?: boolean // this row is the selected/active board -> tint accent
  title?: string
}) {
  const status = realtime.boardStatus(boardId, memberIds)
  return (
    <span className="share-mark" title={title}>
      <span className={'presence-dot presence-dot--' + status} aria-hidden="true" />
      <OwnerIcon solo={owner} className={active ? 'owner-crown' : 'owner-crown owner-crown--recipient'} />
    </span>
  )
}
