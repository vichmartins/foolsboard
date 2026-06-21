// Flat crown marking a board/folder the current user owns (and has shared out).
// Inherits its color from CSS (`.owner-crown`), so it matches the theme rather
// than the cartoonish 👑 emoji.
export default function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 7l4.5 4.5L12 5l4.5 6.5L21 7l-1.5 9.5h-15L3 7z"
      />
      <rect fill="currentColor" x="4.5" y="18" width="15" height="2" rx="1" />
    </svg>
  )
}
