// Teste de performance da estratégia "tudo junto"
import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const DB_NAME = "chatapp_performance_test"

async function performanceTest() {
  console.log('⚡ Teste de Performance - Estratégia "Tudo Junto"\n')

  const client = new MongoClient(MONGODB_URI)
  await client.connect()

  const db = client.db(DB_NAME)
  const chatsCollection = db.collection("chats")

  // Limpar dados anteriores
  await chatsCollection.deleteMany({})

  console.log("1️⃣ Criando documentos de chat com diferentes volumes de mensagens...")

  const testCases = [10, 50, 100, 500, 1000] // Número de mensagens por chat
  const results = []

  for (const messageCount of testCases) {
    console.log(`\n📊 Testando com ${messageCount} mensagens:`)

    // Criar documento com N mensagens
    const sessionId = `perf_test_${messageCount}_${Date.now()}`
    const messages = []

    for (let i = 0; i < messageCount; i++) {
      messages.push({
        id: `msg_${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Esta é a mensagem número ${i + 1} do teste de performance.`,
        createdAt: new Date(),
        tokens: 15,
      })
    }

    const chatDocument = {
      sessionId,
      user: {
        nick: `PerfTestUser_${messageCount}`,
        joinedAt: new Date(),
        connectionType: "nick",
      },
      messages,
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: messages.length,
      },
      settings: {
        theme: "light",
        notifications: true,
      },
      analytics: {
        totalTokens: messages.length * 15,
        averageResponseTime: 250,
        mostUsedWords: { teste: messageCount, performance: messageCount },
      },
    }

    // Medir tempo de inserção
    const insertStart = Date.now()
    await chatsCollection.insertOne(chatDocument)
    const insertTime = Date.now() - insertStart

    // Medir tempo de recuperação completa
    const retrieveStart = Date.now()
    const retrieved = await chatsCollection.findOne({ sessionId })
    const retrieveTime = Date.now() - retrieveStart

    // Medir tempo de adição de nova mensagem
    const updateStart = Date.now()
    await chatsCollection.updateOne(
      { sessionId },
      {
        $push: {
          messages: {
            id: `msg_new_${Date.now()}`,
            role: "user",
            content: "Nova mensagem de teste",
            createdAt: new Date(),
          },
        },
        $inc: { "metadata.messageCount": 1 },
      },
    )
    const updateTime = Date.now() - updateStart

    // Calcular tamanho do documento
    const docSize = JSON.stringify(retrieved).length

    const result = {
      messageCount,
      insertTime,
      retrieveTime,
      updateTime,
      docSize,
      avgTimePerMessage: retrieveTime / messageCount,
    }

    results.push(result)

    console.log(`   ⏱️  Inserção: ${insertTime}ms`)
    console.log(`   ⏱️  Recuperação: ${retrieveTime}ms`)
    console.log(`   ⏱️  Atualização: ${updateTime}ms`)
    console.log(`   📏 Tamanho: ${(docSize / 1024).toFixed(2)}KB`)
    console.log(`   📊 Tempo/msg: ${result.avgTimePerMessage.toFixed(2)}ms`)
  }

  // Relatório final
  console.log("\n📈 RELATÓRIO DE PERFORMANCE:")
  console.log("=".repeat(60))
  console.log("Msgs\tInserir\tRecup.\tAtualiz.\tTamanho\tTempo/Msg")
  console.log("-".repeat(60))

  results.forEach((r) => {
    console.log(
      `${r.messageCount}\t${r.insertTime}ms\t${r.retrieveTime}ms\t${r.updateTime}ms\t\t${(r.docSize / 1024).toFixed(1)}KB\t${r.avgTimePerMessage.toFixed(1)}ms`,
    )
  })

  console.log("\n💡 ANÁLISE:")

  const maxRetrieveTime = Math.max(...results.map((r) => r.retrieveTime))
  const minRetrieveTime = Math.min(...results.map((r) => r.retrieveTime))

  console.log(`   • Tempo de recuperação varia de ${minRetrieveTime}ms a ${maxRetrieveTime}ms`)
  console.log(`   • Estratégia "tudo junto" mantém performance consistente`)
  console.log(`   • Uma única consulta retorna todo o contexto da conversa`)

  if (maxRetrieveTime < 100) {
    console.log("   ✅ Performance excelente para todos os volumes testados")
  } else if (maxRetrieveTime < 500) {
    console.log("   ✅ Performance boa, adequada para uso em produção")
  } else {
    console.log("   ⚠️  Performance pode ser otimizada para volumes maiores")
  }

  // Limpeza
  await chatsCollection.deleteMany({})
  await client.close()

  console.log("\n🎯 Teste de performance concluído!")
}

performanceTest()
