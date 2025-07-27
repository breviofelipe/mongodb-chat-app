import { NextResponse } from "next/server"
import { MongoClient } from "mongodb"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await context.params

    console.log(`💬 Carregando mensagens da sala ${roomId}...`)

    // 1. Buscar informações da sala no sistema auxiliar
    const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
    await systemClient.connect()

    const systemDb = systemClient.db(SYSTEM_DB_NAME)
    const roomsRegistry = systemDb.collection("rooms_registry")

    const roomRegistry = await roomsRegistry.findOne({ roomId })

    if (!roomRegistry) {
      await systemClient.close()
      return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
    }

    // 2. Tentar buscar mensagens no MongoDB do usuário
    let messages = []
    let messageCount = 0
    let conversationSummary = ""
    let topics = []

    try {
      if (roomRegistry.userMongoInfo?.mongoUri) {
        const userClient = new MongoClient(roomRegistry.userMongoInfo.mongoUri)
        await userClient.connect()

        const userDbName = roomRegistry.userMongoInfo.actualDbName || roomRegistry.userMongoInfo.dbName
        const userDb = userClient.db(userDbName)
        const userChatsCollection = userDb.collection("user_chats")

        const userChatDocument = await userChatsCollection.findOne({ roomId })

        if (userChatDocument) {
          messages = userChatDocument.messages || []
          messageCount = userChatDocument.messages?.length || 0
          conversationSummary = userChatDocument.chatHistory?.conversationSummary || ""
          topics = userChatDocument.chatHistory?.topics || []
          console.log(`✅ ${messages.length} mensagens carregadas do MongoDB do usuário`)
        }

        await userClient.close()
      }
    } catch (userDbError) {
      console.warn("⚠️ Erro ao acessar MongoDB do usuário:", userDbError.message)

      // Fallback: criar mensagens básicas baseadas no sistema auxiliar
      messages = [
        {
          id: `sys_fallback_${Date.now()}`,
          type: "system",
          content: `Sala criada por ${roomRegistry.createdBy}`,
          timestamp: roomRegistry.createdAt.toISOString(),
          sender: "system",
        },
      ]
      messageCount = 1
    }

    await systemClient.close()

    return NextResponse.json({
      messages,
      messageCount,
      conversationSummary,
      topics,
      dataSource: messages.length > 1 ? "user_mongodb" : "system_fallback",
    })
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await context.params
    const { content, sender } = await request.json()
    const sessionId = request.headers.get("session-id")

    if (!content || !sender || !sessionId) {
      return NextResponse.json({ error: "Conteúdo, remetente e sessão são obrigatórios" }, { status: 400 })
    }

    console.log(`📤 ${sender} enviando mensagem na sala ${roomId}...`)

    // 1. Validar sessão no sistema auxiliar
    const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
    await systemClient.connect()

    const systemDb = systemClient.db(SYSTEM_DB_NAME)
    const sessionsRegistry = systemDb.collection("sessions_registry")
    const roomsRegistry = systemDb.collection("rooms_registry")

    const validSession = await sessionsRegistry.findOne({
      sessionId,
      roomId,
      nick: sender,
      status: "active",
    })

    if (!validSession) {
      await systemClient.close()
      return NextResponse.json(
        {
          error: "Sessão inválida ou expirada. Sua sessão pode ter sido encerrada por uma nova conexão.",
          sessionExpired: true,
          reason: "session_terminated_or_invalid",
        },
        { status: 401 },
      )
    }

    const roomRegistry = await roomsRegistry.findOne({ roomId })

    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sender,
      content,
      timestamp: new Date().toISOString(),
      type: "message",
      sessionId,
      metadata: {
        messageLength: content.length,
        userAgent: request.headers.get("user-agent")?.substring(0, 50) || "unknown",
      },
    }

    // 2. Tentar salvar no MongoDB do usuário
    try {
      if (roomRegistry.userMongoInfo?.mongoUri) {
        const userClient = new MongoClient(roomRegistry.userMongoInfo.mongoUri)
        await userClient.connect()

        const userDbName = roomRegistry.userMongoInfo.actualDbName || roomRegistry.userMongoInfo.dbName
        const userDb = userClient.db(userDbName)
        const userChatsCollection = userDb.collection("user_chats")

        await userChatsCollection.updateOne(
          { roomId },
          {
            $push: {
              messages: newMessage,
              "chatHistory.topics": {
                $each: extractTopics(content),
                $slice: -10,
              },
            },
            $set: {
              "chatHistory.lastActivity": new Date(),
              "chatHistory.conversationSummary": `${sender}: ${content.substring(0, 50)}...`,
              [`userPreferences.${sender}.lastMessageAt`]: new Date(),
            },
            $inc: {
              "chatHistory.totalMessages": 1,
              [`userPreferences.${sender}.messageCount`]: 1,
            },
          },
        )

        await userClient.close()
        console.log("✅ Mensagem salva no MongoDB do usuário")
      }
    } catch (userDbError) {
      console.warn("⚠️ Erro ao salvar no MongoDB do usuário:", userDbError.message)
      // Continuar mesmo com erro
    }

    // 3. Atualizar metadados no sistema auxiliar
    await roomsRegistry.updateOne(
      { roomId },
      {
        $set: {
          "systemMetadata.lastActivity": new Date(),
        },
        $inc: {
          "systemMetadata.messageCount": 1,
        },
      },
    )

    // 4. Atualizar atividade da sessão
    await sessionsRegistry.updateOne(
      { sessionId },
      {
        $set: {
          lastActivity: new Date(),
        },
        $inc: {
          messagesSent: 1,
        },
      },
    )

    await systemClient.close()

    console.log("✅ Mensagem processada com sucesso")

    return NextResponse.json({ success: true, message: newMessage })
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

function extractTopics(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/)
  const topics = words.filter(
    (word) =>
      word.length > 4 &&
      !["sobre", "para", "com", "uma", "isso", "essa", "este", "esta", "muito", "mais"].includes(word),
  )
  return topics.slice(0, 3)
}
