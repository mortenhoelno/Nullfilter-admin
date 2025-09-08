// components/RagSnapshot.js
import StatCard from "./StatCard";

export default function RagSnapshot({ data, loading, error, onRefresh }) {
  return (
    <section className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">📚 RAG – snapshot</h2>
        <button onClick={onRefresh} className="px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm">
          Oppdater
        </button>
      </div>

      {loading && <div className="text-gray-500">Henter RAG-status…</div>}
      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700">Feil: {error}</div>}

      {data?.ok && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Totalt antall chunks" value={data.total_chunks} />
          <StatCard label="AI-chunks" value={data.ai_chunks} />
          <StatCard label="Master-chunks" value={data.master_chunks} />
          <StatCard
            label="Unike dokumenter"
            value={`AI: ${data?.unique_docs?.ai ?? 0} · Master: ${data?.unique_docs?.master ?? 0}`}
            sub={`Sum: ${data?.unique_docs?.total ?? 0}`}
          />
        </div>
      )}
    </section>
  );
}
