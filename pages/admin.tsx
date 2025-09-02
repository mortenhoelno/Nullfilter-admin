import { useState } from "react"

export default function AdminPage() {
  const [selectedAIDoc, setSelectedAIDoc] = useState<File | null>(null)
  const [selectedMasterDoc, setSelectedMasterDoc] = useState<File | null>(null)
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null)
  const [uploadedAIDocs, setUploadedAIDocs] = useState<number[]>([])
  const [uploadedMasterDocs, setUploadedMasterDocs] = useState<number[]>([])

  const documents = Array.from({ length: 50 }, (_, i) => {
    const id = i + 1
    if (id === 1) return { id, title: "Din metode og filosofi", category: "Master", theme: "Grunnprinsipper, metaforer og stil" }
    if (id === 2) return { id, title: "Veiledning: Vektnedgang", category: "Prosess", theme: "Vektnedgang, mat og trening" }
    if (id === 3) return { id, title: "Veiledning: Mental helse", category: "Prosess", theme: "Tankekjør og følelsesregulering" }
    if (id === 4) return { id, title: "Veiledning: Kombinert tilnærming", category: "Prosess", theme: "Mental helse og vekt sammen" }
    if (id === 5) return { id, title: "Målgrupper: Vektnedgang", category: "Profil", theme: "Typiske avatarer for vektnedgang" }
    if (id === 6) return { id, title: "Målgrupper: Mental helse", category: "Profil", theme: "Typiske avatarer for mental helse" }

    if (id >= 10 && id <= 19) {
      const temaer = [
        "Vektnedgang",
        "Trening",
        "Kosthold",
        "Endringspsykologi",
        "Nevrobiologi",
        "Bevissthet og underbevissthet",
        "Stress",
        "Sorg og livskriser",
        "Faste",
        "Sykdommer"
      ]
      return { id, title: `Tema: ${temaer[id - 10]}`, category: "Tema", theme: temaer[id - 10] }
    }

    if (id >= 41 && id <= 42) {
      const tema = id === 41 ? "Vektnedgang" : "Mental helse"
      return { id, title: `Q&A: ${tema}`, category: "Q&A", theme: "Vanlige spørsmål og svar" }
    }

    return { id, title: "(Ledig)", category: "(Ledig)", theme: "(Ledig)" }
  })

  const handleUpload = () => {
    if (selectedDocId === null) return
    if (!selectedAIDoc && !selectedMasterDoc) return alert("Du må velge minst én fil.")

    if (selectedAIDoc) {
      setUploadedAIDocs([...uploadedAIDocs, selectedDocId])
    }
    if (selectedMasterDoc) {
      setUploadedMasterDocs([...uploadedMasterDocs, selectedDocId])
    }

    alert(`Laster opp dokument ${selectedDocId} med${selectedAIDoc ? " AI-fil" : ""}${selectedAIDoc && selectedMasterDoc ? " og" : ""}${selectedMasterDoc ? " Master-fil" : ""}`)

    setSelectedAIDoc(null)
    setSelectedMasterDoc(null)
    setSelectedDocId(null)
  }

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 10 }}>🧠 NULL FILTER Chatbot</h1>
      <h2 style={{ fontSize: 22, fontWeight: 'normal', marginBottom: 30 }}>Admin-side for opplasting av dokumenter</h2>

      <h2 style={{ fontSize: 22, fontWeight: 'bold' }}>🗂️ Statusoversikt</h2>

      <table border={1} cellPadding={10} style={{ borderCollapse: 'collapse', marginTop: 20, width: '100%' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th>#</th>
            <th>Tittel</th>
            <th>Kategori</th>
            <th>Tema</th>
            <th>AI</th>
            <th>Master</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.id}</td>
              <td>{doc.title}</td>
              <td>{doc.category}</td>
              <td>{doc.theme}</td>
              <td>{uploadedAIDocs.includes(doc.id) ? '✅' : '🔲'}</td>
              <td>{uploadedMasterDocs.includes(doc.id) ? '✅' : '🔲'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={{ margin: '40px 0' }} />

      <p style={{ marginBottom: 10 }}>Velg dokumentnummer og last opp en eller begge filer (.txt eller .md). Systemet vil lagre og prosessere dem automatisk.</p>

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
          <strong>2A. AI-dokument (.txt/.md):</strong><br />
          <input
            type="file"
            accept=".txt,.md"
            onChange={(e) => setSelectedAIDoc(e.target.files?.[0] || null)}
            style={{ padding: 10 }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <strong>2B. Master-dokument (.txt/.md):</strong><br />
          <input
            type="file"
            accept=".txt,.md"
            onChange={(e) => setSelectedMasterDoc(e.target.files?.[0] || null)}
            style={{ padding: 10 }}
          />
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={selectedDocId === null || (!selectedAIDoc && !selectedMasterDoc)}
        style={{ background: '#2D88FF', color: 'white', padding: '10px 20px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      >
        Last opp valgte filer
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
