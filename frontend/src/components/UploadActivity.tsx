// Top-bar chips showing collaborators who are uploading media to this board,
// each with an indeterminate loading bar in the uploader's presence color.
import type { BoardUpload } from '../realtime'

export default function UploadActivity({ uploads }: { uploads: BoardUpload[] }) {
  if (uploads.length === 0) return null
  return (
    <div className="uploads">
      {uploads.map((u) => (
        <div className="upload-chip" key={u.userId} title={`${u.username} is uploading`}>
          <div className="upload-chip__row">
            <span className="upload-chip__dot" style={{ background: u.color }} />
            <span className="upload-chip__text">
              {u.username} uploading{u.count > 1 ? ` ${u.count} files` : '…'}
            </span>
          </div>
          <span className="upload-chip__bar">
            <span className="upload-chip__fill" style={{ background: u.color }} />
          </span>
        </div>
      ))}
    </div>
  )
}
