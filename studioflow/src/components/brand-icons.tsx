import { useId } from "react";

type IconProps = { size?: number; className?: string };

/** WhatsApp glyph (Simple Icons, CC0) in the official green. */
export function WhatsAppIcon({ size = 22, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`brand-icon ${className}`}
    >
      <path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      />
    </svg>
  );
}

/** Instagram app-style glyph with its gradient. */
export function InstagramIcon({ size = 22, className = "" }: IconProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`brand-icon ${className}`}
    >
      <defs>
        <radialGradient id={`${id}ig`} cx="0.3" cy="1.07" r="1.2">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.12" stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill={`url(#${id}ig)`} />
      <rect
        x="5.2"
        y="5.2"
        width="13.6"
        height="13.6"
        rx="4.2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="3.3"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
      />
      <circle cx="16.3" cy="7.7" r="1" fill="#fff" />
    </svg>
  );
}

/** Map pin in the colors people associate with "open in maps". */
export function MapPinIcon({ size = 22, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`brand-icon ${className}`}
    >
      <path
        fill="#EA4335"
        d="M12 1.5c-4.3 0-7.8 3.4-7.8 7.7 0 5.6 6.6 12 7.2 12.6.3.3.8.3 1.1 0 .6-.6 7.3-7 7.3-12.6 0-4.3-3.5-7.7-7.8-7.7Z"
      />
      <path
        fill="#B31412"
        opacity=".35"
        d="M12 1.5c4.3 0 7.8 3.4 7.8 7.7 0 5.6-6.7 12-7.3 12.6a.8.8 0 0 1-.5.2V1.5Z"
      />
      <circle cx="12" cy="9.2" r="2.9" fill="#fff" />
    </svg>
  );
}
