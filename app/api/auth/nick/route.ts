import { type NextRequest, NextResponse } from "next/server"
import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const DB_NAME = "chatapp"

export async function POST(request: NextRequest) {
  try {
    const { nick } = await request.json()

    if (!nick || typeof nick !== "string") {
      return NextResponse.json({ error: "Nick é obrigatório" }, { status: 400 })
    }

    const client = new MongoClient(MONGODB_URI)
    await client.connect()

    const db = client.db(DB_NAME)
    const chatsCollection = db.collection("chats")

    // Gerar ID de sessão único
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Criar documento do chat seguindo a estratégia "tudo junto"
    const chatDocument = {
      sessionId,
      user: {
        nick,
        joinedAt: new Date(),
        connectionType: "nick",
      },
      messages: [], // Array de mensagens no mesmo documento
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
      },
      settings: {
        theme: "light",
        notifications: true,
      },
    }

    await chatsCollection.insertOne(chatDocument)
    await client.close()

    return NextResponse.json({ sessionId })
  } catch (error) {
    console.error("Erro no login por nick:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
