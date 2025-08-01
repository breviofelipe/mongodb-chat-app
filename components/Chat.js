"use client";
import { useEffect, useRef, useState } from "react";

export default function Chat({ wsUrl }) {
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "history") {
        setMessages(msg.data);
      } else if (msg.type === "new_message") {
        setMessages((prev) => [...prev, msg.data]);
      }
    };

    return () => {
      ws.current.close();
    };
  }, [wsUrl]);

  const sendMessage = () => {
    if (!username || !message) return;
    const payload = JSON.stringify({ user: username, message });
    ws.current.send(payload);
    setMessage("");
  };

  return (
    <div style={{ maxWidth: "600px", margin: "auto" }}>
      <h2>Chat WebSocket</h2>
      <div style={{
        border: "1px solid #ccc", padding: "10px",
        height: "300px", overflowY: "scroll", marginBottom: "10px"
      }}>
        {messages.map((m, i) => (
          <p key={i}>
            <strong>{m.user}</strong>: {m.message} <small>({new Date(m.timestamp).toLocaleTimeString()})</small>
          </p>
        ))}
      </div>

      <input
        placeholder="Seu nome"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ marginBottom: 8, display: "block", width: "100%" }}
      />
      <input
        placeholder="Digite sua mensagem"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        style={{ marginBottom: 8, display: "block", width: "100%" }}
      />
      <button onClick={sendMessage}>Enviar</button>
    </div>
  );
}
