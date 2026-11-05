import Svg, { Path } from "react-native-svg"

import { colors } from "../../tokens"

// Lucide's icons inside a lesson, as the web's lucide-react draws them (24-unit grid, 2-unit round
// strokes), so a lesson looks the same on both. The app's frame uses the system's own icons
// (SF Symbols, through expo-symbols) instead.

type IconProps = { size?: number; color?: string; fill?: string }

function Icon({
  size = 16,
  color = colors.foreground,
  fill = "none",
  mirror = false,
  children,
}: IconProps & { mirror?: boolean; children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      {children}
    </Svg>
  )
}

/** A challenge from a friend, on the title screen (the web's SwordsIcon). */
export const SwordsIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M14.5 17.5 3.586 6.586A2 2 0 0 1 3 5.172V3h2.172a2 2 0 0 1 1.414.586L17.5 14.5" />
    <Path d="m13 19 6-6" />
    <Path d="m16 16 4 4" />
    <Path d="m19 21 2-2" />
    <Path d="m14.828 6.172 2.586-2.586A2 2 0 0 1 18.828 3H21v2.172a2 2 0 0 1-.586 1.414l-2.586 2.586" />
    <Path d="m5 14 4 4" />
    <Path d="M7.5 16.5 4 20" />
    <Path d="m5 21-2-2" />
  </Icon>
)

/** The challenge's verdict on the wrap-up (the web's TrophyIcon). */
export const TrophyIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" />
    <Path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" />
    <Path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" />
    <Path d="M4 22h16" />
    <Path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" />
    <Path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" />
  </Icon>
)
