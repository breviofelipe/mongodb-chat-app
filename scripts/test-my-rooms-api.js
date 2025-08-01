// Teste específico da API de salas do criador
async function testMyRoomsAPI() {
  console.log("🔌 Testando API /api/rooms/my-rooms...\n")

  const baseUrl = "http://localhost:3000"
  const testCreator = "TestCreator"

  try {
    // Teste 1: Buscar salas sem parâmetro creator
    console.log("1️⃣ Testando sem parâmetro 'creator'...")
    const noParamResponse = await fetch(`${baseUrl}/api/rooms/my-rooms`)

    console.log(`   Status: ${noParamResponse.status}`)
    if (noParamResponse.status === 400) {
      const errorData = await noParamResponse.json()
      console.log(`   ✅ Erro esperado: ${errorData.error}`)
    }

    // Teste 2: Buscar salas de criador inexistente
    console.log("\n2️⃣ Testando criador inexistente...")
    const noRoomsResponse = await fetch(`${baseUrl}/api/rooms/my-rooms?creator=NonExistentUser`)

    if (noRoomsResponse.ok) {
      const noRoomsData = await noRoomsResponse.json()
      console.log(`   ✅ Resposta: ${noRoomsData.rooms.length} salas encontradas`)
      console.log(`   ✅ Criador: ${noRoomsData.creator}`)
    }

    // Teste 3: Buscar salas de criador com salas
    console.log("\n3️⃣ Testando criador com salas...")
    const withRoomsResponse = await fetch(`${baseUrl}/api/rooms/my-rooms?creator=${encodeURIComponent(testCreator)}`)

    if (withRoomsResponse.ok) {
      const withRoomsData = await withRoomsResponse.json()
      console.log(`   ✅ Status: ${withRoomsResponse.status}`)
      console.log(`   ✅ Salas encontradas: ${withRoomsData.rooms.length}`)
      console.log(`   ✅ Total: ${withRoomsData.total}`)
      console.log(`   ✅ Criador: ${withRoomsData.creator}`)

      if (withRoomsData.rooms.length > 0) {
        console.log("\n   📋 Estrutura das salas:")
        const sampleRoom = withRoomsData.rooms[0]
        Object.keys(sampleRoom).forEach((key) => {
          console.log(`     - ${key}: ${typeof sampleRoom[key]}`)
        })

        console.log("\n   📊 Detalhes das salas:")
        withRoomsData.rooms.forEach((room, index) => {
          console.log(`     ${index + 1}. ${room.roomId.slice(0, 15)}...`)
          console.log(`        Participantes: ${room.participantCount}/${room.maxParticipants}`)
          console.log(`        Mensagens: ${room.messageCount}`)
          console.log(`        Status: ${room.status}`)
          console.log(`        MongoDB customizado: ${room.hasCustomMongo ? "Sim" : "Não"}`)
        })
      }
    } else {
      console.log(`   ❌ Erro: ${withRoomsResponse.status}`)
      const errorData = await withRoomsResponse.json()
      console.log(`   Detalhes: ${errorData.error}`)
    }

    // Teste 4: Testar parâmetros especiais
    console.log("\n4️⃣ Testando caracteres especiais no nick...")
    const specialChars = ["User@123", "User Space", "User+Plus", "User%20Encoded"]

    for (const nick of specialChars) {
      const encodedNick = encodeURIComponent(nick)
      const specialResponse = await fetch(`${baseUrl}/api/rooms/my-rooms?creator=${encodedNick}`)

      if (specialResponse.ok) {
        const specialData = await specialResponse.json()
        console.log(`   ✅ "${nick}" → ${specialData.rooms.length} salas`)
      } else {
        console.log(`   ⚠️ "${nick}" → Erro ${specialResponse.status}`)
      }
    }

    console.log("\n🎉 Testes da API concluídos!")
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
  testMyRoomsAPI()
}

export { testMyRoomsAPI }
