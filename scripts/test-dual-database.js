// Teste do sistema de banco duplo
import { MongoClient } from "mongodb"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

async function testDualDatabase() {
  console.log("🏗️ Testando Sistema de Banco Duplo...\n")

  try {
    // Teste 1: Verificar estrutura do sistema auxiliar
    console.log("1️⃣ Verificando sistema auxiliar...")
    const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
    await systemClient.connect()

    const systemDb = systemClient.db(SYSTEM_DB_NAME)
    const roomsRegistry = systemDb.collection("rooms_registry")
    const sessionsRegistry = systemDb.collection("sessions_registry")

    // Limpar dados de teste anteriores
    await roomsRegistry.deleteMany({ roomId: /^test_/ })
    await sessionsRegistry.deleteMany({ roomId: /^test_/ })

    console.log("✅ Sistema auxiliar conectado e limpo")

    // Teste 2: Simular criação de sala
    console.log("\n2️⃣ Simulando criação de sala...")
    const roomId = `test_room_${Date.now()}`
    const creatorNick = "TestCreator"
    const sessionId = `test_session_${Date.now()}`

    // 2a. Dados no sistema auxiliar (metadados)
    const roomRegistry = {
      roomId,
      createdBy: creatorNick,
      createdAt: new Date(),
      status: "active",
      participantCount: 1,
      maxParticipants: 2,
      userMongoInfo: {
        dbName: `user_chats_${roomId.split("_")[2]}`,
        uriHash: "test_hash_123",
      },
      systemMetadata: {
        lastHealthCheck: new Date(),
        messageCount: 1,
        isPublic: true,
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
      ipHash: "test_ip_hash",
    }

    await sessionsRegistry.insertOne(sessionRegistry)

    console.log("✅ Metadados salvos no sistema auxiliar")

    // 2b. Dados do usuário no MongoDB específico
    const userDbName = `user_chats_${roomId.split("_")[2]}`
    const userClient = new MongoClient(SYSTEM_MONGODB_URI)
    await userClient.connect()

    const userDb = userClient.db(userDbName)
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
        version: "1.0",
      },
    }

    await userChatsCollection.insertOne(userChatDocument)
    console.log("✅ Dados do usuário salvos no MongoDB específico")

    // Teste 3: Simular entrada de segundo usuário
    console.log("\n3️⃣ Simulando entrada de segundo usuário...")
    const participantNick = "TestParticipant"
    const participantSessionId = `test_session_participant_${Date.now()}`

    // 3a. Atualizar sistema auxiliar
    await roomsRegistry.updateOne(
      { roomId },
      {
        $inc: { participantCount: 1 },
        $set: { lastActivity: new Date() },
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
      ipHash: "test_ip_hash_2",
      rejoining: false,
    })

    // 3b. Atualizar dados do usuário
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
            id: `sys_${Date.now()}_2`,
            type: "system",
            content: `${participantNick} entrou na sala`,
            timestamp: new Date().toISOString(),
            sender: "system",
          },
        },
        $set: {
          [`userPreferences.${participantNick}`]: {
            theme: "dark",
            notifications: true,
            language: "pt-BR",
          },
          "chatHistory.lastActivity": new Date(),
        },
        $inc: {
          "chatHistory.totalMessages": 1,
        },
      },
    )

    console.log("✅ Segundo usuário adicionado em ambos os bancos")

    // Teste 4: Simular conversa
    console.log("\n4️⃣ Simulando conversa...")
    const conversation = [
      { sender: creatorNick, content: "Olá! Como você está?" },
      { sender: participantNick, content: "Oi! Estou bem, obrigado!" },
      { sender: creatorNick, content: "Que bom! Este sistema dual está funcionando." },
      { sender: participantNick, content: "Sim! Metadados no auxiliar, dados no nosso MongoDB." },
    ]

    for (const msg of conversation) {
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sender: msg.sender,
        content: msg.content,
        timestamp: new Date().toISOString(),
        type: "message",
        sessionId: msg.sender === creatorNick ? sessionId : participantSessionId,
      }

      // Salvar no MongoDB do usuário
      await userChatsCollection.updateOne(
        { roomId },
        {
          $push: { messages: message },
          $set: {
            "chatHistory.lastActivity": new Date(),
            "chatHistory.conversationSummary": `${msg.sender}: ${msg.content.substring(0, 30)}...`,
          },
          $inc: { "chatHistory.totalMessages": 1 },
        },
      )

      // Atualizar metadados no sistema auxiliar
      await roomsRegistry.updateOne(
        { roomId },
        {
          $set: { lastActivity: new Date() },
          $inc: { "systemMetadata.messageCount": 1 },
        },
      )

      console.log(`   💬 ${msg.sender}: ${msg.content}`)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    // Teste 5: Verificar separação de dados
    console.log("\n5️⃣ Verificando separação de dados...")

    // 5a. Dados do sistema auxiliar (apenas metadados)
    const finalRoomRegistry = await roomsRegistry.findOne({ roomId })
    const allSessions = await sessionsRegistry.find({ roomId }).toArray()

    console.log("📊 SISTEMA AUXILIAR:")
    console.log(`   Participantes: ${finalRoomRegistry.participantCount}`)
    console.log(`   Mensagens (contador): ${finalRoomRegistry.systemMetadata.messageCount}`)
    console.log(`   Sessões ativas: ${allSessions.filter((s) => s.status === "active").length}`)
    console.log(`   Tamanho do documento: ${JSON.stringify(finalRoomRegistry).length} bytes`)

    // 5b. Dados do usuário (conteúdo completo)
    const finalUserChat = await userChatsCollection.findOne({ roomId })

    console.log("\n📊 MONGODB DO USUÁRIO:")
    console.log(`   Participantes: ${finalUserChat.participants.length}`)
    console.log(`   Mensagens (reais): ${finalUserChat.messages.length}`)
    console.log(`   Preferências: ${Object.keys(finalUserChat.userPreferences).length} usuários`)
    console.log(`   Tamanho do documento: ${JSON.stringify(finalUserChat).length} bytes`)
    console.log(`   Tópicos da conversa: ${finalUserChat.chatHistory.topics.length}`)

    // Teste 6: Simular reentrada (invalidar sessões)
    console.log("\n6️⃣ Testando reentrada com invalidação de sessões...")

    // Invalidar sessão antiga no sistema auxiliar
    await sessionsRegistry.updateOne(
      { sessionId, nick: creatorNick },
      {
        $set: {
          status: "invalidated",
          invalidatedAt: new Date(),
          reason: "user_rejoined",
        },
      },
    )

    // Nova sessão
    const newSessionId = `new_session_${Date.now()}`
    await sessionsRegistry.insertOne({
      sessionId: newSessionId,
      roomId,
      nick: creatorNick,
      role: "creator",
      status: "active",
      createdAt: new Date(),
      lastActivity: new Date(),
      ipHash: "test_ip_hash_new",
      rejoining: true,
    })

    // Atualizar dados do usuário
    await userChatsCollection.updateOne(
      { roomId },
      {
        $set: {
          "participants.$[elem].sessionId": newSessionId,
          "participants.$[elem].lastActivity": new Date(),
        },
        $push: {
          messages: {
            id: `sys_${Date.now()}_rejoin`,
            type: "system",
            content: `${creatorNick} voltou para a sala`,
            timestamp: new Date().toISOString(),
            sender: "system",
          },
        },
      },
      {
        arrayFilters: [{ "elem.nick": creatorNick }],
      },
    )

    const activeSessions = await sessionsRegistry.find({ roomId, status: "active" }).toArray()
    const invalidatedSessions = await sessionsRegistry.find({ roomId, status: "invalidated" }).toArray()

    console.log(`✅ Sessões ativas: ${activeSessions.length}`)
    console.log(`✅ Sessões invalidadas: ${invalidatedSessions.length}`)

    // Limpeza
    console.log("\n7️⃣ Limpando dados de teste...")
    await roomsRegistry.deleteOne({ roomId })
    await sessionsRegistry.deleteMany({ roomId })
    await userDb.dropDatabase()

    await systemClient.close()
    await userClient.close()

    console.log("✅ Dados de teste removidos")

    console.log("\n🎉 Teste do sistema dual concluído com sucesso!")

    // Resumo
    console.log("\n📋 RESUMO DA ARQUITETURA DUAL:")
    console.log("🏗️  SISTEMA AUXILIAR (Próprio):")
    console.log("   • Metadados das salas")
    console.log("   • Registro de sessões")
    console.log("   • Controle de acesso")
    console.log("   • Estatísticas do sistema")
    console.log("")
    console.log("📊 MONGODB DO USUÁRIO (Fornecido):")
    console.log("   • Dados completos dos participantes")
    console.log("   • Histórico completo de mensagens")
    console.log("   • Preferências dos usuários")
    console.log("   • Contexto da conversa")
    console.log("")
    console.log("✅ Vantagens:")
    console.log("   • Dados sensíveis ficam no MongoDB do usuário")
    console.log("   • Sistema auxiliar gerencia apenas metadados")
    console.log("   • Escalabilidade e segurança aprimoradas")
    console.log("   • Controle granular de sessões")
  } catch (error) {
    console.error("❌ Erro durante os testes:", error)
  }
}

testDualDatabase()
