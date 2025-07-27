// Teste específico para conexões MongoDB customizadas
import { MongoClient } from "mongodb"

async function testCustomMongoConnection() {
  console.log("🔗 Testando conexões MongoDB customizadas...\n")

  // Lista de URIs de teste (substitua por URIs reais para testar)
  const testURIs = [
    "mongodb://localhost:27017",
    // 'mongodb+srv://username:password@cluster.mongodb.net/database',
    // Adicione suas URIs de teste aqui
  ]

  for (const uri of testURIs) {
    console.log(`\n🧪 Testando URI: ${uri.replace(/\/\/.*@/, "//***:***@")}`)

    try {
      const client = new MongoClient(uri)
      await client.connect()

      // Testar operações básicas
      const admin = client.db().admin()
      const serverStatus = await admin.serverStatus()

      console.log("✅ Conexão estabelecida")
      console.log(`   Versão MongoDB: ${serverStatus.version}`)
      console.log(`   Host: ${serverStatus.host}`)

      // Testar criação de documento
      const testDb = client.db("test_chat")
      const testCollection = testDb.collection("test_chats")

      const testDoc = {
        sessionId: `test_${Date.now()}`,
        createdAt: new Date(),
        test: true,
      }

      await testCollection.insertOne(testDoc)
      console.log("✅ Documento de teste criado")

      // Limpar teste
      await testCollection.deleteOne({ sessionId: testDoc.sessionId })
      console.log("✅ Documento de teste removido")

      await client.close()
      console.log("✅ Conexão fechada corretamente")
    } catch (error) {
      console.log("❌ Falha na conexão")
      console.log(`   Erro: ${error.message}`)

      if (error.message.includes("ENOTFOUND")) {
        console.log("   💡 Verifique o hostname/endereço do servidor")
      } else if (error.message.includes("authentication")) {
        console.log("   💡 Verifique usuário e senha")
      } else if (error.message.includes("ECONNREFUSED")) {
        console.log("   💡 Verifique se o MongoDB está rodando")
      }
    }
  }
}

testCustomMongoConnection()
