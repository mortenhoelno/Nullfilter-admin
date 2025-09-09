"use client";

import { useEffect, useState } from "react";
import withAuth from "../components/withAuth";

import {
  upsertDocument,
  listDocuments,
  groupByDocNumber,
  type DbDocument,
  type DocGroup,
  setTitleForKind,
  syncMissingFiles,
} from "../utils/docs";

import { uploadAndFlag } from "../utils/upload";
import { listDropdownValues, addDropdownValue } from "../utils/dropdowns"; // ✅ NYE FUNKSJONER

function AdminPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [theme, setTheme] = useState("");
  const [existingTitles, setExistingTitles] = useState<string[]>([]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingThemes, setExistingThemes] = useState<string[]>([]);

  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customTheme, setCustomTheme] = useState("");

  const [selectedDocNumber, setSelectedDocNumber] = useState<number | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [rows, setRows] = useState<DocGroup[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  async function refreshList() {
    try {
      setLoadingList(true);
      setListError(null);
      await syncMissingFiles();
      const docs = await listDocuments();
      setRows(groupByDocNumber(docs));

      const [titles, categories, themes] = await Promise.all([
        listDropdownValues("title"),
        listDropdownValues("category"),
        listDropdownValues("theme"),
      ]);
      setExistingTitles(titles);
      setExistingCategories(categories);
      setExistingThemes(themes);
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

  async function handleUpload() {
    try {
      if (!selectedDocNumber || (!aiFile && !masterFile)) {
        alert("Velg dokumentnummer og minst én fil (AI og/eller Master).");
        return;
      }

      // Hvis bruker har lagt til nye dropdown-verdier → lagre dem
      if (customTitle) await addDropdownValue("title", customTitle);
      if (customCategory) await addDropdownValue("category", customCategory);
      if (customTheme) await addDropdownValue("theme", customTheme);

      const finalTitle = customTitle || title || null;
      const finalCategory = customCategory || category || null;
      const finalTheme = customTheme || theme || null;

      setIsUploading(true);

      await upsertDocument({
  docNumber: selectedDocNumber,
  title: finalTitle ?? "",
  category: finalCategory ?? "",
  theme: finalTheme ?? "",
});

      if (aiFile) {
        await uploadAndFlag({ file: aiFile, docNumber: selectedDocNumber, kind: "ai" });
        await setTitleForKind({
          docNumber: selectedDocNumber,
          isMaster: false,
          title: aiFile.name.replace(/\.[^/.]+$/, ""),
        });
      }
      if (masterFile) {
        await uploadAndFlag({ file: masterFile, docNumber: selectedDocNumber, kind: "master" });
        await setTitleForKind({
          docNumber: selectedDocNumber,
          isMaster: true,
          title: masterFile.name.replace(/\.[^/.]+$/, ""),
        });
      }

      setAiFile(null);
      setMasterFile(null);
      setSelectedDocNumber(null);
      setTitle("");
      setCategory("");
      setTheme("");
      setCustomTitle("");
      setCustomCategory("");
      setCustomTheme("");

      await refreshList();

      alert(
        `Opplastet dokument #${selectedDocNumber}\nAI: ${aiFile?.name || "Ingen"}\nMaster: ${masterFile?.name || "Ingen"}`
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
          {rows.map((g) => {
            const ai = g.ai as DbDocument | undefined;
            const master = g.master as DbDocument | undefined;
            const meta = ai ?? master; // ✅ ta metadata fra ett av dokumentene
            const createdAt = master?.created_at || ai?.created_at || null;
            const sourcePath = master?.source_path || ai?.source_path || "";

            return (
              <tr key={g.docNumber}>
                <td>{g.docNumber}</td>
                <td>{meta?.title || "—"}</td>
                <td>{meta?.category || "—"}</td>
                <td>{meta?.theme || "—"}</td>
                <td>{ai ? "✅" : "🔲"}</td>
                <td>{master ? "✅" : "🔲"}</td>
                <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <small title={sourcePath}>
                    {sourcePath ? sourcePath.split("/").pop() : "—"}
                  </small>
                </td>
                <td>{createdAt ? new Date(createdAt).toLocaleString() : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <hr style={{ margin: "40px 0" }} />

      <p style={{ marginTop: 16 }}>Velg dokumentnummer og last opp AI- og/eller Master-dokument.</p>

      <div style={{ display: "flex", gap: 20, margin: "20px 0", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label>
            <strong>1. Dokumentnummer:</strong><br />
            <input
              type="number"
              value={selectedDocNumber ?? ""}
              onChange={(e) => setSelectedDocNumber(e.target.value ? parseInt(e.target.value, 10) : null)}
              placeholder="Skriv nytt dokumentnummer"
              style={{ width: 120 }}
            />
          </label>
        </div>

        <div>
          <label><strong>Tittel:</strong><br />
            <select
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: 250 }}
            >
              <option value="">Velg eksisterende tittel…</option>
              {existingTitles.map((t, i) => (
                <option key={i} value={t}>{t}</option>
              ))}
            </select>
            <br />
            <input
              type="text"
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                setTitle(e.target.value);
              }}
              placeholder="Eller skriv ny tittel"
              style={{ width: 250, marginTop: 6 }}
            />
          </label>
        </div>

        <div>
          <label><strong>Kategori:</strong><br />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: 150 }}
            >
              <option value="">Velg kategori…</option>
              {existingCategories.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
            <br />
            <input
              type="text"
              value={customCategory}
              onChange={(e) => {
                setCustomCategory(e.target.value);
                setCategory(e.target.value);
              }}
              placeholder="Eller skriv ny kategori"
              style={{ width: 150, marginTop: 6 }}
            />
          </label>
        </div>

        <div>
          <label><strong>Tema:</strong><br />
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              style={{ width: 200 }}
            >
              <option value="">Velg tema…</option>
              {existingThemes.map((t, i) => (
                <option key={i} value={t}>{t}</option>
              ))}
            </select>
            <br />
            <input
              type="text"
              value={customTheme}
              onChange={(e) => {
                setCustomTheme(e.target.value);
                setTheme(e.target.value);
              }}
              placeholder="Eller skriv nytt tema"
              style={{ width: 200, marginTop: 6 }}
            />
          </label>
        </div>
      </div>

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
        <input type="file" accept=".doc,.docx,.pdf,.txt,.md" onChange={(e) => setMasterFile(e.target.files?.[0] || null)} />
      </div>

      <button
        onClick={handleUpload}
        disabled={!selectedDocNumber || (!aiFile && !masterFile) || isUploading}
        style={{
          background: "#2D88FF",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: 6,
          cursor: !selectedDocNumber || (!aiFile && !masterFile) || isUploading ? "not-allowed" : "pointer",
        }}
      >
        {isUploading ? "Laster opp…" : "Last opp dokument(er)"}
      </button>
    </div>
  );
}

export default withAuth(AdminPage);
