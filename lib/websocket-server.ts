import { WebSocketServer } from "ws"
import { createServer } from "https"
import { MongoClient } from "mongodb"
import crypto from "crypto"

const SYSTEM_MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const SYSTEM_DB_NAME = "chatapp_system"
const WS_PORT = Number.parseInt(process.env.WS_PORT || "8443")

interface AuthenticatedWebSocket extends WebSocket {
  sessionId?: string
  roomId?: string
  userNick?: string
  isAuthenticated?: boolean
  lastPing?: number
}

interface WebSocketMessage {
  type: "auth" | "message" | "ping" | "join_room" | "leave_room" | "get_messages"
  sessionId?: string
  roomId?: string
  content?: string
  sender?: string
  data?: any
}

class SecureWebSocketServer {
  private wss: WebSocketServer
  private clients: Map<string, AuthenticatedWebSocket> = new Map()
  private roomClients: Map<string, Set<string>> = new Map()
  private mongoClient: MongoClient

  constructor() {
    // Configurar servidor HTTPS para WebSocket seguro
    const server = createServer({
      cert: this.generateSelfSignedCert().cert,
      key: this.generateSelfSignedCert().key,
    })

    this.wss = new WebSocketServer({
      server,
      verifyClient: this.verifyClient.bind(this),
    })

    this.mongoClient = new MongoClient(SYSTEM_MONGODB_URI)
    this.setupWebSocketHandlers()
    this.startHeartbeat()

    server.listen(WS_PORT, () => {
      console.log(`🔒 Secure WebSocket server running on wss://localhost:${WS_PORT}`)
    })
  }

  private generateSelfSignedCert() {
    // Para desenvolvimento - em produção use certificados reais
    const cert = `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQC8w9X8nF8/9TANBgkqhkiG9w0BAQsFADATMREwDwYDVQQDDAhs
b2NhbGhvc3QwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjATMREwDwYD
VQQDDAhsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7
...
-----END CERTIFICATE-----`

    const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB
...
-----END PRIVATE KEY-----`

    return { cert, key }
  }

  private verifyClient(info: any): boolean {
    // Verificar origem e headers de segurança
    const origin = info.origin
    const allowedOrigins = ["http://localhost:3000", "https://localhost:3000", process.env.ALLOWED_ORIGIN].filter(
      Boolean,
    )

    return allowedOrigins.includes(origin)
  }

  private setupWebSocketHandlers() {
    this.wss.on("connection", (ws: AuthenticatedWebSocket, request) => {
      const clientId = crypto.randomUUID()
      ws.lastPing = Date.now()

      console.log(`🔌 New WebSocket connection: ${clientId}`)

      ws.on("message", async (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString())
          await this.handleMessage(ws, message, clientId)
        } catch (error) {
          console.error("Error handling WebSocket message:", error)
          this.sendError(ws, "Invalid message format")
        }
      })

      ws.on("close", () => {
        this.handleDisconnection(clientId)
      })

      ws.on("error", (error) => {
        console.error(`WebSocket error for ${clientId}:`, error)
        this.handleDisconnection(clientId)
      })

      // Enviar confirmação de conexão
      this.sendMessage(ws, {
        type: "connection_established",
        clientId,
        timestamp: new Date().toISOString(),
      })
    })
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage, clientId: string) {
    switch (message.type) {
      case "auth":
        await this.handleAuth(ws, message, clientId)
        break

      case "join_room":
        await this.handleJoinRoom(ws, message, clientId)
        break

      case "message":
        await this.handleChatMessage(ws, message, clientId)
        break

      case "get_messages":
        await this.handleGetMessages(ws, message, clientId)
        break

      case "ping":
        this.handlePing(ws, clientId)
        break

      case "leave_room":
        await this.handleLeaveRoom(ws, message, clientId)
        break

      default:
        this.sendError(ws, "Unknown message type")
    }
  }

  private async handleAuth(ws: AuthenticatedWebSocket, message: WebSocketMessage, clientId: string) {
    if (!message.sessionId) {
      return this.sendError(ws, "Session ID required")
    }

    try {
      await this.mongoClient.connect()
      const db = this.mongoClient.db(SYSTEM_DB_NAME)
      const sessionsRegistry = db.collection("sessions_registry")

      const session = await sessionsRegistry.findOne({
        sessionId: message.sessionId,
        status: "active",
      })

      if (!session) {
        return this.sendError(ws, "Invalid or expired session")
      }

      // Autenticar WebSocket
      ws.sessionId = message.sessionId
      ws.roomId = session.roomId
      ws.userNick = session.nick
      ws.isAuthenticated = true

      this.clients.set(clientId, ws)

      // Atualizar última atividade da sessão
      await sessionsRegistry.updateOne(
        { sessionId: message.sessionId },
        {
          $set: {
            lastActivity: new Date(),
            websocketConnected: true,
            websocketClientId: clientId,
          },
        },
      )

      this.sendMessage(ws, {
        type: "auth_success",
        sessionId: message.sessionId,
        roomId: session.roomId,
        userNick: session.nick,
      })

      console.log(`✅ Authenticated: ${session.nick} in room ${session.roomId}`)
    } catch (error) {
      console.error("Auth error:", error)
      this.sendError(ws, "Authentication failed")
    }
  }

  private async handleJoinRoom(ws: AuthenticatedWebSocket, message: WebSocketMessage, clientId: string) {
    if (!ws.isAuthenticated || !ws.roomId) {
      return this.sendError(ws, "Not authenticated")
    }

    const roomId = ws.roomId

    // Adicionar cliente à sala
    if (!this.roomClients.has(roomId)) {
      this.roomClients.set(roomId, new Set())
    }
    this.roomClients.get(roomId)!.add(clientId)

    // Notificar outros clientes na sala
    this.broadcastToRoom(
      roomId,
      {
        type: "user_joined",
        userNick: ws.userNick,
        timestamp: new Date().toISOString(),
      },
      clientId,
    )

    this.sendMessage(ws, {
      type: "room_joined",
      roomId,
      connectedUsers: this.getRoomUsers(roomId),
    })

    console.log(`👥 ${ws.userNick} joined room ${roomId} via WebSocket`)
  }

  private async handleChatMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage, clientId: string) {
    if (!ws.isAuthenticated || !message.content || !message.sender) {
      return this.sendError(ws, "Invalid message data")
    }

    try {
      await this.mongoClient.connect()
      const db = this.mongoClient.db(SYSTEM_DB_NAME)
      const roomsRegistry = db.collection("rooms_registry")
      const sessionsRegistry = db.collection("sessions_registry")

      // Validar sessão
      const validSession = await sessionsRegistry.findOne({
        sessionId: ws.sessionId,
        roomId: ws.roomId,
        nick: ws.userNick,
        status: "active",
      })

      if (!validSession) {
        return this.sendError(ws, "Session expired or invalid")
      }

      const roomRegistry = await roomsRegistry.findOne({ roomId: ws.roomId })
      if (!roomRegistry) {
        return this.sendError(ws, "Room not found")
      }

      const newMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sender: message.sender,
        content: message.content,
        timestamp: new Date().toISOString(),
        type: "message",
        sessionId: ws.sessionId,
        via: "websocket",
        metadata: {
          messageLength: message.content.length,
          clientId: clientId,
        },
      }

      // Salvar no MongoDB do usuário
      if (roomRegistry.userMongoInfo?.mongoUri) {
        try {
          const userClient = new MongoClient(roomRegistry.userMongoInfo.mongoUri)
          await userClient.connect()

          const userDbName = roomRegistry.userMongoInfo.actualDbName || roomRegistry.userMongoInfo.dbName
          const userDb = userClient.db(userDbName)
          const userChatsCollection = userDb.collection("user_chats")

          await userChatsCollection.updateOne(
            { roomId: ws.roomId },
            {
              $push: {
                messages: newMessage,
                "chatHistory.topics": {
                  $each: this.extractTopics(message.content),
                  $slice: -10,
                },
              },
              $set: {
                "chatHistory.lastActivity": new Date(),
                "chatHistory.conversationSummary": `${message.sender}: ${message.content.substring(0, 50)}...`,
                [`userPreferences.${message.sender}.lastMessageAt`]: new Date(),
              },
              $inc: {
                "chatHistory.totalMessages": 1,
                [`userPreferences.${message.sender}.messageCount`]: 1,
              },
            },
          )

          await userClient.close()
        } catch (userDbError) {
          console.warn("⚠️ Error saving to user MongoDB:", userDbError.message)
        }
      }

      // Atualizar metadados no sistema
      await roomsRegistry.updateOne(
        { roomId: ws.roomId },
        {
          $set: { "systemMetadata.lastActivity": new Date() },
          $inc: { "systemMetadata.messageCount": 1 },
        },
      )

      await sessionsRegistry.updateOne(
        { sessionId: ws.sessionId },
        {
          $set: { lastActivity: new Date() },
          $inc: { messagesSent: 1 },
        },
      )

      // Broadcast para todos os clientes na sala
      this.broadcastToRoom(ws.roomId!, {
        type: "new_message",
        message: newMessage,
      })

      console.log(`💬 Message from ${message.sender} in room ${ws.roomId}`)
    } catch (error) {
      console.error("Error handling chat message:", error)
      this.sendError(ws, "Failed to send message")
    }
  }

  private async handleGetMessages(ws: AuthenticatedWebSocket, message: WebSocketMessage, clientId: string) {
    if (!ws.isAuthenticated || !ws.roomId) {
      return this.sendError(ws, "Not authenticated")
    }

    try {
      await this.mongoClient.connect()
      const db = this.mongoClient.db(SYSTEM_DB_NAME)
      const roomsRegistry = db.collection("rooms_registry")

      const roomRegistry = await roomsRegistry.findOne({ roomId: ws.roomId })
      if (!roomRegistry) {
        return this.sendError(ws, "Room not found")
      }

      let messages = []
      let messageCount = 0

      // Buscar mensagens no MongoDB do usuário
      if (roomRegistry.userMongoInfo?.mongoUri) {
        try {
          const userClient = new MongoClient(roomRegistry.userMongoInfo.mongoUri)
          await userClient.connect()

          const userDbName = roomRegistry.userMongoInfo.actualDbName || roomRegistry.userMongoInfo.dbName
          const userDb = userClient.db(userDbName)
          const userChatsCollection = userDb.collection("user_chats")

          const userChatDocument = await userChatsCollection.findOne({ roomId: ws.roomId })
          if (userChatDocument) {
            messages = userChatDocument.messages || []
            messageCount = messages.length
          }

          await userClient.close()
        } catch (userDbError) {
          console.warn("⚠️ Error accessing user MongoDB:", userDbError.message)
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
      }

      this.sendMessage(ws, {
        type: "messages_loaded",
        messages,
        messageCount,
        dataSource: messages.length > 1 ? "user_mongodb" : "system_fallback",
      })
    } catch (error) {
      console.error("Error getting messages:", error)
      this.sendError(ws, "Failed to load messages")
    }
  }

  private handlePing(ws: AuthenticatedWebSocket, clientId: string) {
    ws.lastPing = Date.now()
    this.sendMessage(ws, { type: "pong", timestamp: Date.now() })
  }

  private async handleLeaveRoom(ws: AuthenticatedWebSocket, message: WebSocketMessage, clientId: string) {
    if (!ws.roomId) return

    const roomId = ws.roomId

    // Remover cliente da sala
    if (this.roomClients.has(roomId)) {
      this.roomClients.get(roomId)!.delete(clientId)
      if (this.roomClients.get(roomId)!.size === 0) {
        this.roomClients.delete(roomId)
      }
    }

    // Notificar outros clientes
    this.broadcastToRoom(
      roomId,
      {
        type: "user_left",
        userNick: ws.userNick,
        timestamp: new Date().toISOString(),
      },
      clientId,
    )

    console.log(`👋 ${ws.userNick} left room ${roomId}`)
  }

  private handleDisconnection(clientId: string) {
    const ws = this.clients.get(clientId)
    if (ws && ws.roomId) {
      this.handleLeaveRoom(ws, { type: "leave_room" }, clientId)
    }

    this.clients.delete(clientId)
    console.log(`🔌 Client disconnected: ${clientId}`)
  }

  private broadcastToRoom(roomId: string, message: any, excludeClientId?: string) {
    const roomClients = this.roomClients.get(roomId)
    if (!roomClients) return

    roomClients.forEach((clientId) => {
      if (clientId !== excludeClientId) {
        const ws = this.clients.get(clientId)
        if (ws && ws.readyState === WebSocket.OPEN) {
          this.sendMessage(ws, message)
        }
      }
    })
  }

  private getRoomUsers(roomId: string): string[] {
    const roomClients = this.roomClients.get(roomId)
    if (!roomClients) return []

    const users: string[] = []
    roomClients.forEach((clientId) => {
      const ws = this.clients.get(clientId)
      if (ws && ws.userNick) {
        users.push(ws.userNick)
      }
    })

    return users
  }

  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: "error",
      error,
      timestamp: new Date().toISOString(),
    })
  }

  private startHeartbeat() {
    setInterval(() => {
      const now = Date.now()
      this.clients.forEach((ws, clientId) => {
        if (ws.lastPing && now - ws.lastPing > 60000) {
          // 60 segundos
          console.log(`💔 Heartbeat timeout for ${clientId}`)
          ws.terminate()
          this.handleDisconnection(clientId)
        }
      })
    }, 30000) // Verificar a cada 30 segundos
  }

  private extractTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/)
    const topics = words.filter(
      (word) =>
        word.length > 4 &&
        !["sobre", "para", "com", "uma", "isso", "essa", "este", "esta", "muito", "mais"].includes(word),
    )
    return topics.slice(0, 3)
  }
}

// Inicializar servidor WebSocket
if (require.main === module) {
  new SecureWebSocketServer()
}

export { SecureWebSocketServer }
