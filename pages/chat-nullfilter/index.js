  const sendMessage = async (text) => {
    const toSend = (text ?? chatInput).trim();
    if (!toSend) return;

    const userMessage = { role: "user", content: toSend };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    if (conversation) await saveMessage(conversation.id, userMessage);

    // 🔍 Hent RAG-kontekst
    const { contextText } = await getRagContext(toSend);

    const systemPrompt = `
Du er ${config.name} – varm, klok og ekte.
Bruk konteksten under når du svarer. Ikke gjett. Si ifra hvis noe mangler.

${contextText ? `\nRelevante utdrag:\n${contextText}\n` : ""}
    `;

    // 👉 Viktig: prepend system + legg på HELE historikken (inkl. nye melding)
    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
      userMessage,
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullMessages, personaId: config.slug })
      });

      const data = await res.json();
      const reply = {
        role: "assistant",
        content: data.reply || "Beklager, jeg klarte ikke svare akkurat nå."
      };

      setMessages((prev) => [...prev, reply]);
      if (conversation) await saveMessage(conversation.id, reply);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "En feil oppsto under samtalen. Prøv igjen senere."
        }
      ]);
    }
  };
