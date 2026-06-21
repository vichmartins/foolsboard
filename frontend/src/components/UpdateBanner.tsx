// A gentle "a new version is available" prompt. It never force-reloads, so it
// can't interrupt in-progress work -- the user reloads when they're ready.
export default function UpdateBanner({
  onReload,
  onDismiss,
}: {
  onReload: () => void
  onDismiss: () => void
}) {
  return (
    <div className="update-banner" role="status">
      <span className="update-banner__text">A new version of foolsboard is available.</span>
      <button className="btn btn--primary update-banner__btn" onClick={onReload}>
        Reload
      </button>
      <button
        className="update-banner__dismiss"
        title="Dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  )
}
