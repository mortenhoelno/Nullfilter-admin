// components/ProgressBar.js
export default function ProgressBar({ ratio = 0, className = "" }) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div className={`h-3 w-full bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <div className="h-3 bg-indigo-500" style={{ width: `${pct.toFixed(1)}%` }} />
    </div>
  );
}
