// ferdig versjon
import { getSupabaseServer } from "../../../utils/supabaseServer";
import { embedOne } from "../../../utils/embeddings";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }
  try {
    const { query, topK = 8, filterDocId = null } = req.body || {};
    if (!query || !query.trim()) return res.status(400).json({ error: "query is required" });

    const embedding = await embedOne(query);
    const supabase = getSupabaseServer();

    // Kall SQL-funksjonen vi lagde i migrasjonen
    const { data, error } = await supabase.rpc("match_rag_chunks", {
      query_embedding: embedding,
      match_count: topK,
      filter_doc_id: filterDocId
    });

    if (error) throw error;

    return res.status(200).json({ matches: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
