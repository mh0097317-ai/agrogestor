import { createElement } from "react";
import {
  Eye,
  HandPalm,
  Heart,
  Scissors,
  Sparkle,
  User,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconWeight } from "@phosphor-icons/react";

/** Icon that represents a business segment when there is no logo or photo. */
export function segmentIcon(category = ""): Icon {
  if (/nail|unha|manicure/i.test(category)) return HandPalm;
  if (/lash|cílio|cilio|sobrancelha/i.test(category)) return Eye;
  if (/estética|estetica/i.test(category)) return Heart;
  if (/autônomo|autonomo/i.test(category)) return User;
  if (/barbe|cabele|cabelo/i.test(category)) return Scissors;
  return Sparkle;
}

/** Renders the segment icon; avoids creating component types during render. */
export function SegmentIcon({
  category,
  size = 24,
  weight = "duotone",
  className,
}: {
  category?: string;
  size?: number;
  weight?: IconWeight;
  className?: string;
}) {
  return createElement(segmentIcon(category), { size, weight, className });
}
