export function LoupeMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="var(--accent)" />
      <circle cx="15.5" cy="15.5" r="6.5" stroke="var(--accent-foreground)" strokeWidth="2" />
      <line x1="20.2" y1="20.2" x2="26" y2="26" stroke="var(--accent-foreground)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
