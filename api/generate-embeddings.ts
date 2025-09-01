import { NextRequest, NextResponse } from 'next/server'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: NextRequest) {
  const SUPABASE_URL = process.env.SUPABASE_URL!
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!
  const openaiEndpoint = 'https://api.openai.com/v1/embeddings'
  const openaiModel = 'text-embedding-ada-002'

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Hent chunks uten embedding
    const { data: chunks, error } = await supabase
      .from('document_chunks')
      .select('id, content')
      .is('embedding', null)
      .limit(20)

    if (error) throw new Error('Feil ved henting av chunks: ' + error.message)

    for (const chunk of chunks) {
      const response = await fetch(openaiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: chunk.content,
          model: openaiModel
        })
      })

      const json = await response.json()

      if (!json?.data?.[0]?.embedding) {
        console.error('Feil ved embedding:', json)
        continue
      }

      const embedding = json.data[0].embedding

      const { error: updateError } = await supabase
        .from('document_chunks')
        .update({ embedding })
        .eq('id', chunk.id)

      if (updateError) {
        console.error(`Feil ved oppdatering av chunk ${chunk.id}:`, updateError)
      } else {
        console.log(`✅ Oppdatert chunk ${chunk.id}`)
      }
    }

    return NextResponse.json({ status: 'OK', message: 'Embeddings generert ✅' })

  } catch (err: any) {
    console.error('Feil:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
