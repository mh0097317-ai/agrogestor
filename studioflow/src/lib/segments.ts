import { createElement } from "react";
import {
  Eye,
  Hand,
  Heart,
  Scissors,
  Sparkles,
  UserRound,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/** Icon that represents a business segment when there is no logo or photo. */
export function segmentIcon(category = ""): LucideIcon {
  if (/nail|unha|manicure/i.test(category)) return Hand;
  if (/lash|cílio|cilio|sobrancelha/i.test(category)) return Eye;
  if (/estética|estetica/i.test(category)) return Heart;
  if (/autônomo|autonomo/i.test(category)) return UserRound;
  if (/barbe|cabele|cabelo/i.test(category)) return Scissors;
  return Sparkles;
}

/** Renders the segment icon; avoids creating component types during render. */
export function SegmentIcon({
  category,
  ...props
}: LucideProps & { category?: string }) {
  return createElement(segmentIcon(category), props);
}
