"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { SecureWebSocketClient, type WebSocketMessage } from "@/lib/websocket-client"

interface UseWebSocketConfig {
  sessionId: string
  roomId: string
  userNick: string
  enabled?: boolean
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

interface UseWebSocketReturn {
  isConnected: boolean
  sendMessage: (content: string) => void
  loadMessages: () => void
  connect: () => Promise<void>
  disconnect: () => void
  connectionStatus: "disconnected" | "connecting" | "connected" | "error"
}

export function useWebSocket(config: UseWebSocketConfig): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(
    "disconnected",
  )
  const wsClient = useRef<SecureWebSocketClient | null>(null)

  const connect = useCallback(async () => {
    if (wsClient.current?.isWebSocketConnected()) {
      return
    }

    setConnectionStatus("connecting")

    try {
      const wsUrl =
        process.env.NODE_ENV === "production" ? `wss://${window.location.hostname}:8443` : "wss://localhost:8443"

      wsClient.current = new SecureWebSocketClient({
        url: wsUrl,
        sessionId: config.sessionId,
        roomId: config.roomId,
        userNick: config.userNick,
        onMessage: (message) => {
          if (config.onMessage) {
            config.onMessage(message)
          }
        },
        onConnect: () => {
          setIsConnected(true)
          setConnectionStatus("connected")
          if (config.onConnect) {
            config.onConnect()
          }
        },
        onDisconnect: () => {
          setIsConnected(false)
          setConnectionStatus("disconnected")
          if (config.onDisconnect) {
            config.onDisconnect()
          }
        },
        onError: (error) => {
          setConnectionStatus("error")
          if (config.onError) {
            config.onError(error)
          }
        },
      })

      await wsClient.current.connect()
    } catch (error) {
      console.error("Failed to connect WebSocket:", error)
      setConnectionStatus("error")
    }
  }, [config])

  const disconnect = useCallback(() => {
    if (wsClient.current) {
      wsClient.current.disconnect()
      wsClient.current = null
    }
    setIsConnected(false)
    setConnectionStatus("disconnected")
  }, [])

  const sendMessage = useCallback((content: string) => {
    if (wsClient.current?.isWebSocketConnected()) {
      wsClient.current.sendChatMessage(content)
    } else {
      console.warn("WebSocket not connected, message not sent:", content)
    }
  }, [])

  const loadMessages = useCallback(() => {
    if (wsClient.current?.isWebSocketConnected()) {
      wsClient.current.loadMessages()
    }
  }, [])

  // Conectar automaticamente quando habilitado
  useEffect(() => {
    if (config.enabled && config.sessionId && config.roomId && config.userNick) {
      connect()
    }

    return () => {
      if (wsClient.current) {
        disconnect()
      }
    }
  }, [config.enabled, config.sessionId, config.roomId, config.userNick, connect, disconnect])

  // Atualizar configuração do cliente quando necessário
  useEffect(() => {
    if (wsClient.current) {
      wsClient.current.updateConfig({
        sessionId: config.sessionId,
        roomId: config.roomId,
        userNick: config.userNick,
      })
    }
  }, [config.sessionId, config.roomId, config.userNick])

  return {
    isConnected,
    sendMessage,
    loadMessages,
    connect,
    disconnect,
    connectionStatus,
  }
}
