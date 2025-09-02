'use client'

import { useState } from "react"

export default function AdminPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)
  const [uploadedDocs, setUploadedDocs] = useState<number[]>([])

  const documents = [
    { id: 1, title: "Din metode og filosofi", category: "Master", theme: "Grunnprinsipper, metaforer og stil" },
    { id: 2, title: "Veiledning: Vektnedgang", category: "Prosess", theme: "Vektnedgang, mat og trening" },
    { id: 3, title: "Veiledning: Mental helse", category: "Prosess", theme: "Tankekjør og følelsesregulering" },
    { id: 4, title: "Veiledning: Kombinert tilnærming", category: "Prosess", theme: "Mental helse og vekt sammen" },
    { id: 5, title: "Målgrupper: Vektnedgang", category: "Profil", theme: "Typiske avatarer for vektnedgang" },
    { id: 6, title: "Målgrupper: Mental helse", category: "Profil", theme: "Typiske avatarer for mental helse" },
    { id: 7, title: "Ledig", category: "", theme: "" },
    { id: 8, title: "Ledig", category: "", theme: "" },
    { id: 9, title: "Ledig", category: "", theme: "" },
    { id: 10, title: "Tema: Vektnedgang", category: "Tema", theme: "Vektnedgang" },
    { id: 11, title: "Tema: Trening", category: "Tema", theme: "Trening" },
    { id: 12, title: "Tema: Kosthold", category: "Tema", theme: "Kosthold" },
    { id: 13, title: "Tema: Endringspsykologi", category: "Tema", theme: "Endringspsykologi" },
    { id: 14, title: "Tema: Nevrobiologi", category: "Tema", theme: "Nevrobiologi" },
    { id: 15, title: "Tema: Bevissthet og underbevissthet", category: "Tema", theme: "Bevissthet og underbevissthet" },
    { id: 16, title: "Tema: Stress", category: "Tema", theme: "Stress og nervesystem" },
    { id: 17, title: "Tema: Sorg og livskriser", category: "Tema", theme: "Sorg og traumer" },
    { id: 18, title: "Tema: Faste", category: "Tema", theme: "Faste og metabolske prosesser" },
    { id: 19, title: "Tema: Sykdommer", category: "Tema", theme: "Psykisk og fysisk helse" },
    ...Array.from({ length: 21 }, (_, i) => {
      const id = i + 20
      const defined = {
        41: { title: "Q&A: Vektnedgang", category: "Q&A", theme: "Vanlige spørsmål og svar" },
        42: { title: "Q&A: Mental helse", category: "Q&A", theme: "Vanlige spørsmål og svar" }
      }[id]
      return { id, ...(defined ?? { title: "Ledig", category: "", theme: "" }) }
    }),
  ]

  const handleUpload = () => {
    if (!selectedFile || selectedDocId === null) return
    alert(`Laster opp dokument: ${selectedFile.name} som dokument #${selectedDocId}`)
    setUploadedDocs([...uploadedDocs, selectedDocId])
    setSelectedFile(null)
    setSelectedDocId(null)
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif', backgroundColor: '#f9f9f9' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 10 }}>🧠 NULL FILTER Chatbot</h1>
      <h2 style={{ fontSize: 22, fontWeight: 'normal', marginBottom: 30 }}>Admin-side for opplasting av dokumenter</h2>

      <h2 style={{ fontSize: 22, fontWeight: 'bold' }}>🗂️ Statusoversikt</h2>
      <table border={1} cellPadding={10} style={{ borderCollapse: 'collapse', marginTop: 20, width: '100%' }}>
        <thead>
          <tr style={{ backgroundColor: '#efefef' }}>
            <th>#</th>
            <th>Tittel</th>
            <th>Kategori</th>
            <th>Tema</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.id}</td>
              <td>{doc.title}</td>
              <td>{doc.category}</td>
              <td>{doc.theme}</td>
              <td style={{ textAlign: 'center' }}>{uploadedDocs.includes(doc.id) ? '✅' : '🔲'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={{ margin: '40px 0' }} />

      <p style={{ marginBottom: 10 }}>
        Velg dokumentnummer og last opp filen (.txt eller .md). Dette oppdaterer chatbotens kunnskapsbase med din struktur.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label>
          <strong>1. Velg dokumentnummer:</strong><br />
          <select
            onChange={(e) => setSelectedDocId(parseInt(e.target.value))}
            value={selectedDocId ?? ''}
            style={{ padding: 10, width: '100%', maxWidth: 400 }}
          >
            <option value="" disabled>Velg dokument…</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>#{doc.id} – {doc.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <strong>2. Velg fil (.txt eller .md):</strong><br />
          <input
            type="file"
            accept=".txt,.md"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            style={{ padding: 10 }}
          />
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!selectedFile || selectedDocId === null}
        style={{ background: '#2D88FF', color: 'white', padding: '10px 20px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Last opp dokument
      </button>

      <div style={{ marginTop: 40, padding: 20, background: '#fffbe6', borderRadius: 8 }}>
        <h3>💡 Dagens inspirasjonsquote</h3>
        <blockquote style={{ fontStyle: 'italic', marginTop: 10 }}>
          "Små justeringer i dag kan skape store forandringer i morgen."
        </blockquote>
        <p style={{ marginTop: 5 }}>– Nullfilter GPT</p>
      </div>
    </div>
  )
}
