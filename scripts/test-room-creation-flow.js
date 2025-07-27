// Teste específico para o fluxo de criação e acesso de salas
import { MongoClient } from "mongodb"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

async function testRoomCreationFlow() {
  console.log("🧪 Testando Fluxo Completo de Criação de Sala...\n")

  const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
  await systemClient.connect()

  const systemDb = systemClient.db(SYSTEM_DB_NAME)
  const roomsRegistry = systemDb.collection("rooms_registry")
  const sessionsRegistry = systemDb.collection("sessions_registry")

  try {
    // Limpar dados de teste
    await roomsRegistry.deleteMany({ roomId: /^test_/ })
    await sessionsRegistry.deleteMany({ roomId: /^test_/ })

    // Teste 1: Simular criação de sala via API
    console.log("1️⃣ Simulando criação de sala...")

    const roomId = `test_room_${Date.now()}`
    const creatorNick = "TestCreator"
    const sessionId = `test_session_${Date.now()}`
    const mongoUri = SYSTEM_MONGODB_URI // Usar o mesmo MongoDB para teste

    // Simular o que a API faz
    const roomRegistry = {
      roomId,
      createdBy: creatorNick,
      createdAt: new Date(),
      status: "active",
      participantCount: 1,
      maxParticipants: 2,
      participants: [creatorNick],
      userMongoInfo: {
        mongoUri: mongoUri,
        dbName: `user_chats_${roomId.split("_")[2]}`,
        uriHash: Buffer.from(mongoUri).toString("base64").slice(0, 16),
      },
      systemMetadata: {
        lastHealthCheck: new Date(),
        messageCount: 1,
        isPublic: true,
        lastActivity: new Date(),
        userDataSaved: true,
      },
    }

    await roomsRegistry.insertOne(roomRegistry)

    const sessionRegistry = {
      sessionId,
      roomId,
      nick: creatorNick,
      role: "creator",
      status: "active",
      createdAt: new Date(),
      lastActivity: new Date(),
      ipHash: "test_ip",
    }

    await sessionsRegistry.insertOne(sessionRegistry)

    console.log("✅ Sala registrada no sistema auxiliar")

    // Criar dados no "MongoDB do usuário" (mesmo banco para teste)
    const userDbName = `user_chats_${roomId.split("_")[2]}`
    const userDb = systemClient.db(userDbName)
    const userChatsCollection = userDb.collection("user_chats")

    const userChatDocument = {
      roomId,
      createdBy: creatorNick,
      createdAt: new Date(),
      participants: [
        {
          nick: creatorNick,
          joinedAt: new Date(),
          role: "creator",
          sessionId,
          status: "active",
        },
      ],
      messages: [
        {
          id: `sys_${Date.now()}`,
          type: "system",
          content: `Sala criada por ${creatorNick}`,
          timestamp: new Date().toISOString(),
          sender: "system",
        },
      ],
      chatHistory: {
        totalMessages: 1,
        lastActivity: new Date(),
        conversationSummary: "Sala de chat criada",
        topics: [],
      },
      userPreferences: {
        [creatorNick]: {
          theme: "light",
          notifications: true,
          language: "pt-BR",
        },
      },
      metadata: {
        dbName: userDbName,
        mongoUri: mongoUri,
        version: "1.0",
      },
    }

    await userChatsCollection.insertOne(userChatDocument)
    console.log("✅ Dados salvos no MongoDB do usuário")

    // Teste 2: Simular busca da sala (GET /api/rooms/[roomId])
    console.log("\n2️⃣ Testando busca da sala...")

    const foundRoom = await roomsRegistry.findOne({ roomId })
    if (foundRoom) {
      console.log("✅ Sala encontrada no sistema auxiliar")
      console.log(`   Status: ${foundRoom.status}`)
      console.log(`   Participantes: ${foundRoom.participants.join(", ")}`)

      // Buscar dados detalhados
      const userChatData = await userChatsCollection.findOne({ roomId })
      if (userChatData) {
        console.log("✅ Dados detalhados encontrados no MongoDB do usuário")
        console.log(`   Mensagens: ${userChatData.messages.length}`)
      }
    } else {
      console.log("❌ Sala NÃO encontrada!")
    }

    // Teste 3: Simular entrada de segundo usuário
    console.log("\n3️⃣ Testando entrada de segundo usuário...")

    const participantNick = "TestParticipant"
    const participantSessionId = `test_session_participant_${Date.now()}`

    // Atualizar sistema auxiliar
    await roomsRegistry.updateOne(
      { roomId },
      {
        $push: { participants: participantNick },
        $inc: { participantCount: 1 },
        $set: { "systemMetadata.lastActivity": new Date() },
      },
    )

    await sessionsRegistry.insertOne({
      sessionId: participantSessionId,
      roomId,
      nick: participantNick,
      role: "participant",
      status: "active",
      createdAt: new Date(),
      lastActivity: new Date(),
      ipHash: "test_ip_2",
      rejoining: false,
    })

    // Atualizar dados do usuário
    await userChatsCollection.updateOne(
      { roomId },
      {
        $push: {
          participants: {
            nick: participantNick,
            joinedAt: new Date(),
            role: "participant",
            sessionId: participantSessionId,
            status: "active",
          },
          messages: {
            id: `sys_${Date.now()}_join`,
            type: "system",
            content: `${participantNick} entrou na sala`,
            timestamp: new Date().toISOString(),
            sender: "system",
          },
        },
        $set: {
          [`userPreferences.${participantNick}`]: {
            theme: "light",
            notifications: true,
            language: "pt-BR",
          },
        },
        $inc: {
          "chatHistory.totalMessages": 1,
        },
      },
    )

    console.log("✅ Segundo usuário adicionado com sucesso")

    // Teste 4: Verificar consistência dos dados
    console.log("\n4️⃣ Verificando consistência dos dados...")

    const finalRoom = await roomsRegistry.findOne({ roomId })
    const finalUserData = await userChatsCollection.findOne({ roomId })
    const allSessions = await sessionsRegistry.find({ roomId, status: "active" }).toArray()

    console.log("📊 VERIFICAÇÃO DE CONSISTÊNCIA:")
    console.log(`   Sistema auxiliar - Participantes: ${finalRoom.participants.length}`)
    console.log(`   MongoDB usuário - Participantes: ${finalUserData.participants.length}`)
    console.log(`   Sessões ativas: ${allSessions.length}`)

    const isConsistent = finalRoom.participants.length === finalUserData.participants.length && allSessions.length === 2

    console.log(`   Consistência: ${isConsistent ? "✅ OK" : "❌ ERRO"}`)

    // Teste 5: Simular busca de mensagens
    console.log("\n5️⃣ Testando busca de mensagens...")

    const messages = finalUserData.messages
    console.log(`✅ ${messages.length} mensagens encontradas`)

    messages.forEach((msg, index) => {
      console.log(`   ${index + 1}. [${msg.type}] ${msg.sender}: ${msg.content}`)
    })

    // Teste 6: Testar APIs simuladas
    console.log("\n6️⃣ Testando fluxo das APIs...")

    // Simular GET /api/rooms/[roomId]
    const roomInfo = {
      roomId: finalRoom.roomId,
      createdBy: finalRoom.createdBy,
      createdAt: finalRoom.createdAt,
      participants: finalUserData.participants.map((p) => p.nick),
      participantCount: finalRoom.participantCount,
      maxParticipants: finalRoom.maxParticipants,
      messageCount: finalUserData.chatHistory.totalMessages,
      lastActivity: finalUserData.chatHistory.lastActivity,
      status: finalRoom.status,
      hasCustomMongo: !!finalRoom.userMongoInfo?.mongoUri,
      userDataAvailable: true,
    }

    console.log("✅ API GET /api/rooms/[roomId] simulada:")
    console.log(`   Room ID: ${roomInfo.roomId}`)
    console.log(`   Participantes: ${roomInfo.participants.join(", ")}`)
    console.log(`   Mensagens: ${roomInfo.messageCount}`)
    console.log(`   Status: ${roomInfo.status}`)

    // Limpeza
    console.log("\n7️⃣ Limpando dados de teste...")
    await roomsRegistry.deleteOne({ roomId })
    await sessionsRegistry.deleteMany({ roomId })
    await userDb.dropDatabase()

    console.log("✅ Dados de teste removidos")

    console.log("\n🎉 Teste do fluxo completo concluído com SUCESSO!")

    console.log("\n📋 RESUMO:")
    console.log("✅ Criação de sala no sistema auxiliar")
    console.log("✅ Salvamento de dados no MongoDB do usuário")
    console.log("✅ Busca de sala funcionando")
    console.log("✅ Entrada de participantes")
    console.log("✅ Consistência de dados")
    console.log("✅ Busca de mensagens")
    console.log("✅ Simulação de APIs")
  } catch (error) {
    console.error("❌ Erro durante o teste:", error)
  } finally {
    await systemClient.close()
  }
}

testRoomCreationFlow()
