import { WORLD_DISCOVERIES, type WorldDiscoveryId } from '../data/prologueWorldMeta'

interface CompassBarProps {
  yaw: number
  x: number
  z: number
  discoveriesFound: readonly WorldDiscoveryId[]
}

const CARDINALS = [
  { label: '北', deg: 0, major: true },
  { label: '东北', deg: 45, major: false },
  { label: '东', deg: 90, major: true },
  { label: '东南', deg: 135, major: false },
  { label: '南', deg: 180, major: true },
  { label: '西南', deg: -135, major: false },
  { label: '西', deg: -90, major: true },
  { label: '西北', deg: -45, major: false },
] as const

const HALF_FOV_DEG = 95

function wrapAngleRad(rad: number): number {
  let a = (rad + Math.PI) % (Math.PI * 2)
  if (a < 0) a += Math.PI * 2
  return a - Math.PI
}

export function CompassBar({ yaw, x, z, discoveriesFound }: CompassBarProps) {
  const discoveredSet = new Set(discoveriesFound)

  const landmarkMarkers = WORLD_DISCOVERIES.map((meta) => {
    const dx = meta.x - x
    const dz = meta.z - z
    const dist = Math.round(Math.hypot(dx, dz))
    const bearing = Math.atan2(dx, -dz)
    const relDeg = (wrapAngleRad(bearing - yaw) * 180) / Math.PI
    const found = discoveredSet.has(meta.id)
    return {
      meta,
      dist,
      relDeg,
      absDeg: Math.abs(relDeg),
      found,
      visible: Math.abs(relDeg) <= HALF_FOV_DEG,
      leftPct: 50 + (relDeg / HALF_FOV_DEG) * 46,
    }
  })

  const centeredTarget = landmarkMarkers
    .filter((item) => item.absDeg <= 22)
    .sort((a, b) => a.absDeg - b.absDeg)[0]

  const nearestUnseen = landmarkMarkers
    .filter((item) => !item.found)
    .sort((a, b) => a.dist - b.dist)[0]

  const focusItem = centeredTarget ?? nearestUnseen ?? null

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[62px] z-[26] hidden w-[min(410px,78vw)] -translate-x-1/2 select-none flex-col items-center sm:top-[68px] sm:flex"
      aria-label="草原地标罗盘"
    >
      <div className="relative h-6 w-full overflow-hidden">
        <div className="absolute inset-x-4 top-[13px] h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div
          className="absolute left-1/2 top-[9px] h-2 w-px -translate-x-1/2 bg-signal/85 shadow-[0_0_8px_rgba(242,194,139,0.9)]"
          aria-hidden="true"
        />

        {CARDINALS.map((c) => {
          const relDeg = (wrapAngleRad((c.deg * Math.PI) / 180 - yaw) * 180) / Math.PI
          if (Math.abs(relDeg) > HALF_FOV_DEG) return null
          const leftPct = 50 + (relDeg / HALF_FOV_DEG) * 46
          const edgeFade = 1 - Math.max(0, Math.abs(relDeg) - 68) / 28
          return (
            <span
              key={c.label}
              className={`absolute top-0 -translate-x-1/2 font-serif tracking-[0.06em] transition-[left] duration-75 ${
                c.major ? 'text-[10.5px] text-white/74' : 'text-[9.5px] text-white/42'
              }`}
              style={{ left: `${leftPct}%`, opacity: Math.max(0.15, edgeFade) }}
            >
              {c.label}
            </span>
          )
        })}

        {landmarkMarkers.map((item) => {
          if (!item.visible) return null
          return (
            <span
              key={item.meta.id}
              className={`cinema-gem absolute top-[10px] h-2 w-2 -translate-x-1/2 transition-[left] duration-75 ${
                item.found ? '' : 'animate-pulse border border-current bg-[#091224]/85'
              }`}
              style={{
                left: `${item.leftPct}%`,
                color: item.meta.accent,
                backgroundColor: item.found ? item.meta.accent : undefined,
                boxShadow: item.found ? `0 0 10px ${item.meta.accent}` : `0 0 6px ${item.meta.accent}`,
              }}
              title={`${item.meta.name} (${item.dist}m)`}
            />
          )
        })}
      </div>

      <div className="mt-0.5 flex items-center gap-2 rounded-full border border-white/10 bg-[#070f21]/45 px-2.5 py-0.5 backdrop-blur-sm">
        {focusItem ? (
          <>
            <span
              className="cinema-gem h-1.5 w-1.5 shrink-0"
              style={{
                backgroundColor: focusItem.meta.accent,
                boxShadow: `0 0 8px ${focusItem.meta.accent}`,
              }}
            />
            <span className="font-serif text-[10.5px] tracking-[0.04em] text-[#fff8ee]/86">
              {focusItem.found ? '✓ ' : ''}
              {focusItem.meta.name} · {focusItem.dist}m
            </span>
          </>
        ) : (
          <span className="font-serif text-[10.5px] tracking-[0.04em] text-signal/90">
            ✓ 草原遗迹已全部踏勘
          </span>
        )}
        <span className="h-2.5 w-px bg-white/15" />
        <span className="font-mono text-[10px] tracking-[0.08em] text-white/55">
          {discoveriesFound.length}/{WORLD_DISCOVERIES.length}
        </span>
      </div>
    </div>
  )
}
