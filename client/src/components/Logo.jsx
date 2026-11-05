export function Logo({ size = 38, tone = "dark", withWordmark = false, className = "" }) {
  const dark = tone === "dark";
  return (
    <span className={`logo ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SmartDine">
        <rect width="64" height="64" rx="17" fill={dark ? "#173d2c" : "#f7f0e2"} />
        <path d="M14 36.5h36c0 11.2-8 19-18 19s-18-7.8-18-19Z" fill={dark ? "#f4ead8" : "#173d2c"} />
        <path
          d="M10 36.5h44"
          stroke="#d6a34a"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M26 14c-3 4 3 6 0 10M34 11c-3 4 3 6 0 10M42 14c-3 4 3 6 0 10"
          stroke={dark ? "#f4ead8" : "#173d2c"}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {withWordmark ? (
        <span className="logo__wordmark">
          Smart<span>Dine</span>
        </span>
      ) : null}
    </span>
  );
}
