"use client";

import { useEffect, useMemo, useState } from "react";

import {
  upsertDocument,
  listDocuments,
  groupByDocNumber,
  type DbDocument,
  type DocGroup,
} from "../utils/docs";
import { uploadAndFlag } from "../utils/upload";
import { setTitleForKind } from "../utils/docs";

export default function AdminPage() {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [rows, setRows] = useState<DocGroup[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const docCatalog = useMemo(() => {
    const map: Record<number, { title: string; category: string; theme: string }> = {
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

    return Array.from({ length: 50 }, (_, i) => {
      const id = i + 1;
      const meta = map[id];
      return {
        id,
        title: meta?.title ?? "(Ledig)",
        category: meta?.category ?? "-",
        theme: meta?.theme ?? "-",
      };
    });
  }, []);

  async function refreshList() {
    try {
      setLoadingList(true);
      setListError(null);
      const docs = await listDocuments();
      setRows(groupByDocNumber(docs));
    } catch (e: any) {
      console.error(e);
      setListError(e?.message ?? "Kunne ikke hente dokumenter");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    refreshList();
  }, []);

  function getGroup(num: number): DocGroup | undefined {
    return rows.find((g) => g.docNumber === num);
  }

  async function handleUpload() {
    try {
      if (!selectedDocId || (!aiFile && !masterFile)) {
        alert("Velg dokumentnummer og minst én fil (AI og/eller Master).");
        return;
      }

      const label = docCatalog.find((d) => d.id === selectedDocId);
      const title = label?.title ?? "(Ledig)";
      const category = label?.category === "-" ? null : label?.category ?? null;
      const theme = label?.theme === "-" ? null : label?.theme ?? null;

      setIsUploading(true);

      await upsertDocument({
        docNumber: selectedDocId,
        title,
        category,
        theme,
      });

      if (aiFile) {
        await uploadAndFlag({ file: aiFile, docNumber: selectedDocId, kind: "ai" });
        await setTitleForKind({
          docNumber: selectedDocId,
          isMaster: false,
          title: aiFile.name.replace(/\.[^/.]+$/, ""),
        });
      }
      if (masterFile) {
        await uploadAndFlag({ file: masterFile, docNumber: selectedDocId, kind: "master" });
        await setTitleForKind({
          docNumber: selectedDocId,
          isMaster: true,
          title: masterFile.name.replace(/\.[^/.]+$/, ""),
        });
      }

      setAiFile(null);
      setMasterFile(null);
      setSelectedDocId(null);
      await refreshList();

      alert(
        `Opplastet dokument #${selectedDocId}\nAI: ${aiFile?.name || "Ingen"}\nMaster: ${masterFile?.name || "Ingen"}`
      );
    } catch (err: any) {
      console.error(err);
      alert("Feil ved opplasting: " + (err?.message ?? "Ukjent feil"));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32 }}>🧠 NULL FILTER Chatbot</h1>
      <h2 style={{ fontSize: 22, marginBottom: 30 }}>Admin-side for opplasting av dokumenter</h2>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>🗂️ Statusoversikt</h2>
        <button onClick={refreshList} disabled={loadingList} style={{ padding: "6px 12px" }}>
          {loadingList ? "Laster…" : "Oppdater liste"}
        </button>
      </div>

      {listError && <p style={{ color: "crimson" }}>{listError}</p>}

      <table border={1} cellPadding={10} style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
        <thead>
          <tr style={{ backgroundColor: "#f0f0f0" }}>
            <th>#</th>
            <th>Tittel</th>
            <th>Kategori</th>
            <th>Tema</th>
            <th>AI</th>
            <th>Master</th>
            <th>Kilde (path)</th>
            <th>Opprettet</th>
          </tr>
        </thead>
        <tbody>
          {docCatalog.map((cat) => {
            const g = getGroup(cat.id);
            const ai = g?.ai as DbDocument | undefined;
            const master = g?.master as DbDocument | undefined;
            const createdAt = master?.created_at || ai?.created_at || null;
            const sourcePath = master?.source_path || ai?.source_path || "";

            return (
              <tr key={cat.id}>
                <td>{cat.id}</td>
                <td>{cat.title}</td>
                <td>{cat.category}</td>
                <td>{cat.theme}</td>
                <td>{ai ? "✅" : "🔲"}</td>
                <td>{master ? "✅" : "🔲"}</td>
                <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <small title={sourcePath}>{sourcePath || "—"}</small>
                </td>
                <td>{createdAt ? new Date(createdAt).toLocaleString() : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <hr style={{ margin: "40px 0" }} />

      <p style={{ marginTop: 16 }}>Velg dokumentnummer og last opp AI- og/eller Master-dokument.</p>

      <label>
        <strong>1. Dokumentnummer:</strong>
        <br />
        <select
          onChange={(e) => setSelectedDocId(e.target.value ? parseInt(e.target.value, 10) : (null as any))}
          value={selectedDocId ?? ""}
        >
          <option value="" disabled>
            Velg dokument…
          </option>
          {docCatalog.map((doc) => (
            <option key={doc.id} value={doc.id}>
              #{doc.id} – {doc.title}
            </option>
          ))}
        </select>
      </label>

      <div style={{ margin: "20px 0" }}>
        <label>
          <strong>2. AI-dokument:</strong>
          <br />
        </label>
        <input type="file" accept=".txt,.md" onChange={(e) => setAiFile(e.target.files?.[0] || null)} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <strong>3. Master-dokument:</strong>
          <br />
        </label>
        <input
          type="file"
          accept=".doc,.docx,.pdf,.txt,.md"
          onChange={(e) => setMasterFile(e.target.files?.[0] || null)}
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!selectedDocId || (!aiFile && !masterFile) || isUploading}
        style={{
          background: "#2D88FF",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: 6,
          cursor: !selectedDocId || (!aiFile && !masterFile) || isUploading ? "not-allowed" : "pointer",
        }}
      >
        {isUploading ? "Laster opp…" : "Last opp dokument(er)"}
      </button>
    </div>
  );
}
