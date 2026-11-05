import Svg, { Circle, Path } from "react-native-svg"

import { useDirection } from "@/components/direction"
import { colors } from "../../tokens"

// Lucide's icons the app's frame uses, as the web's lucide-react draws them (24-unit grid, 2-unit
// round strokes). Directional ones (the back chevron) mirror in right-to-left.

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

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
    <Circle cx={12} cy={12} r={3} />
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

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M20 6 9 17l-5-5" />
  </Icon>
)

export const LogOutIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m16 17 5-5-5-5" />
    <Path d="M21 12H9" />
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </Icon>
)
