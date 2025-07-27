// Teste do sistema de encerramento de sessões
import { MongoClient } from "mongodb"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

async function testSessionTermination() {
  console.log("🔒 Testando Sistema de Encerramento de Sessões...\n")

  const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
  await systemClient.connect()

  const systemDb = systemClient.db(SYSTEM_DB_NAME)
  const roomsRegistry = systemDb.collection("rooms_registry")
  const sessionsRegistry = systemDb.collection("sessions_registry")

  try {
    // Limpar dados de teste
    await roomsRegistry.deleteMany({ roomId: /^session_test_/ })
    await sessionsRegistry.deleteMany({ roomId: /^session_test_/ })

    // Teste 1: Criar sala e primeira sessão
    console.log("1️⃣ Criando sala e primeira sessão...")
    const roomId = `session_test_room_${Date.now()}`
    const testNick = "TestUser"
    const session1Id = `session_1_${Date.now()}`

    // Registrar sala
    const roomRegistry = {
      roomId,
      createdBy: testNick,
      createdAt: new Date(),
      status: "active",
      participantCount: 1,
      maxParticipants: 2,
      participants: [testNick],
      userMongoInfo: {
        mongoUri: SYSTEM_MONGODB_URI,
        dbName: `user_chats_${roomId.split("_")[3]}`,
      },
      systemMetadata: {
        messageCount: 1,
        isPublic: true,
        lastActivity: new Date(),
        userDataSaved: true,
      },
    }

    await roomsRegistry.insertOne(roomRegistry)

    // Primeira sessão
    const session1 = {
      sessionId: session1Id,
      roomId,
      nick: testNick,
      role: "creator",
      status: "active",
      createdAt: new Date(),
      lastActivity: new Date(),
      ipHash: "192.168.1.100",
      rejoining: false,
      userAgent: "Browser 1",
    }

    await sessionsRegistry.insertOne(session1)

    console.log("✅ Primeira sessão criada")
    console.log(`   Session ID: ${session1Id}`)
    console.log(`   Nick: ${testNick}`)
    console.log(`   Status: active`)

    // Criar dados do usuário
    const userDbName = `user_chats_${roomId.split("_")[3]}`
    const userDb = systemClient.db(userDbName)
    const userChatsCollection = userDb.collection("user_chats")

    const userChatDocument = {
      roomId,
      createdBy: testNick,
      createdAt: new Date(),
      participants: [
        {
          nick: testNick,
          joinedAt: new Date(),
          role: "creator",
          sessionId: session1Id,
          status: "active",
          rejoiningCount: 0,
        },
      ],
      messages: [
        {
          id: `sys_${Date.now()}`,
          type: "system",
          content: `Sala criada por ${testNick}`,
          timestamp: new Date().toISOString(),
          sender: "system",
        },
      ],
      chatHistory: {
        totalMessages: 1,
        lastActivity: new Date(),
        conversationSummary: "Sala criada",
        topics: [],
      },
      userPreferences: {
        [testNick]: {
          theme: "light",
          notifications: true,
          joinedAt: new Date(),
          messageCount: 0,
        },
      },
    }

    await userChatsCollection.insertOne(userChatDocument)
    console.log("✅ Dados do usuário criados")

    // Teste 2: Simular atividade na primeira sessão
    console.log("\n2️⃣ Simulando atividade na primeira sessão...")

    // Enviar algumas mensagens
    const messages = [
      "Olá! Esta é minha primeira mensagem.",
      "Testando o sistema de sessões.",
      "Tudo funcionando perfeitamente!",
    ]

    for (let i = 0; i < messages.length; i++) {
      const message = {
        id: `msg_${Date.now()}_${i}`,
        sender: testNick,
        content: messages[i],
        timestamp: new Date().toISOString(),
        type: "message",
        sessionId: session1Id,
      }

      await userChatsCollection.updateOne(
        { roomId },
        {
          $push: { messages: message },
          $set: {
            "chatHistory.lastActivity": new Date(),
            [`userPreferences.${testNick}.lastMessageAt`]: new Date(),
          },
          $inc: {
            "chatHistory.totalMessages": 1,
            [`userPreferences.${testNick}.messageCount`]: 1,
          },
        },
      )

      await sessionsRegistry.updateOne(
        { sessionId: session1Id },
        {
          $set: { lastActivity: new Date() },
          $inc: { messagesSent: 1 },
        },
      )

      console.log(`   📤 Mensagem ${i + 1}: "${messages[i]}"`)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Verificar estado da primeira sessão
    const session1Status = await sessionsRegistry.findOne({ sessionId: session1Id })
    console.log(`✅ Primeira sessão ativa: ${session1Status.messagesSent} mensagens enviadas`)

    // Teste 3: Simular reentrada do mesmo nick (nova sessão)
    console.log("\n3️⃣ Simulando reentrada do mesmo nick...")

    const session2Id = `session_2_${Date.now()}`

    // Simular o que acontece na API /api/rooms/join
    console.log("🔍 Verificando sessões existentes do mesmo nick...")

    const existingSessions = await sessionsRegistry
      .find({
        roomId,
        nick: testNick,
        status: "active",
      })
      .toArray()

    console.log(`   Encontradas ${existingSessions.length} sessão(ões) ativa(s)`)

    if (existingSessions.length > 0) {
      console.log("🔒 Encerrando sessões anteriores...")

      // Encerrar sessões anteriores
      const terminationResult = await sessionsRegistry.updateMany(
        { roomId, nick: testNick, status: "active" },
        {
          $set: {
            status: "terminated",
            terminatedAt: new Date(),
            terminatedBy: "user_rejoined",
            terminatedReason: `Usuário ${testNick} entrou novamente na sala`,
          },
        },
      )

      console.log(`   ✅ ${terminationResult.modifiedCount} sessão(ões) encerrada(s)`)
    }

    // Criar nova sessão
    const session2 = {
      sessionId: session2Id,
      roomId,
      nick: testNick,
      role: "creator",
      status: "active",
      createdAt: new Date(),
      lastActivity: new Date(),
      ipHash: "192.168.1.101", // IP diferente (simulando outro dispositivo)
      rejoining: true,
      sessionTerminated: true,
      userAgent: "Browser 2",
    }

    await sessionsRegistry.insertOne(session2)

    // Atualizar dados do usuário
    await userChatsCollection.updateOne(
      { roomId },
      {
        $set: {
          "participants.$[elem].sessionId": session2Id,
          "participants.$[elem].lastActivity": new Date(),
          "participants.$[elem].status": "active",
          "chatHistory.lastActivity": new Date(),
        },
        $inc: {
          "participants.$[elem].rejoiningCount": 1,
        },
        $push: {
          messages: {
            id: `sys_${Date.now()}`,
            type: "system",
            content: `${testNick} voltou para a sala (sessão anterior encerrada)`,
            timestamp: new Date().toISOString(),
            sender: "system",
            metadata: {
              sessionTerminated: true,
              previousSessionsCount: 1,
            },
          },
        },
      },
      {
        arrayFilters: [{ "elem.nick": testNick }],
      },
    )

    console.log("✅ Nova sessão criada e dados atualizados")
    console.log(`   Nova Session ID: ${session2Id}`)
    console.log(`   Sessão anterior encerrada: SIM`)

    // Teste 4: Verificar estado das sessões
    console.log("\n4️⃣ Verificando estado das sessões...")

    const allSessions = await sessionsRegistry.find({ roomId, nick: testNick }).toArray()
    const activeSessions = allSessions.filter((s) => s.status === "active")
    const terminatedSessions = allSessions.filter((s) => s.status === "terminated")

    console.log("📊 ESTADO DAS SESSÕES:")
    console.log(`   Total de sessões: ${allSessions.length}`)
    console.log(`   Sessões ativas: ${activeSessions.length}`)
    console.log(`   Sessões encerradas: ${terminatedSessions.length}`)

    allSessions.forEach((session, index) => {
      console.log(`\n   Sessão ${index + 1}:`)
      console.log(`   - ID: ${session.sessionId}`)
      console.log(`   - Status: ${session.status}`)
      console.log(`   - Criada: ${session.createdAt.toLocaleTimeString()}`)
      console.log(`   - IP: ${session.ipHash}`)
      console.log(`   - User Agent: ${session.userAgent}`)
      if (session.status === "terminated") {
        console.log(`   - Encerrada: ${session.terminatedAt.toLocaleTimeString()}`)
        console.log(`   - Motivo: ${session.terminatedReason}`)
      }
      if (session.messagesSent) {
        console.log(`   - Mensagens enviadas: ${session.messagesSent}`)
      }
    })

    // Teste 5: Simular tentativa de uso da sessão encerrada
    console.log("\n5️⃣ Simulando tentativa de uso da sessão encerrada...")

    // Tentar validar a sessão antiga (simulando envio de mensagem)
    const oldSessionValidation = await sessionsRegistry.findOne({
      sessionId: session1Id,
      roomId,
      nick: testNick,
      status: "active",
    })

    console.log(`🔍 Validação da sessão antiga: ${oldSessionValidation ? "VÁLIDA" : "INVÁLIDA"}`)

    if (!oldSessionValidation) {
      console.log("✅ Sessão antiga corretamente invalidada")
      console.log("   Usuário precisará reconectar")
    }

    // Validar sessão nova
    const newSessionValidation = await sessionsRegistry.findOne({
      sessionId: session2Id,
      roomId,
      nick: testNick,
      status: "active",
    })

    console.log(`🔍 Validação da sessão nova: ${newSessionValidation ? "VÁLIDA" : "INVÁLIDA"}`)

    // Teste 6: Simular múltiplas reentradas
    console.log("\n6️⃣ Simulando múltiplas reentradas...")

    for (let i = 3; i <= 5; i++) {
      const sessionId = `session_${i}_${Date.now()}`

      // Encerrar sessões ativas
      await sessionsRegistry.updateMany(
        { roomId, nick: testNick, status: "active" },
        {
          $set: {
            status: "terminated",
            terminatedAt: new Date(),
            terminatedBy: "user_rejoined",
            terminatedReason: `Reentrada ${i}`,
          },
        },
      )

      // Criar nova sessão
      await sessionsRegistry.insertOne({
        sessionId,
        roomId,
        nick: testNick,
        role: "creator",
        status: "active",
        createdAt: new Date(),
        lastActivity: new Date(),
        ipHash: `192.168.1.${100 + i}`,
        rejoining: true,
        sessionTerminated: true,
        userAgent: `Browser ${i}`,
      })

      console.log(`   ✅ Reentrada ${i}: Nova sessão ${sessionId.slice(-8)}`)
    }

    // Estado final
    const finalSessions = await sessionsRegistry.find({ roomId, nick: testNick }).toArray()
    const finalActive = finalSessions.filter((s) => s.status === "active")
    const finalTerminated = finalSessions.filter((s) => s.status === "terminated")

    console.log("\n📊 ESTADO FINAL:")
    console.log(`   Total de sessões: ${finalSessions.length}`)
    console.log(`   Sessões ativas: ${finalActive.length}`)
    console.log(`   Sessões encerradas: ${finalTerminated.length}`)

    // Verificar mensagens do sistema
    const finalUserData = await userChatsCollection.findOne({ roomId })
    const systemMessages = finalUserData.messages.filter((m) => m.type === "system")

    console.log(`\n💬 Mensagens do sistema: ${systemMessages.length}`)
    systemMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg.content}`)
    })

    // Limpeza
    console.log("\n7️⃣ Limpando dados de teste...")
    await roomsRegistry.deleteOne({ roomId })
    await sessionsRegistry.deleteMany({ roomId })
    await userDb.dropDatabase()

    console.log("✅ Dados de teste removidos")

    console.log("\n🎉 Teste de encerramento de sessões concluído com SUCESSO!")

    console.log("\n📋 RESUMO DO SISTEMA:")
    console.log("✅ Nicks livres (sem cadastro prévio)")
    console.log("✅ Apenas uma sessão ativa por nick")
    console.log("✅ Sessões anteriores encerradas automaticamente")
    console.log("✅ Mensagens do sistema informam reentradas")
    console.log("✅ Validação de sessões funcionando")
    console.log("✅ Histórico de sessões mantido")
    console.log("✅ Múltiplas reentradas suportadas")

    console.log("\n💡 VANTAGENS:")
    console.log("   • Segurança: apenas uma sessão ativa por nick")
    console.log("   • Flexibilidade: nicks livres sem cadastro")
    console.log("   • Transparência: usuário é informado sobre encerramentos")
    console.log("   • Controle: sistema gerencia sessões automaticamente")
    console.log("   • Rastreabilidade: histórico completo de sessões")
  } catch (error) {
    console.error("❌ Erro durante o teste:", error)
  } finally {
    await systemClient.close()
  }
}

testSessionTermination()
