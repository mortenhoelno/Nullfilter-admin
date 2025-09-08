// components/StatCard.js
export default function StatCard({ label, value, sub, className = "" }) {
  return (
    <div className={`p-4 bg-gray-50 border rounded-2xl ${className}`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
      {sub ? <div className="text-sm text-gray-500 mt-1">{sub}</div> : null}
    </div>
  );
}
