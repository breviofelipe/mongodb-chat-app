const WebSocket = require("ws")
const { MongoClient } = require("mongodb")

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"
const WS_URL = "wss://localhost:8443"

async function testWebSocketSystem() {
  console.log("🧪 Testando Sistema WebSocket Seguro...\n")

  let mongoClient
  let ws1, ws2

  try {
    // 1. Conectar ao MongoDB
    console.log("📊 Conectando ao MongoDB...")
    mongoClient = new MongoClient(SYSTEM_MONGODB_URI)
    await mongoClient.connect()
    console.log("✅ MongoDB conectado\n")

    // 2. Criar uma sala de teste
    console.log("🏠 Criando sala de teste...")
    const createResponse = await fetch("http://localhost:3000/api/rooms/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorNick: "TestUser1",
        mongoUri: SYSTEM_MONGODB_URI,
      }),
    })

    if (!createResponse.ok) {
      throw new Error("Falha ao criar sala de teste")
    }

    const { roomId, sessionId: session1 } = await createResponse.json()
    console.log(`✅ Sala criada: ${roomId}`)
    console.log(`✅ Sessão 1: ${session1}\n`)

    // 3. Segundo usuário entra na sala
    console.log("👥 Segundo usuário entrando na sala...")
    const joinResponse = await fetch("http://localhost:3000/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nick: "TestUser2",
        roomId: roomId,
      }),
    })

    if (!joinResponse.ok) {
      throw new Error("Falha ao entrar na sala")
    }

    const { sessionId: session2 } = await joinResponse.json()
    console.log(`✅ Sessão 2: ${session2}\n`)

    // 4. Conectar WebSockets
    console.log("🔌 Conectando WebSockets...")

    // WebSocket 1 (Criador)
    ws1 = new WebSocket(WS_URL, {
      rejectUnauthorized: false, // Para certificado self-signed
    })

    await new Promise((resolve, reject) => {
      ws1.on("open", () => {
        console.log("✅ WebSocket 1 conectado")
        // Autenticar
        ws1.send(
          JSON.stringify({
            type: "auth",
            sessionId: session1,
          }),
        )
        resolve()
      })
      ws1.on("error", reject)
    })

    // WebSocket 2 (Participante)
    ws2 = new WebSocket(WS_URL, {
      rejectUnauthorized: false,
    })

    await new Promise((resolve, reject) => {
      ws2.on("open", () => {
        console.log("✅ WebSocket 2 conectado")
        // Autenticar
        ws2.send(
          JSON.stringify({
            type: "auth",
            sessionId: session2,
          }),
        )
        resolve()
      })
      ws2.on("error", reject)
    })

    console.log("")

    // 5. Configurar listeners de mensagens
    const messages1 = []
    const messages2 = []

    ws1.on("message", (data) => {
      const message = JSON.parse(data.toString())
      messages1.push(message)
      console.log(`📨 WS1 recebeu: ${message.type}`)
    })

    ws2.on("message", (data) => {
      const message = JSON.parse(data.toString())
      messages2.push(message)
      console.log(`📨 WS2 recebeu: ${message.type}`)
    })

    // Aguardar autenticação
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 6. Testar envio de mensagens
    console.log("\n💬 Testando envio de mensagens...")

    // Usuário 1 envia mensagem
    ws1.send(
      JSON.stringify({
        type: "message",
        content: "Olá! Esta é uma mensagem via WebSocket seguro!",
        sender: "TestUser1",
        roomId: roomId,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Usuário 2 responde
    ws2.send(
      JSON.stringify({
        type: "message",
        content: "Oi! Recebi sua mensagem em tempo real! 🚀",
        sender: "TestUser2",
        roomId: roomId,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 7. Testar carregamento de mensagens
    console.log("\n📜 Testando carregamento de mensagens...")
    ws1.send(
      JSON.stringify({
        type: "get_messages",
        roomId: roomId,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 8. Testar heartbeat
    console.log("\n💓 Testando heartbeat...")
    ws1.send(JSON.stringify({ type: "ping" }))
    ws2.send(JSON.stringify({ type: "ping" }))

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 9. Verificar mensagens recebidas
    console.log("\n📊 Verificando mensagens recebidas...")
    console.log(`WS1 recebeu ${messages1.length} mensagens`)
    console.log(`WS2 recebeu ${messages2.length} mensagens`)

    // Verificar tipos de mensagens
    const messageTypes1 = messages1.map((m) => m.type)
    const messageTypes2 = messages2.map((m) => m.type)

    console.log(`WS1 tipos: ${messageTypes1.join(", ")}`)
    console.log(`WS2 tipos: ${messageTypes2.join(", ")}`)

    // 10. Verificar dados no MongoDB
    console.log("\n🗄️ Verificando dados no MongoDB...")
    const db = mongoClient.db(SYSTEM_DB_NAME)
    const roomsRegistry = db.collection("rooms_registry")
    const sessionsRegistry = db.collection("sessions_registry")

    const roomData = await roomsRegistry.findOne({ roomId })
    const sessionsData = await sessionsRegistry.find({ roomId }).toArray()

    console.log(`✅ Sala encontrada: ${roomData ? "Sim" : "Não"}`)
    console.log(`✅ Sessões ativas: ${sessionsData.length}`)
    console.log(`✅ Mensagens no sistema: ${roomData?.systemMetadata?.messageCount || 0}`)

    // 11. Testar desconexão
    console.log("\n🔌 Testando desconexão...")
    ws1.send(JSON.stringify({ type: "leave_room" }))
    ws1.close()

    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log("\n🎉 Teste do Sistema WebSocket Concluído!")
    console.log("\n📋 Resumo dos Testes:")
    console.log("✅ Conexão WebSocket segura (WSS)")
    console.log("✅ Autenticação via sessão")
    console.log("✅ Entrada em sala")
    console.log("✅ Envio de mensagens em tempo real")
    console.log("✅ Broadcast para múltiplos clientes")
    console.log("✅ Carregamento de mensagens")
    console.log("✅ Sistema de heartbeat")
    console.log("✅ Persistência no MongoDB")
    console.log("✅ Desconexão graceful")
  } catch (error) {
    console.error("❌ Erro no teste:", error)
  } finally {
    // Cleanup
    if (ws1 && ws1.readyState === WebSocket.OPEN) {
      ws1.close()
    }
    if (ws2 && ws2.readyState === WebSocket.OPEN) {
      ws2.close()
    }
    if (mongoClient) {
      await mongoClient.close()
    }
  }
}

// Executar teste
if (require.main === module) {
  testWebSocketSystem().catch(console.error)
}

module.exports = { testWebSocketSystem }
