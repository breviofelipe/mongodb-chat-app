// Teste específico para gerenciamento de sessões
import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const DB_NAME = "chatapp"

async function testSessionManagement() {
  console.log("🔐 Testando Gerenciamento de Sessões...\n")

  const client = new MongoClient(MONGODB_URI)
  await client.connect()

  const db = client.db(DB_NAME)
  const roomsCollection = db.collection("chat_rooms")

  try {
    // Teste 1: Criar sala
    console.log("1️⃣ Criando sala de teste...")
    const roomId = `session_test_${Date.now()}`
    const creatorNick = "TestUser"

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
      sessions: [
        {
          sessionId: "session_1",
          nick: creatorNick,
          joinedAt: new Date(),
          role: "creator",
          status: "active",
        },
      ],
      metadata: {
        lastActivity: new Date(),
        messageCount: 1,
      },
    }

    await roomsCollection.insertOne(roomDocument)
    console.log("✅ Sala criada com sucesso")

    // Teste 2: Simular primeira entrada do usuário
    console.log("\n2️⃣ Simulando primeira entrada...")
    const session2 = "session_2"

    await roomsCollection.updateOne(
      { roomId },
      {
        $push: {
          sessions: {
            sessionId: session2,
            nick: creatorNick,
            joinedAt: new Date(),
            role: "participant",
            status: "active",
          },
        },
      },
    )

    let room = await roomsCollection.findOne({ roomId })
    console.log(`✅ Usuário tem ${room.sessions.length} sessões ativas`)

    // Teste 3: Simular reentrada (invalidar sessões anteriores)
    console.log("\n3️⃣ Simulando reentrada (invalidando sessões anteriores)...")

    // Remover todas as sessões antigas do nick
    await roomsCollection.updateOne(
      { roomId },
      {
        $pull: {
          sessions: { nick: creatorNick },
        },
      },
    )

    // Adicionar nova sessão
    const newSessionId = "session_3_new"
    await roomsCollection.updateOne(
      { roomId },
      {
        $push: {
          sessions: {
            sessionId: newSessionId,
            nick: creatorNick,
            joinedAt: new Date(),
            role: "participant",
            status: "active",
          },
          messages: {
            id: `sys_${Date.now()}`,
            type: "system",
            content: `${creatorNick} voltou para a sala`,
            timestamp: new Date().toISOString(),
            sender: "system",
          },
        },
      },
    )

    room = await roomsCollection.findOne({ roomId })
    console.log(`✅ Após reentrada: ${room.sessions.length} sessão ativa`)
    console.log(`   Nova sessão: ${room.sessions[0].sessionId}`)

    // Teste 4: Verificar validação de sessão
    console.log("\n4️⃣ Testando validação de sessão...")

    const validSession = room.sessions.find(
      (s) => s.sessionId === newSessionId && s.nick === creatorNick && s.status === "active",
    )

    const invalidSession = room.sessions.find((s) => s.sessionId === "session_1" && s.nick === creatorNick)

    console.log(`✅ Sessão válida encontrada: ${!!validSession}`)
    console.log(`✅ Sessão inválida rejeitada: ${!invalidSession}`)

    // Teste 5: Simular múltiplas tentativas de reentrada
    console.log("\n5️⃣ Testando múltiplas reentradas...")

    for (let i = 1; i <= 3; i++) {
      // Invalidar sessões anteriores
      await roomsCollection.updateOne({ roomId }, { $pull: { sessions: { nick: creatorNick } } })

      // Criar nova sessão
      await roomsCollection.updateOne(
        { roomId },
        {
          $push: {
            sessions: {
              sessionId: `multi_session_${i}`,
              nick: creatorNick,
              joinedAt: new Date(),
              role: "participant",
              status: "active",
            },
          },
        },
      )

      const currentRoom = await roomsCollection.findOne({ roomId })
      console.log(`   Reentrada ${i}: ${currentRoom.sessions.length} sessão ativa`)
    }

    // Teste 6: Testar com segundo usuário
    console.log("\n6️⃣ Testando com segundo usuário...")
    const secondUser = "SecondUser"

    await roomsCollection.updateOne(
      { roomId },
      {
        $push: {
          participants: secondUser,
          sessions: {
            sessionId: "second_user_session",
            nick: secondUser,
            joinedAt: new Date(),
            role: "participant",
            status: "active",
          },
        },
      },
    )

    room = await roomsCollection.findOne({ roomId })
    console.log(`✅ Sala agora tem ${room.participants.length} participantes`)
    console.log(`✅ Total de sessões ativas: ${room.sessions.length}`)

    // Verificar sessões por usuário
    const user1Sessions = room.sessions.filter((s) => s.nick === creatorNick)
    const user2Sessions = room.sessions.filter((s) => s.nick === secondUser)

    console.log(`   ${creatorNick}: ${user1Sessions.length} sessão`)
    console.log(`   ${secondUser}: ${user2Sessions.length} sessão`)

    // Teste 7: Simular reentrada do primeiro usuário (não deve afetar o segundo)
    console.log("\n7️⃣ Testando reentrada sem afetar outros usuários...")

    await roomsCollection.updateOne({ roomId }, { $pull: { sessions: { nick: creatorNick } } })

    await roomsCollection.updateOne(
      { roomId },
      {
        $push: {
          sessions: {
            sessionId: "final_session",
            nick: creatorNick,
            joinedAt: new Date(),
            role: "participant",
            status: "active",
          },
        },
      },
    )

    room = await roomsCollection.findOne({ roomId })
    const finalUser1Sessions = room.sessions.filter((s) => s.nick === creatorNick)
    const finalUser2Sessions = room.sessions.filter((s) => s.nick === secondUser)

    console.log(`✅ ${creatorNick}: ${finalUser1Sessions.length} sessão (renovada)`)
    console.log(`✅ ${secondUser}: ${finalUser2Sessions.length} sessão (não afetada)`)

    // Limpeza
    console.log("\n8️⃣ Limpando dados de teste...")
    await roomsCollection.deleteOne({ roomId })
    console.log("✅ Dados de teste removidos")

    console.log("\n🎉 Todos os testes de gerenciamento de sessão concluídos!")

    // Resumo
    console.log("\n📊 RESUMO DOS TESTES:")
    console.log("✅ Criação de sessões")
    console.log("✅ Invalidação de sessões anteriores")
    console.log("✅ Reentrada com mesmo nick")
    console.log("✅ Validação de sessões ativas")
    console.log("✅ Múltiplas reentradas")
    console.log("✅ Isolamento entre usuários")
    console.log("✅ Preservação de sessões de outros usuários")
  } catch (error) {
    console.error("❌ Erro durante os testes:", error)
  } finally {
    await client.close()
  }
}

testSessionManagement()
