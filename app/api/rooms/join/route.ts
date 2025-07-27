import { type NextRequest, NextResponse } from "next/server"
import { MongoClient } from "mongodb"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

export async function POST(request: NextRequest) {
  try {
    const { nick, roomId } = await request.json()

    if (!nick || !roomId) {
      return NextResponse.json({ error: "Nick e ID da sala são obrigatórios" }, { status: 400 })
    }

    // Validar nick
    const cleanNick = nick.trim()
    if (cleanNick.length === 0 || cleanNick.length > 20) {
      return NextResponse.json({ error: "Nick deve ter entre 1 e 20 caracteres" }, { status: 400 })
    }

    console.log(`🚪 ${cleanNick} tentando entrar na sala ${roomId}`)

    // 1. Buscar informações da sala no sistema auxiliar
    const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
    await systemClient.connect()

    const systemDb = systemClient.db(SYSTEM_DB_NAME)
    const roomsRegistry = systemDb.collection("rooms_registry")
    const sessionsRegistry = systemDb.collection("sessions_registry")

    const roomRegistry = await roomsRegistry.findOne({ roomId, status: "active" })

    if (!roomRegistry) {
      await systemClient.close()
      return NextResponse.json({ error: "Sala não encontrada ou inativa" }, { status: 404 })
    }

    const isRejoining = roomRegistry.participants.includes(cleanNick)
    let sessionTerminated = false

    if (!isRejoining && roomRegistry.participantCount >= roomRegistry.maxParticipants) {
      await systemClient.close()
      return NextResponse.json({ error: "Sala está cheia (máximo 2 participantes)" }, { status: 400 })
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    if (isRejoining) {
      console.log(`🔄 ${cleanNick} está reentrando na sala - encerrando sessões anteriores`)

      // Buscar sessões ativas do mesmo nick
      const existingSessions = await sessionsRegistry
        .find({
          roomId,
          nick: cleanNick,
          status: "active",
        })
        .toArray()

      if (existingSessions.length > 0) {
        sessionTerminated = true
        console.log(`🔒 Encerrando ${existingSessions.length} sessão(ões) anterior(es) de ${cleanNick}`)

        // Invalidar todas as sessões anteriores do mesmo nick
        await sessionsRegistry.updateMany(
          { roomId, nick: cleanNick, status: "active" },
          {
            $set: {
              status: "terminated",
              terminatedAt: new Date(),
              terminatedBy: "user_rejoined",
              terminatedReason: `Usuário ${cleanNick} entrou novamente na sala`,
            },
          },
        )
      }
    } else {
      console.log(`🆕 ${cleanNick} entrando pela primeira vez`)

      // Adicionar à lista de participantes no sistema auxiliar
      await roomsRegistry.updateOne(
        { roomId },
        {
          $push: { participants: cleanNick },
          $inc: { participantCount: 1 },
          $set: { "systemMetadata.lastActivity": new Date() },
        },
      )
    }

    // 2. Registrar nova sessão
    const sessionRegistry = {
      sessionId,
      roomId,
      nick: cleanNick,
      role: roomRegistry.createdBy === cleanNick ? "creator" : "participant",
      status: "active",
      createdAt: new Date(),
      lastActivity: new Date(),
      ipHash: request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
      rejoining: isRejoining,
      sessionTerminated: sessionTerminated,
      userAgent: request.headers.get("user-agent")?.substring(0, 100) || "unknown",
    }

    await sessionsRegistry.insertOne(sessionRegistry)

    // 3. Tentar atualizar dados no MongoDB do usuário
    try {
      if (roomRegistry.userMongoInfo?.mongoUri) {
        const userClient = new MongoClient(roomRegistry.userMongoInfo.mongoUri)
        await userClient.connect()

        const userDbName = roomRegistry.userMongoInfo.actualDbName || roomRegistry.userMongoInfo.dbName
        const userDb = userClient.db(userDbName)
        const userChatsCollection = userDb.collection("user_chats")

        if (isRejoining) {
          // Atualizar participante existente
          await userChatsCollection.updateOne(
            { roomId },
            {
              $set: {
                "participants.$[elem].sessionId": sessionId,
                "participants.$[elem].lastActivity": new Date(),
                "participants.$[elem].status": "active",
                "participants.$[elem].rejoiningCount": { $inc: 1 },
                "chatHistory.lastActivity": new Date(),
              },
              $push: {
                messages: {
                  id: `sys_${Date.now()}`,
                  type: "system",
                  content: sessionTerminated
                    ? `${cleanNick} voltou para a sala (sessão anterior encerrada)`
                    : `${cleanNick} voltou para a sala`,
                  timestamp: new Date().toISOString(),
                  sender: "system",
                  metadata: {
                    sessionTerminated,
                    previousSessionsCount: sessionTerminated ? 1 : 0,
                  },
                },
              },
              $inc: {
                "chatHistory.totalMessages": 1,
              },
            },
            {
              arrayFilters: [{ "elem.nick": cleanNick }],
            },
          )
        } else {
          // Adicionar novo participante
          const newParticipant = {
            nick: cleanNick,
            joinedAt: new Date(),
            role: "participant",
            sessionId,
            status: "active",
            lastActivity: new Date(),
            rejoiningCount: 0,
          }

          const joinMessage = {
            id: `sys_${Date.now()}`,
            type: "system",
            content: `${cleanNick} entrou na sala`,
            timestamp: new Date().toISOString(),
            sender: "system",
            metadata: {
              firstTime: true,
            },
          }

          await userChatsCollection.updateOne(
            { roomId },
            {
              $push: {
                participants: newParticipant,
                messages: joinMessage,
              },
              $set: {
                [`userPreferences.${cleanNick}`]: {
                  theme: "light",
                  notifications: true,
                  language: "pt-BR",
                  joinedAt: new Date(),
                },
                "chatHistory.lastActivity": new Date(),
              },
              $inc: {
                "chatHistory.totalMessages": 1,
              },
            },
          )
        }

        await userClient.close()
        console.log("✅ Dados atualizados no MongoDB do usuário")
      }
    } catch (userDbError) {
      console.warn("⚠️ Erro ao atualizar MongoDB do usuário:", userDbError.message)
      // Continuar mesmo com erro no MongoDB do usuário
    }

    await systemClient.close()

    console.log("✅ Entrada processada com sucesso")

    return NextResponse.json({
      sessionId,
      success: true,
      message: isRejoining
        ? sessionTerminated
          ? "Reentrou na sala (sessão anterior encerrada)"
          : "Reentrou na sala com sucesso"
        : "Entrou na sala com sucesso",
      rejoining: isRejoining,
      sessionTerminated,
      nick: cleanNick,
    })
  } catch (error) {
    console.error("Erro ao entrar na sala:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
