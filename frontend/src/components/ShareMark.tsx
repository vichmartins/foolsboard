// Right-aligned sharing indicator for a board row/pill: a live presence dot
// followed by a two-person icon -- accent-coloured when you own and shared it
// out, grey when it's shared with you. The tooltip carries the detail.
import OwnerIcon from './OwnerIcon'
import { realtime } from '../realtime'

export default function ShareMark({
  boardId,
  memberIds,
  owner,
  title,
}: {
  boardId: string
  memberIds?: string[]
  owner: boolean
  title?: string
}) {
  const status = realtime.boardStatus(boardId, memberIds)
  return (
    <span className="share-mark" title={title}>
      <span className={'presence-dot presence-dot--' + status} aria-hidden="true" />
      <OwnerIcon className={owner ? 'owner-crown' : 'owner-crown owner-crown--recipient'} />
    </span>
  )
}
