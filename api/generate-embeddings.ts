// Dummy endring for å tvinge ny deploy

// api/generate-embeddings.ts
import { createClient } from '@supabase/supabase-js'

const openaiEndpoint = 'https://api.openai.com/v1/embeddings'
const openaiModel = 'text-embedding-ada-002'

export default async function handler(req: any, res: any) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing env vars' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Hent inntil 20 chunks uten embedding. (Juster limit som du vil)
    const { data: chunks, error } = await supabase
      .from('document_chunks')
      .select('id, content')
      .is('embedding', null)
      .limit(20)

    if (error) throw new Error('Feil ved henting av chunks: ' + error.message)
    if (!chunks || chunks.length === 0) {
      return res.status(200).json({ status: 'OK', message: 'Ingen nye chunks å embedde' })
    }

    for (const chunk of chunks) {
      const r = await fetch(openaiEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: chunk.content, model: openaiModel }),
      })

      const j = await r.json()
      const embedding = j?.data?.[0]?.embedding as number[] | undefined
      if (!embedding) {
        console.error('Embedding-feil for chunk', chunk.id, j)
        continue
      }

      const { error: upErr } = await supabase
        .from('document_chunks')
        .update({ embedding })
        .eq('id', chunk.id)

      if (upErr) console.error('Oppdateringsfeil for chunk', chunk.id, upErr)
    }

    return res.status(200).json({ status: 'OK', message: 'Embeddings generert ✅' })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: e.message ?? 'Ukjent feil' })
  }
}
