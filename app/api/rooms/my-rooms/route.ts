import { NextResponse } from "next/server"
import { MongoClient } from "mongodb"
import { LRUCache } from 'lru-cache'

const connectionCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 10 }) // 10 minutos
const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const creator = searchParams.get("creator")

    if (!creator) {
      return NextResponse.json({ error: "Parâmetro 'creator' é obrigatório" }, { status: 400 })
    }

    console.log(`📋 Buscando salas criadas por: ${creator}`)

    // const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
    // await systemClient.connect()
    let systemDb = null;
    const cachedSystemDb = connectionCache.get("SYSTEM_DB")
    if (cachedSystemDb) {
      systemDb = cachedSystemDb
      console.log(`🔗 Usando conexão em cache para o sistema auxiliar`)
    } else {
      const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
      console.log(`Conectando ao MongoDB: ${SYSTEM_MONGODB_URI}`)
      await systemClient.connect()
      systemDb = systemClient.db(SYSTEM_DB_NAME)
      console.log(`✅ Conectado ao MongoDB database: ${SYSTEM_DB_NAME}`)
      connectionCache.set("SYSTEM_DB", systemDb)
    }

    // const systemDb = systemClient.db(SYSTEM_DB_NAME)
    const roomsRegistry = systemDb.collection("rooms_registry")

    // Buscar salas criadas pelo usuário nas últimas 7 dias
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const myRooms = await roomsRegistry
      .find({
        createdBy: creator,
        createdAt: { $gte: sevenDaysAgo },
        status: "active",
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray()

    console.log(`✅ Encontradas ${myRooms.length} salas para ${creator}`)

    // Enriquecer dados com informações do MongoDB do usuário
    const enrichedRooms = await Promise.all(
      myRooms.map(async (room: { systemMetadata: { messageCount: any; lastActivity: any }; createdAt: any; participants: any; userMongoInfo: { mongoUri: string; actualDbName: any; dbName: any }; roomId: any; createdBy: any; maxParticipants: any; status: any }) => {
        let detailedInfo = {
          messageCount: room.systemMetadata?.messageCount || 0,
          lastActivity: room.systemMetadata?.lastActivity || room.createdAt,
          participants: room.participants || [],
        }

        // Tentar buscar informações detalhadas do MongoDB do usuário
        try {
          if (room.userMongoInfo?.mongoUri) {
            const userClient = new MongoClient(room.userMongoInfo.mongoUri)
            await userClient.connect()

            const userDbName = room.userMongoInfo.actualDbName || room.userMongoInfo.dbName
            const userDb = userClient.db(userDbName)
            const userChatsCollection = userDb.collection("user_chats")

            const userChatDocument = await userChatsCollection.findOne({ roomId: room.roomId })

            if (userChatDocument) {
              detailedInfo = {
                messageCount: userChatDocument.chatHistory?.totalMessages || userChatDocument.messages?.length || 0,
                lastActivity: userChatDocument.chatHistory?.lastActivity || room.createdAt,
                participants: userChatDocument.participants?.map((p: any) => p.nick) || room.participants || [],
              }
            }

            await userClient.close()
          }
        } catch (userDbError) {
          console.warn(`⚠️ Erro ao acessar dados detalhados da sala ${room.roomId}:`, userDbError)
          // Continuar com dados do sistema auxiliar
        }

        return {
          roomId: room.roomId,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          participants: detailedInfo.participants,
          participantCount: detailedInfo.participants.length,
          maxParticipants: room.maxParticipants || 2,
          messageCount: detailedInfo.messageCount,
          lastActivity: detailedInfo.lastActivity,
          status: room.status,
          hasCustomMongo: !!room.userMongoInfo?.mongoUri,
        }
      }),
    )

    // await systemClient.close()

    return NextResponse.json({
      rooms: enrichedRooms,
      total: enrichedRooms.length,
      creator,
    })
  } catch (error) {
    console.error("Erro ao buscar salas do criador:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
