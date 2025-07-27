import { NextResponse } from "next/server"
import { MongoClient } from "mongodb"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await context.params

    console.log(`🔍 Buscando informações da sala ${roomId}...`)

    // 1. Buscar no sistema auxiliar SEMPRE
    const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
    await systemClient.connect()

    const systemDb = systemClient.db(SYSTEM_DB_NAME)
    const roomsRegistry = systemDb.collection("rooms_registry")

    const roomRegistry = await roomsRegistry.findOne({ roomId })

    if (!roomRegistry) {
      await systemClient.close()
      console.log(`❌ Sala ${roomId} não encontrada no sistema auxiliar`)
      return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
    }

    console.log(`✅ Sala encontrada no sistema auxiliar: ${roomRegistry.status}`)

    // 2. Tentar buscar dados detalhados no MongoDB do usuário
    let detailedData = null
    let userDataAvailable = false

    try {
      if (roomRegistry.userMongoInfo?.mongoUri) {
        console.log("📊 Tentando acessar MongoDB do usuário...")

        const userClient = new MongoClient(roomRegistry.userMongoInfo.mongoUri)
        await userClient.connect()

        const userDbName = roomRegistry.userMongoInfo.actualDbName || roomRegistry.userMongoInfo.dbName
        const userDb = userClient.db(userDbName)
        const userChatsCollection = userDb.collection("user_chats")

        const userChatDocument = await userChatsCollection.findOne({ roomId })

        if (userChatDocument) {
          detailedData = userChatDocument
          userDataAvailable = true
          console.log("✅ Dados detalhados recuperados do MongoDB do usuário")
        }

        await userClient.close()
      }
    } catch (userDbError) {
      console.warn("⚠️ Erro ao acessar MongoDB do usuário:", userDbError.message)
      // Continuar com dados do sistema auxiliar
    }

    await systemClient.close()

    // 3. Combinar dados ou usar apenas do sistema auxiliar
    const roomInfo = {
      roomId: roomRegistry.roomId,
      createdBy: roomRegistry.createdBy,
      createdAt: roomRegistry.createdAt,
      participants: detailedData ? detailedData.participants.map((p) => p.nick) : roomRegistry.participants,
      participantCount: roomRegistry.participantCount,
      maxParticipants: roomRegistry.maxParticipants,
      messageCount: detailedData ? detailedData.chatHistory?.totalMessages : roomRegistry.systemMetadata.messageCount,
      lastActivity: detailedData ? detailedData.chatHistory?.lastActivity : roomRegistry.systemMetadata.lastActivity,
      status: roomRegistry.status,
      hasCustomMongo: !!roomRegistry.userMongoInfo?.mongoUri,
      userDataAvailable,
      systemMetadata: {
        userDataSaved: roomRegistry.systemMetadata.userDataSaved,
        isPublic: roomRegistry.systemMetadata.isPublic,
      },
    }

    console.log("✅ Informações da sala compiladas com sucesso")

    return NextResponse.json(roomInfo)
  } catch (error) {
    console.error("Erro ao buscar sala:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
