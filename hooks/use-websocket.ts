"use client"

import { useState, useEffect, useRef, useCallback } from "react"

export interface WebSocketMessage {
  type: string
  [key: string]: any
}

export interface ChatMessage {
  id: string
  nick: string
  userId: string
  message: string
  timestamp: string
  via: "websocket" | "http"
  type: "message" | "system"
  content: string
  metadata?: any
}

export interface UseWebSocketOptions {
  url?: string
  autoConnect?: boolean
  sessionId?: string
  roomId?: string
  nick?: string
}

export interface UseWebSocketReturn {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  authenticate: (sessionId: string, nick?: string) => void
  joinRoom: (roomId: string) => void
  sendMessage: (message: string) => void
  getRoomUsers: () => void
  getServerStats: () => void
  messages: ChatMessage[]
  users: any[]
  connectionStatus: string
  lastError: string | null
  serverStats: any
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  // URL do servidor WebSocket independente
  const { url = "wss://localhost:8080", autoConnect = false, sessionId, roomId, nick } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [lastError, setLastError] = useState<string | null>(null)
  const [serverStats, setServerStats] = useState<any>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const isAuthenticated = useRef(false)
  const currentRoomId = useRef<string | null>(null)
  const messageQueue = useRef<WebSocketMessage[]>([])
  const clientId = useRef<string | null>(null)

  // // Função para enviar mensagem
  const sendWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("📤 Enviando mensagem:", message.type)
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.log("📤 Adicionando à fila:", message.type)
      messageQueue.current.push(message)
    }
  }, [])

  // // Processar fila de mensagens
  const processMessageQueue = useCallback(() => {
    console.log(`📤 Processando fila: ${messageQueue.current.length} mensagens`)
    while (messageQueue.current.length > 0) {
      const message = messageQueue.current.shift()
      if (message) {
        sendWebSocketMessage(message)
      }
    }
  }, [sendWebSocketMessage])
  const handleMessage = useCallback((event: MessageEvent) => {
      try {
            const message: WebSocketMessage = JSON.parse(event.data)
            console.log("📨 Mensagem recebida:", message.type)
            switch (message.type) {
              case "connected":
                console.log("✅ WebSocket conectado:", message.clientId)
                clientId.current = message.clientId
                setConnectionStatus("connected")

                // Auto-autenticar se sessionId fornecido
                if (sessionId && !isAuthenticated.current) {
                  console.log("🔐 Auto-autenticando...")
                  sendWebSocketMessage({
                    type: "auth",
                    sessionId: sessionId,
                    nick: nick,
                    userId: `user_${sessionId}`,
                  })
                }
                break
              case "auth_success":
                console.log("🔐 Autenticação bem-sucedida:", message.nick)
                isAuthenticated.current = true
                setConnectionStatus("authenticated")

                // Auto-entrar na sala se roomId fornecido
                if (roomId && roomId !== currentRoomId.current) {
                  console.log("🏠 Auto-entrando na sala:", roomId)
                  sendWebSocketMessage({
                    type: "join_room",
                    roomId: roomId,
                  })
                }
                break
              case "room_joined":
                  console.log("🏠 Entrou na sala:", message.roomId)
                  if (message.history) {
                    console.log("💬 Carregado historico de mensagens...:", message.history.length)                    
                    setMessages(message.history)
                  }
                  currentRoomId.current = message.roomId
                  setUsers(message.users || [])
                  setConnectionStatus("in_room")
                  break
              case "new_message":
                  console.log("💬 Nova mensagem:", message.message?.message)
                  if (message.message) {
                    setMessages((prev) => {
                      // Evitar duplicatas
                      const exists = prev.some((m) => m.id === message.message.id)
                      if (!exists) {
                        return [...prev, message.message]
                      }
                      return prev
                    })
                  }
                  break

              case "user_left":
                  console.log("👋 Usuário saiu:", message.nick)
                  setUsers((prev) => prev.filter((u) => u.userId !== message.userId))
                  break

              case "room_users":
                  console.log("👥 Lista de usuários:", message.users?.length)
                  setUsers(message.users || [])
                  break

              case "user_joined":
                  console.log("👋 Usuário entrou:", message.nick)
                  setUsers((prev) => {
                    const exists = prev.some((u) => u.userId === message.userId)
                    if (!exists) {
                      return [
                        ...prev,
                        {
                          nick: message.nick,
                          userId: message.userId,
                          clientId: message.clientId,
                          status: "online",
                        },
                      ]
                    }
                    return prev
                  })
                break
              case "pong":
                console.log("🏓 Pong recebido")
                break

              case "heartbeat_response":
                console.log("💓 Heartbeat response")
                break
              case "server_stats":
                console.log("📊 Estatísticas do servidor recebidas")
                setServerStats(message.stats)
                break
              default:
                console.log("❓ Mensagem desconhecida:", message.type)
              }

      } catch (error) {
            console.error("❌ Erro ao processar mensagem:", error)
      }
  },[])
 
  // // Conectar ao WebSocket
  const connect = useCallback(async (): Promise<void> => {
    if (isConnecting || isConnected) {
      console.log("⚠️ Já conectando ou conectado")
      return
    }

    setIsConnecting(true)
    setError(null)
    setConnectionStatus("connecting")

    return new Promise((resolve, reject) => {
      try {
        console.log("🔌 Conectando ao servidor WebSocket independente:", url)

        // Criar nova conexão WebSocket
        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          console.log("✅ WebSocket conectado ao servidor independente")
          setIsConnected(true)
          setIsConnecting(false)
          setError(null)
          reconnectAttempts.current = 0
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
          }

          // Processar fila de mensagens
          processMessageQueue()

          resolve()
        }

        ws.onmessage = handleMessage

        ws.onclose = (event) => {
          console.log("🔌 WebSocket desconectado:", event.code, event.reason)
          setIsConnected(false)
          setIsConnecting(false)
          setConnectionStatus("disconnected")
          isAuthenticated.current = false
          currentRoomId.current = null
          clientId.current = null
        }

        ws.onerror = (error) => {
          console.error("❌ Erro WebSocket:", error)
          setError("Erro de conexão com servidor WebSocket independente")
          setLastError("Falha na conexão WebSocket")
          setIsConnecting(false)
          setConnectionStatus("error")
          reject(error)
        }
      } catch (error) {
        console.error("❌ Erro ao criar WebSocket:", error)
        setError("Falha ao criar conexão WebSocket")
        setIsConnecting(false)
        setConnectionStatus("error")
        reject(error)
      }
    })
  }, [url, isConnecting, isConnected, handleMessage, processMessageQueue])

  // // Desconectar
  const disconnect = useCallback(() => {
    console.log("🔌 Desconectando do servidor WebSocket independente...")

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Desconexão do cliente")
      wsRef.current = null
    }

    setIsConnected(false)
    setIsConnecting(false)
    setConnectionStatus("disconnected")
    setMessages([])
    setUsers([])
    setServerStats(null)
    isAuthenticated.current = false
    currentRoomId.current = null
    clientId.current = null
    reconnectAttempts.current = 0
  }, [])

  // // Autenticar
  const authenticate = useCallback(
    (sessionId: string, nick?: string) => {
      console.log("🔐 Autenticando no servidor independente:", nick)
      sendWebSocketMessage({
        type: "auth",
        sessionId: sessionId,
        nick: nick,
        userId: `user_${sessionId}`,
      })
    },
    [sendWebSocketMessage],
  )

  // // Entrar na sala
  const joinRoom = useCallback(
    (roomId: string) => {
      console.log("🏠 Entrando na sala:", roomId)
      sendWebSocketMessage({
        type: "join_room",
        roomId: roomId,
      })
    },
    [sendWebSocketMessage],
  )

  // // Enviar mensagem
  const sendMessage = useCallback(
    (message: string) => {
      console.log("💬 Enviando mensagem:", message.substring(0, 50))
      sendWebSocketMessage({
        type: "send_message",
        message: message,
      })
    },
    [sendWebSocketMessage],
  )

  // // Obter usuários da sala
  const getRoomUsers = useCallback(() => {
    console.log("👥 Solicitando usuários da sala")
    sendWebSocketMessage({
      type: "get_users",
    })
  }, [sendWebSocketMessage])

  // Obter estatísticas do servidor
  const getServerStats = useCallback(() => {
    console.log("📊 Solicitando estatísticas do servidor")
    sendWebSocketMessage({
      type: "get_stats",
    })
  }, [sendWebSocketMessage])

  // // Auto-conectar quando habilitado
  // useEffect(() => {
  //   if (autoConnect) {
  //     console.log("🚀 Auto-conectando ao servidor independente...")
  //     connect().catch((error) => {
  //       console.error("❌ Falha na conexão automática:", error)
  //     })
  //   }

  //   return () => {
  //     disconnect()
  //   }
  // }, [autoConnect, connect, disconnect])

  // // Auto-autenticar quando sessionId muda
  useEffect(() => {
    if (sessionId && isConnected && !isAuthenticated.current) {
      console.log("🔐 Auto-autenticando com sessionId:", sessionId)
      authenticate(sessionId, nick)
    }
  }, [sessionId, nick, isConnected, authenticate])

  // // Auto-entrar na sala quando roomId muda
  useEffect(() => {
    if (roomId && isAuthenticated.current && roomId !== currentRoomId.current) {
      console.log("🏠 Auto-entrando na sala:", roomId)
      joinRoom(roomId)
    }
  }, [roomId, joinRoom])

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    authenticate,
    joinRoom,
    sendMessage,
    getRoomUsers,
    getServerStats,
    messages,
    users,
    connectionStatus,
    lastError,
    serverStats,
  }
}
