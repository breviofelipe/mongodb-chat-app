// Teste específico para os endpoints da API
async function testAPIEndpoints() {
  console.log("🧪 Testando Endpoints da API...\n")

  const baseUrl = "http://localhost:3000"
  let testRoomId = null

  try {
    // Teste 1: Criar sala
    console.log("1️⃣ Testando criação de sala...")
    const createResponse = await fetch(`${baseUrl}/api/rooms/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorNick: "TestCreator",
        mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017",
      }),
    })

    if (createResponse.ok) {
      const createData = await createResponse.json()
      testRoomId = createData.roomId
      console.log("✅ Sala criada:", testRoomId)
    } else {
      console.log("❌ Erro ao criar sala:", createResponse.status)
      const errorData = await createResponse.json()
      console.log("   Detalhes:", errorData)
      return
    }

    // Teste 2: Verificar se sala existe
    console.log("\n2️⃣ Testando busca da sala...")
    const roomResponse = await fetch(`${baseUrl}/api/rooms/${testRoomId}`)

    if (roomResponse.ok) {
      const roomData = await roomResponse.json()
      console.log("✅ Sala encontrada:", roomData.roomId)
      console.log("   Criador:", roomData.createdBy)
      console.log("   Participantes:", roomData.participants)
    } else {
      console.log("❌ Erro ao buscar sala:", roomResponse.status)
      const errorData = await roomResponse.json()
      console.log("   Detalhes:", errorData)
    }

    // Teste 3: Entrar na sala
    console.log("\n3️⃣ Testando entrada na sala...")
    const joinResponse = await fetch(`${baseUrl}/api/rooms/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nick: "TestParticipant",
        roomId: testRoomId,
      }),
    })

    if (joinResponse.ok) {
      const joinData = await joinResponse.json()
      console.log("✅ Entrou na sala com sucesso")
      console.log("   Session ID:", joinData.sessionId)
    } else {
      console.log("❌ Erro ao entrar na sala:", joinResponse.status)
      const errorData = await joinResponse.json()
      console.log("   Detalhes:", errorData)
    }

    // Teste 4: Buscar mensagens
    console.log("\n4️⃣ Testando busca de mensagens...")
    const messagesResponse = await fetch(`${baseUrl}/api/rooms/${testRoomId}/messages`)

    if (messagesResponse.ok) {
      const messagesData = await messagesResponse.json()
      console.log("✅ Mensagens carregadas:", messagesData.messages.length)
      messagesData.messages.forEach((msg, index) => {
        console.log(`   ${index + 1}. [${msg.type}] ${msg.sender}: ${msg.content}`)
      })
    } else {
      console.log("❌ Erro ao buscar mensagens:", messagesResponse.status)
      const errorData = await messagesResponse.json()
      console.log("   Detalhes:", errorData)
    }

    // Teste 5: Enviar mensagem
    console.log("\n5️⃣ Testando envio de mensagem...")
    const sendResponse = await fetch(`${baseUrl}/api/rooms/${testRoomId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "session-id": "test_session_123",
      },
      body: JSON.stringify({
        content: "Mensagem de teste da API",
        sender: "TestCreator",
      }),
    })

    if (sendResponse.ok) {
      const sendData = await sendResponse.json()
      console.log("✅ Mensagem enviada com sucesso")
      console.log("   ID da mensagem:", sendData.message.id)
    } else {
      console.log("❌ Erro ao enviar mensagem:", sendResponse.status)
      const errorData = await sendResponse.json()
      console.log("   Detalhes:", errorData)
    }

    // Teste 6: Listar salas
    console.log("\n6️⃣ Testando listagem de salas...")
    const listResponse = await fetch(`${baseUrl}/api/rooms`)

    if (listResponse.ok) {
      const listData = await listResponse.json()
      console.log("✅ Salas listadas:", listData.length)
      listData.forEach((room, index) => {
        console.log(`   ${index + 1}. ${room.roomId.slice(0, 12)}... (${room.participants.length}/2)`)
      })
    } else {
      console.log("❌ Erro ao listar salas:", listResponse.status)
    }

    console.log("\n🎉 Todos os testes de API concluídos!")
  } catch (error) {
    console.error("\n❌ Erro durante os testes:", error.message)
    console.log("\n💡 Dicas:")
    console.log("   - Certifique-se de que o servidor está rodando (npm run dev)")
    console.log("   - Verifique se o MongoDB está conectado")
    console.log("   - Confirme as variáveis de ambiente")
  }
}

// Executar apenas se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testAPIEndpoints()
}

export { testAPIEndpoints }
