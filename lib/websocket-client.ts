interface WebSocketMessage {
  type: string
  [key: string]: any
}

interface WebSocketConfig {
  url: string
  sessionId: string
  roomId: string
  userNick: string
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

class SecureWebSocketClient {
  private ws: WebSocket | null = null
  private config: WebSocketConfig
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private isConnected = false
  private messageQueue: WebSocketMessage[] = []

  constructor(config: WebSocketConfig) {
    this.config = config
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Usar WSS para conexão segura
        const wsUrl = this.config.url.replace("http://", "ws://").replace("https://", "wss://")
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log("🔒 Secure WebSocket connected")
          this.isConnected = true
          this.reconnectAttempts = 0

          // Autenticar imediatamente
          this.authenticate()

          // Iniciar heartbeat
          this.startHeartbeat()

          // Processar fila de mensagens
          this.processMessageQueue()

          if (this.config.onConnect) {
            this.config.onConnect()
          }

          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error("Error parsing WebSocket message:", error)
          }
        }

        this.ws.onclose = (event) => {
          console.log("🔌 WebSocket disconnected:", event.code, event.reason)
          this.isConnected = false
          this.stopHeartbeat()

          if (this.config.onDisconnect) {
            this.config.onDisconnect()
          }

          // Tentar reconectar se não foi fechamento intencional
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error)
          if (this.config.onError) {
            this.config.onError(error)
          }
          reject(error)
        }
      } catch (error) {
        console.error("Failed to create WebSocket connection:", error)
        reject(error)
      }
    })
  }

  private authenticate() {
    this.sendMessage({
      type: "auth",
      sessionId: this.config.sessionId,
    })
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case "connection_established":
        console.log("✅ WebSocket connection established")
        break

      case "auth_success":
        console.log("🔐 WebSocket authentication successful")
        // Entrar na sala após autenticação
        this.joinRoom()
        break

      case "room_joined":
        console.log("🏠 Joined room via WebSocket:", message.roomId)
        break

      case "new_message":
        console.log("💬 New message via WebSocket:", message.message)
        break

      case "user_joined":
        console.log("👥 User joined:", message.userNick)
        break

      case "user_left":
        console.log("👋 User left:", message.userNick)
        break

      case "messages_loaded":
        console.log("📜 Messages loaded:", message.messageCount)
        break

      case "pong":
        // Heartbeat response
        break

      case "error":
        console.error("❌ WebSocket error:", message.error)
        break

      default:
        console.log("📨 Unknown message type:", message.type)
    }

    // Repassar mensagem para callback
    if (this.config.onMessage) {
      this.config.onMessage(message)
    }
  }

  private joinRoom() {
    this.sendMessage({
      type: "join_room",
      roomId: this.config.roomId,
    })
  }

  sendChatMessage(content: string) {
    this.sendMessage({
      type: "message",
      content,
      sender: this.config.userNick,
      roomId: this.config.roomId,
    })
  }

  loadMessages() {
    this.sendMessage({
      type: "get_messages",
      roomId: this.config.roomId,
    })
  }

  private sendMessage(message: WebSocketMessage) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      // Adicionar à fila se não conectado
      this.messageQueue.push(message)
    }
  }

  private processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.sendMessage(message)
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({ type: "ping" })
      }
    }, 30000) // Ping a cada 30 segundos
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Backoff exponencial

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)

    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect().catch((error) => {
          console.error("Reconnect failed:", error)
        })
      }
    }, delay)
  }

  disconnect() {
    if (this.ws) {
      this.sendMessage({ type: "leave_room" })
      this.ws.close(1000, "Client disconnect")
    }
    this.stopHeartbeat()
    this.isConnected = false
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  updateConfig(newConfig: Partial<WebSocketConfig>) {
    this.config = { ...this.config, ...newConfig }
  }
}

export { SecureWebSocketClient, type WebSocketMessage, type WebSocketConfig }
