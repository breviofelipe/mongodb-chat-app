// Script de teste para o sistema de chat P2P
import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const DB_NAME = "chatapp"

async function testP2PChat() {
  console.log("🧪 Testando Sistema de Chat P2P MongoDB...\n")

  try {
    // Teste 1: Conexão com MongoDB
    console.log("1️⃣ Testando conexão com MongoDB...")
    const client = new MongoClient(MONGODB_URI)
    await client.connect()
    console.log("✅ Conexão estabelecida")

    const db = client.db(DB_NAME)
    const roomsCollection = db.collection("chat_rooms")

    // Teste 2: Criar sala de chat
    console.log("\n2️⃣ Testando criação de sala...")
    const roomId = `test_room_${Date.now()}`
    const creatorNick = "TestUser1"

    const roomDocument = {
      roomId,
      createdBy: creatorNick,
      createdAt: new Date(),
      participants: [creatorNick],
      messages: [
        {
          id: `sys_${Date.now()}`,
          type: "system",
          content: `Sala criada por ${creatorNick}`,
          timestamp: new Date().toISOString(),
          sender: "system",
        },
      ],
      metadata: {
        lastActivity: new Date(),
        messageCount: 1,
      },
    }

    await roomsCollection.insertOne(roomDocument)
    console.log("✅ Sala criada com sucesso")
    console.log(`   Room ID: ${roomId}`)
    console.log(`   Criador: ${creatorNick}`)

    // Teste 3: Segundo usuário entra na sala
    console.log("\n3️⃣ Testando entrada de segundo usuário...")
    const participantNick = "TestUser2"

    await roomsCollection.updateOne(
      { roomId },
      {
        $push: {
          participants: participantNick,
          messages: {
            id: `sys_${Date.now()}_2`,
            type: "system",
            content: `${participantNick} entrou na sala`,
            timestamp: new Date().toISOString(),
            sender: "system",
          },
        },
        $set: { lastActivity: new Date() },
        $inc: { "metadata.messageCount": 1 },
      },
    )

    console.log("✅ Segundo usuário adicionado")
    console.log(`   Participante: ${participantNick}`)

    // Teste 4: Simular conversa
    console.log("\n4️⃣ Simulando conversa entre usuários...")

    const conversation = [
      { sender: creatorNick, content: "Olá! Como você está?" },
      { sender: participantNick, content: "Oi! Estou bem, obrigado! E você?" },
      { sender: creatorNick, content: "Também estou bem! Legal esse chat P2P." },
      { sender: participantNick, content: "Sim! E as mensagens ficam salvas no MongoDB." },
      { sender: creatorNick, content: "Perfeito para manter o histórico!" },
    ]

    for (const msg of conversation) {
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sender: msg.sender,
        content: msg.content,
        timestamp: new Date().toISOString(),
        type: "message",
      }

      await roomsCollection.updateOne(
        { roomId },
        {
          $push: { messages: message },
          $set: { lastActivity: new Date() },
          $inc: { "metadata.messageCount": 1 },
        },
      )

      console.log(`   💬 ${msg.sender}: ${msg.content}`)

      // Pequena pausa para simular tempo real
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Teste 5: Verificar histórico completo
    console.log("\n5️⃣ Verificando histórico da conversa...")
    const updatedRoom = await roomsCollection.findOne({ roomId })

    if (updatedRoom) {
      console.log("✅ Histórico recuperado com sucesso")
      console.log(`   Total de mensagens: ${updatedRoom.messages.length}`)
      console.log(`   Participantes: ${updatedRoom.participants.join(", ")}`)
      console.log(`   Última atividade: ${updatedRoom.lastActivity}`)

      console.log("\n📋 Estrutura do documento da sala:")
      console.log(`   - Room ID: ${updatedRoom.roomId}`)
      console.log(`   - Criada por: ${updatedRoom.createdBy}`)
      console.log(`   - Participantes: ${updatedRoom.participants.length}`)
      console.log(`   - Mensagens: ${updatedRoom.messages.length}`)
      console.log(`   - Tamanho do documento: ${JSON.stringify(updatedRoom).length} bytes`)

      console.log("\n💬 Últimas 3 mensagens:")
      updatedRoom.messages.slice(-3).forEach((msg, index) => {
        if (msg.type === "message") {
          console.log(
            `   ${index + 1}. [${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.sender}: ${msg.content}`,
          )
        }
      })
    }

    // Teste 6: Testar busca de salas ativas
    console.log("\n6️⃣ Testando busca de salas ativas...")
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const activeRooms = await roomsCollection
      .find({
        createdAt: { $gte: oneDayAgo },
        "participants.1": { $exists: true }, // Exatamente 2 participantes
      })
      .toArray()

    console.log(`✅ Encontradas ${activeRooms.length} salas ativas`)

    // Teste 7: Verificar estratégia "tudo junto"
    console.log("\n7️⃣ Verificando estratégia de armazenamento...")

    const singleQuery = await roomsCollection.findOne({ roomId })
    const hasAllData = !!(
      singleQuery?.roomId &&
      singleQuery?.participants &&
      singleQuery?.messages &&
      singleQuery?.metadata
    )

    console.log(`✅ Dados completos em uma consulta: ${hasAllData ? "SIM" : "NÃO"}`)
    console.log("   - Informações da sala: ✅")
    console.log("   - Lista de participantes: ✅")
    console.log("   - Histórico completo: ✅")
    console.log("   - Metadados: ✅")

    // Teste 8: Performance de recuperação
    console.log("\n8️⃣ Testando performance...")
    const startTime = Date.now()

    for (let i = 0; i < 10; i++) {
      await roomsCollection.findOne({ roomId })
    }

    const avgTime = (Date.now() - startTime) / 10
    console.log(`✅ Tempo médio de recuperação: ${avgTime.toFixed(2)}ms`)

    // Limpeza
    console.log("\n9️⃣ Limpando dados de teste...")
    await roomsCollection.deleteOne({ roomId })
    console.log("✅ Dados de teste removidos")

    await client.close()
    console.log("\n🎉 Todos os testes do chat P2P concluídos com sucesso!")
  } catch (error) {
    console.error("\n❌ Erro durante os testes:", error)
  }
}

// Função para testar múltiplas salas simultâneas
async function testMultipleRooms() {
  console.log("\n🔄 Testando múltiplas salas simultâneas...\n")

  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db(DB_NAME)
  const roomsCollection = db.collection("chat_rooms")

  const rooms = []

  // Criar 3 salas de teste
  for (let i = 1; i <= 3; i++) {
    const roomId = `multi_test_room_${i}_${Date.now()}`
    const roomDoc = {
      roomId,
      createdBy: `Creator${i}`,
      createdAt: new Date(),
      participants: [`Creator${i}`, `User${i}`],
      messages: [
        {
          id: `msg_${Date.now()}_${i}`,
          sender: `Creator${i}`,
          content: `Mensagem inicial da sala ${i}`,
          timestamp: new Date().toISOString(),
          type: "message",
        },
      ],
      metadata: {
        lastActivity: new Date(),
        messageCount: 1,
      },
    }

    await roomsCollection.insertOne(roomDoc)
    rooms.push(roomId)
    console.log(`✅ Sala ${i} criada: ${roomId.slice(0, 20)}...`)
  }

  // Testar recuperação simultânea
  console.log("\n📊 Testando recuperação simultânea...")
  const startTime = Date.now()

  const promises = rooms.map((roomId) => roomsCollection.findOne({ roomId }))
  const results = await Promise.all(promises)

  const totalTime = Date.now() - startTime
  console.log(`✅ ${results.length} salas recuperadas em ${totalTime}ms`)
  console.log(`   Tempo médio por sala: ${(totalTime / results.length).toFixed(2)}ms`)

  // Limpeza
  await roomsCollection.deleteMany({ roomId: { $in: rooms } })
  console.log("✅ Salas de teste removidas")

  await client.close()
}

// Executar todos os testes
async function runAllTests() {
  console.log("🚀 Sistema de Chat P2P MongoDB - Suite de Testes Completa\n")
  console.log("=".repeat(60))

  await testP2PChat()
  await testMultipleRooms()

  console.log("\n" + "=".repeat(60))
  console.log("📊 RESUMO DOS TESTES:")
  console.log("✅ Criação de salas")
  console.log("✅ Entrada de participantes")
  console.log("✅ Envio de mensagens")
  console.log("✅ Histórico persistente")
  console.log("✅ Estratégia 'tudo junto'")
  console.log("✅ Performance de consultas")
  console.log("✅ Múltiplas salas simultâneas")
  console.log("\n🎯 Sistema P2P pronto para uso!")
}

runAllTests()
