import Svg, { Circle, Path } from "react-native-svg"

import { useDirection } from "@/components/direction"
import { colors } from "../../tokens"

// Lucide's icons, as the web's lucide-react draws them (24-unit grid, 2-unit round strokes), for a
// lesson and for the React Native lesson menu and Settings off iOS; on iOS the app's frame uses the
// system's own icons (SF Symbols, through expo-symbols). Directional ones (the back chevron)
// mirror in right-to-left.

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

/** The way back, pointing to the start side. */
export function BackIcon(p: IconProps) {
  // React Native never mirrors a drawing, so it's turned here (the web's rtl:-scale-x-100).
  const mirror = useDirection() === "rtl"
  return (
    <Icon {...p} mirror={mirror}>
      <Path d="m15 18-6-6 6-6" />
    </Icon>
  )
}

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 2v13" />
    <Path d="m16 6-4-4-4 4" />
    <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
  </Icon>
)

export const RestartIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
  </Icon>
)

export const TypeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 4v16" />
    <Path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
    <Path d="M9 20h6" />
  </Icon>
)

export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={10} />
    <Path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <Path d="M2 12h20" />
  </Icon>
)

export const EllipsisIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={1} />
    <Circle cx={19} cy={12} r={1} />
    <Circle cx={5} cy={12} r={1} />
  </Icon>
)

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M20 6 9 17l-5-5" />
  </Icon>
)

/** Log out: the arrow leaves toward the end side. */
export function LogOutIcon(p: IconProps) {
  return (
    <Icon {...p} mirror={useDirection() === "rtl"}>
      <Path d="m16 17 5-5-5-5" />
      <Path d="M21 12H9" />
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Icon>
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
