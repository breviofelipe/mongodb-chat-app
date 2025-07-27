import type { NextRequest } from "next/server"
import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const DB_NAME = "chatapp"

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    const sessionId = request.headers.get("session-id")

    if (!sessionId) {
      return new Response("Session ID é obrigatório", { status: 401 })
    }

    // Buscar dados da sessão
    const client = new MongoClient(MONGODB_URI)
    await client.connect()

    const db = client.db(DB_NAME)
    const chatsCollection = db.collection("chats")

    const chatDocument = await chatsCollection.findOne({ sessionId })

    if (!chatDocument) {
      await client.close()
      return new Response("Sessão não encontrada", { status: 404 })
    }

    // Se for conexão MongoDB customizada, usar a URI específica
    let targetClient = client
    let targetCollection = chatsCollection

    if (chatDocument.user.connectionType === "mongodb" && chatDocument.user.mongoUri) {
      targetClient = new MongoClient(chatDocument.user.mongoUri)
      await targetClient.connect()
      const targetDb = targetClient.db(chatDocument.user.cluster.database)
      targetCollection = targetDb.collection("user_chats")
    }

    const result = streamText({
      model: openai("gpt-4o"),
      messages,
      system: `Você é um assistente útil conversando com ${chatDocument.user.nick}. 
               Seja amigável e mantenha o contexto da conversa. 
               ${
                 chatDocument.user.connectionType === "mongodb"
                   ? "Este usuário está usando uma conexão MongoDB personalizada, então você pode ajudar com questões técnicas de banco de dados."
                   : "Este é um usuário padrão do chat."
               }`,
      async onFinish({ text, usage }) {
        // Atualizar documento com nova mensagem seguindo estratégia "tudo junto"
        const userMessage = messages[messages.length - 1]
        const aiMessage = {
          id: `ai_${Date.now()}`,
          role: "assistant",
          content: text,
          createdAt: new Date(),
          tokens: usage?.totalTokens || 0,
        }

        const updateData = {
          $push: {
            messages: {
              $each: [
                {
                  id: userMessage.id,
                  role: "user",
                  content: userMessage.content,
                  createdAt: new Date(),
                },
                aiMessage,
              ],
            },
          },
          $set: {
            "metadata.lastActivity": new Date(),
            "metadata.messageCount": chatDocument.metadata.messageCount + 2,
          },
          $inc: {
            "analytics.totalTokens": usage?.totalTokens || 0,
          },
        }

        // Atualizar contexto da conversa para próximas interações
        if (chatDocument.conversation) {
          updateData.$set["conversation.summary"] =
            `Conversa com ${chatDocument.user.nick} sobre: ${text.substring(0, 100)}...`
          updateData.$addToSet = {
            "conversation.topics": extractTopics(text),
          }
        }

        await targetCollection.updateOne({ sessionId }, updateData)

        await targetClient.close()
        if (targetClient !== client) {
          await client.close()
        }
      },
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("Erro no chat:", error)
    return new Response("Erro interno do servidor", { status: 500 })
  }
}

// Função auxiliar para extrair tópicos da mensagem
function extractTopics(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/)
  const topics = words.filter(
    (word) => word.length > 4 && !["sobre", "para", "com", "uma", "isso", "essa", "este", "esta"].includes(word),
  )
  return topics.slice(0, 3) // Máximo 3 tópicos por mensagem
}
