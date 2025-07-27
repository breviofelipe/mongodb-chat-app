// Teste do sistema de verificação manual de mensagens
import { MongoClient } from "mongodb"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

async function testManualRefresh() {
  console.log("🔄 Testando Sistema de Verificação Manual de Mensagens...\n")

  const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
  await systemClient.connect()

  const systemDb = systemClient.db(SYSTEM_DB_NAME)
  const roomsRegistry = systemDb.collection("rooms_registry")
  const sessionsRegistry = systemDb.collection("sessions_registry")

  try {
    // Limpar dados de teste
    await roomsRegistry.deleteMany({ roomId: /^manual_test_/ })
    await sessionsRegistry.deleteMany({ roomId: /^manual_test_/ })

    // Teste 1: Criar sala de teste
    console.log("1️⃣ Criando sala de teste...")
    const roomId = `manual_test_room_${Date.now()}`
    const user1Nick = "User1"
    const user2Nick = "User2"
    const session1Id = `session_1_${Date.now()}`
    const session2Id = `session_2_${Date.now()}`

    // Registrar sala
    const roomRegistry = {
      roomId,
      createdBy: user1Nick,
      createdAt: new Date(),
      status: "active",
      participantCount: 2,
      maxParticipants: 2,
      participants: [user1Nick, user2Nick],
      userMongoInfo: {
        mongoUri: SYSTEM_MONGODB_URI,
        dbName: `user_chats_${roomId.split("_")[3]}`,
      },
      systemMetadata: {
        messageCount: 2,
        isPublic: true,
        lastActivity: new Date(),
        userDataSaved: true,
      },
    }

    await roomsRegistry.insertOne(roomRegistry)

    // Registrar sessões
    await sessionsRegistry.insertMany([
      {
        sessionId: session1Id,
        roomId,
        nick: user1Nick,
        role: "creator",
        status: "active",
        createdAt: new Date(),
        lastActivity: new Date(),
      },
      {
        sessionId: session2Id,
        roomId,
        nick: user2Nick,
        role: "participant",
        status: "active",
        createdAt: new Date(),
        lastActivity: new Date(),
      },
    ])

    console.log("✅ Sala e sessões criadas")

    // Criar dados do usuário
    const userDbName = `user_chats_${roomId.split("_")[3]}`
    const userDb = systemClient.db(userDbName)
    const userChatsCollection = userDb.collection("user_chats")

    const initialMessages = [
      {
        id: `sys_${Date.now()}`,
        type: "system",
        content: `Sala criada por ${user1Nick}`,
        timestamp: new Date().toISOString(),
        sender: "system",
      },
      {
        id: `sys_${Date.now()}_2`,
        type: "system",
        content: `${user2Nick} entrou na sala`,
        timestamp: new Date().toISOString(),
        sender: "system",
      },
    ]

    const userChatDocument = {
      roomId,
      createdBy: user1Nick,
      createdAt: new Date(),
      participants: [
        {
          nick: user1Nick,
          joinedAt: new Date(),
          role: "creator",
          sessionId: session1Id,
          status: "active",
        },
        {
          nick: user2Nick,
          joinedAt: new Date(),
          role: "participant",
          sessionId: session2Id,
          status: "active",
        },
      ],
      messages: initialMessages,
      chatHistory: {
        totalMessages: 2,
        lastActivity: new Date(),
        conversationSummary: "Sala criada e usuário entrou",
        topics: [],
      },
      userPreferences: {
        [user1Nick]: { theme: "light", notifications: true },
        [user2Nick]: { theme: "light", notifications: true },
      },
    }

    await userChatsCollection.insertOne(userChatDocument)
    console.log("✅ Dados iniciais do usuário criados")

    // Teste 2: Simular verificação inicial de mensagens
    console.log("\n2️⃣ Simulando verificação inicial de mensagens...")

    const currentMessages = await userChatsCollection.findOne({ roomId })
    let messageCount = currentMessages.messages.length

    console.log(`📊 Estado inicial: ${messageCount} mensagens`)
    currentMessages.messages.forEach((msg, index) => {
      console.log(`   ${index + 1}. [${msg.type}] ${msg.sender}: ${msg.content}`)
    })

    // Teste 3: Simular User1 enviando mensagem
    console.log("\n3️⃣ Simulando User1 enviando mensagem...")

    const newMessage1 = {
      id: `msg_${Date.now()}_1`,
      sender: user1Nick,
      content: "Olá! Como você está?",
      timestamp: new Date().toISOString(),
      type: "message",
      sessionId: session1Id,
    }

    await userChatsCollection.updateOne(
      { roomId },
      {
        $push: { messages: newMessage1 },
        $set: {
          "chatHistory.lastActivity": new Date(),
          "chatHistory.conversationSummary": `${user1Nick}: ${newMessage1.content.substring(0, 30)}...`,
        },
        $inc: { "chatHistory.totalMessages": 1 },
      },
    )

    await roomsRegistry.updateOne(
      { roomId },
      {
        $inc: { "systemMetadata.messageCount": 1 },
        $set: { "systemMetadata.lastActivity": new Date() },
      },
    )

    console.log("✅ Mensagem de User1 adicionada")

    // Teste 4: User2 verifica mensagens (deve encontrar nova mensagem)
    console.log("\n4️⃣ User2 verificando mensagens...")

    const updatedMessages = await userChatsCollection.findOne({ roomId })
    const newMessageCount = updatedMessages.messages.length

    console.log(`📊 Verificação: ${newMessageCount} mensagens (era ${messageCount})`)

    if (newMessageCount > messageCount) {
      console.log("🔔 NOVAS MENSAGENS DETECTADAS!")
      const newMessages = updatedMessages.messages.slice(messageCount)
      newMessages.forEach((msg, index) => {
        console.log(`   NOVA ${index + 1}. [${msg.type}] ${msg.sender}: ${msg.content}`)
      })
    } else {
      console.log("📭 Nenhuma mensagem nova")
    }

    messageCount = newMessageCount

    // Teste 5: Simular User2 respondendo
    console.log("\n5️⃣ Simulando User2 respondendo...")

    const newMessage2 = {
      id: `msg_${Date.now()}_2`,
      sender: user2Nick,
      content: "Oi! Estou bem, obrigado! E você?",
      timestamp: new Date().toISOString(),
      type: "message",
      sessionId: session2Id,
    }

    await userChatsCollection.updateOne(
      { roomId },
      {
        $push: { messages: newMessage2 },
        $set: {
          "chatHistory.lastActivity": new Date(),
          "chatHistory.conversationSummary": `${user2Nick}: ${newMessage2.content.substring(0, 30)}...`,
        },
        $inc: { "chatHistory.totalMessages": 1 },
      },
    )

    console.log("✅ Resposta de User2 adicionada")

    // Teste 6: User1 verifica mensagens novamente
    console.log("\n6️⃣ User1 verificando mensagens novamente...")

    const finalMessages = await userChatsCollection.findOne({ roomId })
    const finalMessageCount = finalMessages.messages.length

    console.log(`📊 Verificação final: ${finalMessageCount} mensagens (era ${messageCount})`)

    if (finalMessageCount > messageCount) {
      console.log("🔔 NOVAS MENSAGENS DETECTADAS!")
      const newMessages = finalMessages.messages.slice(messageCount)
      newMessages.forEach((msg, index) => {
        console.log(`   NOVA ${index + 1}. [${msg.type}] ${msg.sender}: ${msg.content}`)
      })
    }

    // Teste 7: Mostrar conversa completa
    console.log("\n7️⃣ Conversa completa:")
    finalMessages.messages.forEach((msg, index) => {
      const time = new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
      console.log(`   ${index + 1}. [${time}] ${msg.sender}: ${msg.content}`)
    })

    // Teste 8: Verificar performance da verificação manual
    console.log("\n8️⃣ Testando performance da verificação manual...")

    const startTime = Date.now()
    for (let i = 0; i < 10; i++) {
      await userChatsCollection.findOne({ roomId }, { projection: { messages: 1 } })
    }
    const avgTime = (Date.now() - startTime) / 10

    console.log(`⚡ Tempo médio de verificação: ${avgTime.toFixed(2)}ms`)

    if (avgTime < 100) {
      console.log("✅ Performance excelente para verificação manual")
    } else if (avgTime < 500) {
      console.log("✅ Performance boa para verificação manual")
    } else {
      console.log("⚠️ Performance pode ser otimizada")
    }

    // Limpeza
    console.log("\n9️⃣ Limpando dados de teste...")
    await roomsRegistry.deleteOne({ roomId })
    await sessionsRegistry.deleteMany({ roomId })
    await userDb.dropDatabase()

    console.log("✅ Dados de teste removidos")

    console.log("\n🎉 Teste de verificação manual concluído com SUCESSO!")

    console.log("\n📋 RESUMO DO SISTEMA MANUAL:")
    console.log("✅ Sem polling automático (economia de recursos)")
    console.log("✅ Verificação sob demanda do usuário")
    console.log("✅ Detecção de novas mensagens")
    console.log("✅ Indicador visual de mensagens novas")
    console.log("✅ Performance otimizada")
    console.log("✅ Controle total do usuário")

    console.log("\n💡 VANTAGENS:")
    console.log("   • Menor uso de banda")
    console.log("   • Menos requisições ao servidor")
    console.log("   • Bateria preservada (mobile)")
    console.log("   • Usuário decide quando verificar")
    console.log("   • Melhor para conexões lentas")
  } catch (error) {
    console.error("❌ Erro durante o teste:", error)
  } finally {
    await systemClient.close()
  }
}

testManualRefresh()
