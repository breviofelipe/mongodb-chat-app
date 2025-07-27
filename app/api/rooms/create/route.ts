import { type NextRequest, NextResponse } from "next/server"
import { MongoClient } from "mongodb"

// MongoDB auxiliar para gerenciamento do sistema
const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

export async function POST(request: NextRequest) {
  try {
    const { creatorNick, mongoUri } = await request.json()

    if (!creatorNick || !mongoUri) {
      return NextResponse.json({ error: "Nick do criador e URI MongoDB são obrigatórios" }, { status: 400 })
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log(`🏗️ Criando sala ${roomId} para ${creatorNick}`)

    // 1. Registrar sala no sistema auxiliar PRIMEIRO
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
      participants: [creatorNick], // Lista simples para consultas rápidas
      userMongoInfo: {
        mongoUri: mongoUri, // Salvar URI completa (criptografar em produção)
        dbName: `user_chats_${roomId.split("_")[1]}`,
        uriHash: Buffer.from(mongoUri).toString("base64").slice(0, 16),
      },
      systemMetadata: {
        lastHealthCheck: new Date(),
        messageCount: 1,
        isPublic: true,
        lastActivity: new Date(),
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
    }

    await sessionsRegistry.insertOne(sessionRegistry)

    console.log("✅ Sala registrada no sistema auxiliar")

    // 2. Tentar salvar no MongoDB do usuário
    try {
      const userClient = new MongoClient(mongoUri)
      await userClient.connect()

      // Extrair informações da URI
      const uriParts = mongoUri.match(/mongodb(?:\+srv)?:\/\/(?:([^:]+):([^@]+)@)?([^/]+)\/(.+)/)
      const userDbName = uriParts ? uriParts[4].split("?")[0] : "chatdb"

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
          mongoUri: mongoUri,
          version: "1.0",
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
            "userMongoInfo.actualDbName": userDbName,
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
    })
  } catch (error) {
    console.error("Erro ao criar sala:", error)
    return NextResponse.json({ error: "Erro ao criar sala. Verifique a string de conexão MongoDB." }, { status: 500 })
  }
}
