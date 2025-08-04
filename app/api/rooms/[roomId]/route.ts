import { NextResponse } from "next/server"
import { MongoClient } from "mongodb"
const { LRUCache } = require('lru-cache')
const connectionCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 10 }) // 10 minutos

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await context.params

    console.log(`🔍 Buscando informações da sala ${roomId}...`)
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
    const roomsRegistry = systemDb.collection("rooms_registry")

    const roomRegistry = await roomsRegistry.findOne({ roomId })

    if (!roomRegistry) {
      // await systemClient.close()
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
        const cachedConn = connectionCache.get(roomId)
        var mongoClientUser = null
        var dbName = null
        if (cachedConn) {
          console.log(`🔗 Usando conexão em cache para MongoDB: ${roomId}`)
          mongoClientUser = cachedConn
          dbName = roomRegistry.userMongoInfo.dbName
          console.log(`✅ Conectado ao MongoDB database: ${dbName}`)
        } else {
          const connectionString = roomRegistry.userMongoInfo.mongoUri
          console.log(`🔗 Conectando ao MongoDB.... ${connectionString}`)
          dbName = roomRegistry.userMongoInfo.dbName
          mongoClientUser = new MongoClient(connectionString)
          await mongoClientUser.connect()
          console.log(`✅ Conectado ao MongoDB database: ${dbName}`)
          connectionCache.set(roomId, mongoClientUser)
        } 
        // const userClient = new MongoClient(roomRegistry.userMongoInfo.mongoUri)
        // await userClient.connect()

        const userDbName = roomRegistry.userMongoInfo.actualDbName || roomRegistry.userMongoInfo.dbName
        const userDb = mongoClientUser.db(userDbName)
        const userChatsCollection = userDb.collection("user_chats")

        const userChatDocument = await userChatsCollection.findOne({ roomId })

        if (userChatDocument) {
          detailedData = userChatDocument
          userDataAvailable = true
          console.log("✅ Dados detalhados recuperados do MongoDB do usuário")
        }

        // await mongoClientUser.close()
      }
    } catch (userDbError) {
      if (userDbError instanceof Error) {
        console.warn("⚠️ Erro ao acessar MongoDB do usuário:", userDbError.message)
      } else {
        console.warn("⚠️ Erro ao acessar MongoDB do usuário:", userDbError)
      }
      // Continuar com dados do sistema auxiliar
    }

    // await systemClient.close()

    // 3. Combinar dados ou usar apenas do sistema auxiliar
    const roomInfo = {
      roomId: roomRegistry.roomId,
      createdBy: roomRegistry.createdBy,
      createdAt: roomRegistry.createdAt,
      participants: detailedData ? detailedData.participants.map((p: { nick: any }) => p.nick) : roomRegistry.participants,
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
