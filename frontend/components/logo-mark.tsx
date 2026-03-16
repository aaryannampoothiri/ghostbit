type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className = "h-9 w-9" }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="41" height="41" rx="12" fill="rgba(16,185,129,0.16)" stroke="rgba(52,211,153,0.45)" />
      <path d="M16 17.5H26.5C29.2 17.5 31.5 19.7 31.5 22.5C31.5 25.2 29.2 27.5 26.5 27.5H16V17.5Z" stroke="currentColor" strokeWidth="2" className="text-emerald-300" />
      <path d="M16 27.5H24.5C27.3 27.5 29.5 29.8 29.5 32.5C29.5 35.3 27.3 37.5 24.5 37.5H16V27.5Z" stroke="currentColor" strokeWidth="2" className="text-emerald-300" />
      <circle cx="33.5" cy="13.5" r="2" fill="currentColor" className="text-emerald-400" />
    </svg>
  );
}
