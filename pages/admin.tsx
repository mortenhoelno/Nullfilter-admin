import { useState } from "react";
/* ⬇️ NYTT: legg til disse to importene */
import { upsertDocument } from "../utils/docs";
import { uploadAndFlag } from "../utils/upload";

export default function AdminPage() {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [uploadedAi, setUploadedAi] = useState<number[]>([]);
  const [uploadedMaster, setUploadedMaster] = useState<number[]>([]);

  const documents = Array.from({ length: 50 }, (_, i) => {
    const id = i + 1;
    const docMap: Record<number, any> = {
      1: { title: "Din metode og filosofi", category: "Master", theme: "Grunnprinsipper, metaforer og stil" },
      2: { title: "Veiledning: Vektnedgang", category: "Prosess", theme: "Vektnedgang, mat og trening" },
      3: { title: "Veiledning: Mental helse", category: "Prosess", theme: "Tankekjør og følelsesregulering" },
      4: { title: "Veiledning: Kombinert tilnærming", category: "Prosess", theme: "Mental helse og vekt sammen" },
      5: { title: "Målgrupper: Vektnedgang", category: "Profil", theme: "Typiske avatarer for vektnedgang" },
      6: { title: "Målgrupper: Mental helse", category: "Profil", theme: "Typiske avatarer for mental helse" },
      10: { title: "Tema: Vektnedgang", category: "Tema", theme: "Vektnedgang" },
      11: { title: "Tema: Trening", category: "Tema", theme: "Trening" },
      12: { title: "Tema: Kosthold", category: "Tema", theme: "Kosthold" },
      13: { title: "Tema: Endringspsykologi", category: "Tema", theme: "Endringspsykologi" },
      14: { title: "Tema: Nevrobiologi", category: "Tema", theme: "Nevrobiologi" },
      15: { title: "Tema: Bevissthet og underbevissthet", category: "Tema", theme: "Bevissthet og underbevissthet" },
      16: { title: "Tema: Stress", category: "Tema", theme: "Stress og nervesystem" },
      17: { title: "Tema: Sorg og livskriser", category: "Tema", theme: "Sorg og traumer" },
      18: { title: "Tema: Faste", category: "Tema", theme: "Faste og metabolske prosesser" },
      19: { title: "Tema: Sykdommer", category: "Tema", theme: "Psykisk og fysisk helse" },
      41: { title: "Q&A: Vektnedgang", category: "Q&A", theme: "Vanlige spørsmål og svar" },
      42: { title: "Q&A: Mental helse", category: "Q&A", theme: "Vanlige spørsmål og svar" },
    };
    return {
      id,
      title: docMap[id]?.title || `(Ledig)`,
      category: docMap[id]?.category || "-",
      theme: docMap[id]?.theme || "-",
    };
  });

  /* ⬇️ NYTT: erstatt din gamle handleUpload med denne */
  const handleUpload = async () => {
    try {
      if (!selectedDocId || (!aiFile && !masterFile)) return;

      const doc = documents.find((d) => d.id === selectedDocId);
      const title = doc?.title || `(Ledig)`;
      const category = doc?.category === "-" ? null : doc?.category || null;
      const theme = doc?.theme === "-" ? null : doc?.theme || null;

      // 1) Sørg for at dokumentet finnes i DB (eller oppdateres)
      await upsertDocument({
        docNumber: selectedDocId,
        title,
        category,
        theme,
      });

      // 2) Last opp filer + sett flagg i DB
      if (aiFile) {
        await uploadAndFlag({
          file: aiFile,
          docNumber: selectedDocId,
          kind: "ai",
        });
      }
      if (masterFile) {
        await uploadAndFlag({
          file: masterFile,
          docNumber: selectedDocId,
          kind: "master",
        });
      }

      // 3) Lokal UI-status (checkmarks)
      if (aiFile) setUploadedAi((prev) => Array.from(new Set([...prev, selectedDocId])));
      if (masterFile) setUploadedMaster((prev) => Array.from(new Set([...prev, selectedDocId])));

      alert(
        `Opplastet dokument #${selectedDocId}\nAI: ${aiFile?.name || "Ingen"}\nMaster: ${masterFile?.name || "Ingen"}`
      );

      setAiFile(null);
      setMasterFile(null);
      setSelectedDocId(null);
    } catch (err: any) {
      alert("Feil ved opplasting: " + err.message);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: 32 }}>🧠 NULL FILTER Chatbot</h1>
      <h2 style={{ fontSize: 22, marginBottom: 30 }}>Admin-side for opplasting av dokumenter</h2>

      <h2 style={{ fontSize: 22 }}>🗂️ Statusoversikt</h2>
      <table border={1} cellPadding={10} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th>#</th><th>Tittel</th><th>Kategori</th><th>Tema</th><th>AI</th><th>Master</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.id}</td>
              <td>{doc.title}</td>
              <td>{doc.category}</td>
              <td>{doc.theme}</td>
              <td>{uploadedAi.includes(doc.id) ? '✅' : '🔲'}</td>
              <td>{uploadedMaster.includes(doc.id) ? '✅' : '🔲'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr style={{ margin: '40px 0' }} />

      {/* ⬇️ NY INFO-BOKS */}
      <div style={{ marginTop: 24, background: '#fffbe6', padding: 16, borderRadius: 8, lineHeight: 1.5 }}>
        <h3 style={{ marginTop: 0 }}>📎 Opplastingsregler</h3>
        <ul style={{ marginTop: 8 }}>
          <li><strong>Tillatte tegn:</strong> A–Z a–z 0–9 _ - .</li>
          <li><strong>Ikke tillatt:</strong> mellomrom og spesialtegn (æøå, é, komma, «–», osv.)</li>
          <li><strong>Bruk “_”</strong> i stedet for mellomrom.</li>
        </ul>
        <p style={{ margin: 0 }}>
          <strong>Eksempler (OK):</strong> <code>AI_Hjernen_vaner_endring.txt</code> og <code>MASTER_Hjernen_vaner_endring.pdf</code><br/>
          <strong>AI må være tekst:</strong> .txt eller .md &nbsp;|&nbsp; <strong>MASTER kan være:</strong> .doc, .docx, .pdf, .txt, .md
        </p>
      </div>

      <p style={{ marginTop: 16 }}>Velg dokumentnummer og last opp AI- og/eller Master-dokument.</p>
      <label>
        <strong>1. Dokumentnummer:</strong><br />
        <select onChange={(e) => setSelectedDocId(parseInt(e.target.value))} value={selectedDocId ?? ''}>
          <option value="" disabled>Velg dokument…</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>#{doc.id} – {doc.title}</option>
          ))}
        </select>
      </label>

      <div style={{ margin: '20px 0' }}>
        <label>
          <strong>2. AI-dokument:</strong><br />
          <input
            type="file"
            accept=".txt,.md"
            onChange={(e) => setAiFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <strong>3. Master-dokument:</strong><br />
          <input
            type="file"
            accept=".doc,.docx,.pdf,.txt,.md"
            onChange={(e) => setMasterFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!selectedDocId || (!aiFile && !masterFile)}
        style={{ background: '#2D88FF', color: 'white', padding: '10px 20px', border: 'none', borderRadius: 6 }}>
        Last opp dokument(er)
      </button>

      <div style={{ marginTop: 40, background: '#fffbe6', padding: 20, borderRadius: 8 }}>
        <h3>💡 Dagens inspirasjonsquote</h3>
        <blockquote style={{ fontStyle: 'italic' }}>
          "Små justeringer i dag kan skape store forandringer i morgen."
        </blockquote>
        <p>– Nullfilter GPT</p>
      </div>
    </div>
  );
}
