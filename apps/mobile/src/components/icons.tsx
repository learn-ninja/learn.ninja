import Svg, { Circle, Path } from "react-native-svg"

import { useDirection } from "@/components/direction"
import { colors } from "../../tokens"

// Lucide's icons, as the web's lucide-react draws them (24-unit grid, 2-unit round strokes), for a
// lesson and for the React Native lesson menu and Settings off iOS; on iOS the app's frame uses the
// system's own icons (SF Symbols, through expo-symbols), with these as their `fallback` elsewhere
// (Android has no SF Symbols). Directional ones (the back chevron) mirror in right-to-left.

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

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <Circle cx={12} cy={12} r={3} />
  </Icon>
)

export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M18 6 6 18" />
    <Path d="m6 6 12 12" />
  </Icon>
)

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

export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" />
  </Icon>
)

export const BanIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={12} cy={12} r={10} />
    <Path d="M4.929 4.929 19.07 19.071" />
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

/** GitHub's mark, filled, as the web's GitHubLogo (components/site/social-icons.tsx). */
export function GitHubLogo({
  size = 16,
  color = colors.foreground,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </Svg>
  )
}
