import { type NextRequest, NextResponse } from "next/server"
import { MongoClient } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const { mongoUri } = await request.json()

    if (!mongoUri || typeof mongoUri !== "string") {
      return NextResponse.json({ error: "String de conexão MongoDB é obrigatória" }, { status: 400 })
    }

    // Testar conexão com a URI fornecida
    const customClient = new MongoClient(mongoUri)
    await customClient.connect()

    // Extrair informações da URI para criar um nick único
    const uriParts = mongoUri.match(/mongodb(?:\+srv)?:\/\/(?:([^:]+):([^@]+)@)?([^/]+)\/(.+)/)
    const clusterName = uriParts ? uriParts[3].split(".")[0] : "unknown"
    const dbName = uriParts ? uriParts[4].split("?")[0] : "database"
    const generatedNick = `${clusterName}_${dbName}_user`

    // Usar a conexão customizada para criar o documento
    const db = customClient.db(dbName)
    const chatsCollection = db.collection("user_chats")

    const sessionId = `mongo_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Documento seguindo estratégia de armazenamento desnormalizada
    const chatDocument = {
      sessionId,
      user: {
        nick: generatedNick,
        joinedAt: new Date(),
        connectionType: "mongodb",
        mongoUri: mongoUri, // Armazenar a URI para futuras conexões
        cluster: {
          name: clusterName,
          database: dbName,
        },
      },
      messages: [], // Todas as mensagens no mesmo documento
      conversation: {
        context: [], // Contexto da conversa para IA
        summary: "", // Resumo da conversa
        topics: [], // Tópicos discutidos
      },
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        customConnection: true,
      },
      settings: {
        theme: "dark", // Tema diferente para usuários MongoDB
        notifications: true,
        aiModel: "gpt-4o",
      },
      analytics: {
        totalTokens: 0,
        averageResponseTime: 0,
        mostUsedWords: {},
      },
    }

    await chatsCollection.insertOne(chatDocument)
    await customClient.close()

    return NextResponse.json({ sessionId, nick: generatedNick })
  } catch (error) {
    console.error("Erro no login por MongoDB:", error)
    return NextResponse.json(
      {
        error: "Erro ao conectar com MongoDB. Verifique sua string de conexão.",
      },
      { status: 500 },
    )
  }
}
