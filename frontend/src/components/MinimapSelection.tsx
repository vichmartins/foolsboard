// Draws the in-progress shift-drag selection rectangle onto the minimap.
// React Flow's MiniMap doesn't expose this, so we overlay our own SVG using the
// minimap's own viewBox (which is in flow coordinates), keeping it aligned with
// the minimap nodes regardless of pan/zoom.
import type { Box } from '../boardOps'

export default function MinimapSelection({ rect }: { rect: Box }) {
  // The viewBox lives on the inner <svg>, not the .react-flow__minimap panel div.
  const svg = (document.querySelector('.react-flow__minimap-svg') ??
    document.querySelector('.react-flow__minimap svg')) as SVGSVGElement | null
  const vb = svg?.viewBox?.baseVal
  if (!svg || !vb || vb.width === 0) return null
  const screen = svg.getBoundingClientRect()
  const par = svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet'

  return (
    <svg
      className="minimap-selection"
      style={{ left: screen.left, top: screen.top, width: screen.width, height: screen.height }}
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      preserveAspectRatio={par}
    >
      <rect
        x={rect.minX}
        y={rect.minY}
        width={Math.max(0, rect.maxX - rect.minX)}
        height={Math.max(0, rect.maxY - rect.minY)}
      />
    </svg>
  )
}
