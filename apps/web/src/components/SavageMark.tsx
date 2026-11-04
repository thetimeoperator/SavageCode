import { useId, type SVGProps } from "react";

const CLAWS = [
  "M538 291Q411 495.7 370 733Q485.8 524.1 538 291Z",
  "M596 262Q459.7 494.4 428 762Q550.7 525 596 262Z",
  "M654 291Q527 495.7 486 733Q601.8 524.1 654 291Z",
];

/** The Savage Code mark: a `</>` whose slash is three claw marks. */
export function SavageMark({
  monochrome = false,
  ...props
}: SVGProps<SVGSVGElement> & { readonly monochrome?: boolean }) {
  const emberId = useId();
  return (
    <svg viewBox="190 240 644 544" xmlns="http://www.w3.org/2000/svg" {...props}>
      {monochrome ? null : (
        <defs>
          <linearGradient id={emberId} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-savage-ember-light)" />
            <stop offset="0.45" stopColor="var(--color-savage-ember)" />
            <stop offset="1" stopColor="var(--color-savage-ember-deep)" />
          </linearGradient>
        </defs>
      )}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={62}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="360,340 222,512 360,684" />
        <polyline points="664,340 802,512 664,684" />
      </g>
      <g fill={monochrome ? "currentColor" : `url(#${emberId})`}>
        {CLAWS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

/** Mark plus "Savage Code", sized by the surrounding font size. */
export function SavageWordmark(props: { readonly className?: string; readonly muted?: string }) {
  return (
    <span
      role="img"
      aria-label="Savage Code"
      className={`inline-flex min-w-0 items-center gap-1.5 tracking-tight ${props.className ?? ""}`}
    >
      <SavageMark aria-hidden className="h-[1.05em] w-auto shrink-0 text-foreground" />
      <span className="font-semibold text-foreground">Savage</span>
      <span className={props.muted ?? "text-muted-foreground"}>Code</span>
    </span>
  );
}
