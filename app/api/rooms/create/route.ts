import { type NextRequest, NextResponse } from "next/server"
import { MongoClient } from "mongodb"

// MongoDB auxiliar para gerenciamento do sistema
const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

export async function POST(request: NextRequest) {
  try {
    const { creatorNick, mongoUri, useCurrentMongo, currentRoomId } = await request.json()

    if (!creatorNick) {
      return NextResponse.json({ error: "Nick do criador é obrigatório" }, { status: 400 })
    }

    // Validar se tem MongoDB URI ou se vai usar a atual
    if (!useCurrentMongo && !mongoUri) {
      return NextResponse.json(
        { error: "String de conexão MongoDB é obrigatória quando não usar a atual" },
        { status: 400 },
      )
    }

    if (useCurrentMongo && !currentRoomId) {
      return NextResponse.json({ error: "ID da sala atual é obrigatório para reutilizar conexão" }, { status: 400 })
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log(`🏗️ Criando sala ${roomId} para ${creatorNick}`)

    // 1. Buscar informações da sala atual se for reutilizar MongoDB
    let finalMongoUri = mongoUri
    let finalDbName = `user_chats_${roomId.split("_")[1]}`

    if (useCurrentMongo && currentRoomId) {
      console.log("🔄 Reutilizando conexão MongoDB da sala atual...")

      const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
      await systemClient.connect()

      const systemDb = systemClient.db(SYSTEM_DB_NAME)
      const roomsRegistry = systemDb.collection("rooms_registry")

      const currentRoom = await roomsRegistry.findOne({ roomId: currentRoomId })

      if (!currentRoom || !currentRoom.userMongoInfo?.mongoUri) {
        await systemClient.close()
        return NextResponse.json(
          { error: "Não foi possível encontrar a conexão MongoDB da sala atual" },
          { status: 400 },
        )
      }

      finalMongoUri = currentRoom.userMongoInfo.mongoUri
      // Usar o mesmo banco de dados da sala atual para manter organização
      finalDbName = currentRoom.userMongoInfo.actualDbName || currentRoom.userMongoInfo.dbName

      await systemClient.close()
      console.log("✅ Conexão MongoDB reutilizada com sucesso")
    }

    // 2. Registrar sala no sistema auxiliar
    const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
    await systemClient.connect()

    const systemDb = systemClient.db(SYSTEM_DB_NAME)
    const roomsRegistry = systemDb.collection("rooms_registry")
    const sessionsRegistry = systemDb.collection("sessions_registry")

    // Registro da sala no sistema auxiliar
    const roomRegistry = {
      roomId,
      createdBy: creatorNick,
      createdAt: new Date(),
      status: "active",
      participantCount: 1,
      maxParticipants: 2,
      participants: [creatorNick],
      userMongoInfo: {
        mongoUri: finalMongoUri,
        dbName: finalDbName,
        uriHash: Buffer.from(finalMongoUri).toString("base64").slice(0, 16),
        reusingConnection: useCurrentMongo,
        sourceRoomId: useCurrentMongo ? currentRoomId : null,
      },
      systemMetadata: {
        lastHealthCheck: new Date(),
        messageCount: 1,
        isPublic: true,
        lastActivity: new Date(),
        createdViaReuse: useCurrentMongo,
      },
    }

    await roomsRegistry.insertOne(roomRegistry)

    // Registro da sessão
    const sessionRegistry = {
      sessionId,
      roomId,
      nick: creatorNick,
      role: "creator",
      status: "active",
      createdAt: new Date(),
      lastActivity: new Date(),
      ipHash: request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
      createdViaReuse: useCurrentMongo,
    }

    await sessionsRegistry.insertOne(sessionRegistry)

    console.log("✅ Sala registrada no sistema auxiliar")

    // 3. Salvar no MongoDB do usuário
    try {
      const userClient = new MongoClient(finalMongoUri)
      await userClient.connect()

      const userDb = userClient.db(finalDbName)
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
            content: `Sala criada por ${creatorNick}${useCurrentMongo ? " (conexão reutilizada)" : ""}`,
            timestamp: new Date().toISOString(),
            sender: "system",
            metadata: {
              createdViaReuse: useCurrentMongo,
              sourceRoomId: useCurrentMongo ? currentRoomId : null,
            },
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
          dbName: finalDbName,
          mongoUri: finalMongoUri,
          version: "1.0",
          createdViaReuse: useCurrentMongo,
          sourceRoomId: useCurrentMongo ? currentRoomId : null,
        },
      }

      await userChatsCollection.insertOne(userChatDocument)
      await userClient.close()

      console.log("✅ Dados salvos no MongoDB do usuário")

      // Atualizar status no sistema auxiliar
      await roomsRegistry.updateOne(
        { roomId },
        {
          $set: {
            "systemMetadata.userDataSaved": true,
            "userMongoInfo.actualDbName": finalDbName,
          },
        },
      )
    } catch (userDbError) {
      console.error("⚠️ Erro ao salvar no MongoDB do usuário:", userDbError)

      // Marcar como erro no sistema auxiliar, mas não falhar
      await roomsRegistry.updateOne(
        { roomId },
        {
          $set: {
            "systemMetadata.userDataSaved": false,
            "systemMetadata.userDataError": userDbError.message,
          },
        },
      )
    }

    await systemClient.close()

    console.log("✅ Sala criada com sucesso!")

    return NextResponse.json({
      roomId,
      sessionId,
      message: "Sala criada com sucesso",
      reusingConnection: useCurrentMongo,
      sourceRoomId: useCurrentMongo ? currentRoomId : null,
    })
  } catch (error) {
    console.error("Erro ao criar sala:", error)
    return NextResponse.json(
      { error: "Erro ao criar sala. Verifique a configuração e tente novamente." },
      { status: 500 },
    )
  }
}
