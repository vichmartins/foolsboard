// Outline crown marking a board/folder the current user owns (and has shared
// out). Drawn in the same Feather/line style as the app's other icons (see
// icons.tsx) so it fits the theme; color comes from CSS (`.owner-crown`).
export default function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8l3.8 3.2L12 5l5.2 6.2L21 8l-1.4 9.3H4.4L3 8z" />
    </svg>
  )
}
