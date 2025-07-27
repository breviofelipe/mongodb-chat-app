import { NextResponse } from "next/server"
import { MongoClient } from "mongodb"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"

export async function GET() {
  try {
    console.log("📋 Listando salas ativas do sistema auxiliar...")

    const systemClient = new MongoClient(SYSTEM_MONGODB_URI)
    await systemClient.connect()

    const systemDb = systemClient.db(SYSTEM_DB_NAME)
    const roomsRegistry = systemDb.collection("rooms_registry")

    // Buscar salas ativas criadas nas últimas 24 horas
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const activeRooms = await roomsRegistry
      .find({
        createdAt: { $gte: oneDayAgo },
        status: "active",
        participantCount: { $lt: 2 }, // Salas com vaga
        "systemMetadata.isPublic": true,
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()

    await systemClient.close()

    const rooms = activeRooms.map((room) => ({
      roomId: room.roomId,
      createdBy: room.createdBy,
      createdAt: room.createdAt,
      participantCount: room.participantCount,
      maxParticipants: room.maxParticipants,
      messageCount: room.systemMetadata.messageCount,
      hasCustomMongo: !!room.userMongoInfo.uriHash,
      lastActivity: room.lastActivity || room.createdAt,
    }))

    console.log(`✅ Encontradas ${rooms.length} salas ativas`)

    return NextResponse.json(rooms)
  } catch (error) {
    console.error("Erro ao buscar salas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
