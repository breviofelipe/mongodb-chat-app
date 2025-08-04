"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertModal } from "@/components/ui/alert-modal"
import { useAlertModal } from "@/hooks/use-alert-modal"
import { MobileMenu } from "@/components/mobile-menu"
import {
  LogOut,
  Send,
  Copy,
  Users,
  MessageCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Shield,
  Moon,
  Sun,
  Monitor,
  Activity,
  WifiOff,
} from "lucide-react"
import { useTheme } from "next-themes"
import { CreateRoomModal } from "@/components/create-room-modal"
import { MyRoomsModal } from "@/components/my-rooms-modal"
import { useWebSocket } from "@/hooks/use-websocket"
import { Separator } from "@/components/ui/separator"

interface Message {
  id: string
  sender: string
  nick: string
  content: string
  message: string
  timestamp: string
  type: "message" | "system"
  sessionId?: string
  metadata?: any
}

interface RoomInfo {
  roomId: string
  createdBy: string
  participants: string[]
  createdAt: string
  messageCount: number
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [userNick, setUserNick] = useState("")
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [isCheckingMessages, setIsCheckingMessages] = useState(false)
  const [lastMessageCount, setLastMessageCount] = useState(0)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [sessionTerminatedWarning, setSessionTerminatedWarning] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const { isOpen, config, showSuccess, showError, showWarning, showInfo, showConfirm, closeAlert } = useAlertModal()
  const [sessionId, setSessionId] = useState<string | null>(null)

  const URL  =  process.env.NEXT_PUBLIC_WS_URL || "wss://localhost:8080" // URL do WebSocket, pode ser configurada via variável de ambiente
   // WebSocket hook com URL atualizada
  const {
    isConnected: wsConnected,
    isConnecting: wsConnecting,
    error: wsError,
    connect: wsConnect,
    disconnect: wsDisconnect,
    sendMessage: wsSendMessage,
    getRoomUsers: wsGetRoomUsers,
    messages: wsMessages,
    users: wsUsers,
    connectionStatus,
    lastError,
  } = useWebSocket({
    url: URL,    
    autoConnect: true,
    sessionId: sessionId || undefined,
    roomId: roomId,
    nick: userNick || undefined,
  })
  const allMessages = [...wsMessages]
  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  .filter(
    (msg, index, arr) =>
      // Remover duplicatas baseado no ID
      arr.findIndex((m) => m.id === msg.id) === index,
  )
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-blue-600"
      case "authenticated":
        return "text-yellow-600"
      case "in_room":
        return "text-green-600"
      case "connecting":
        return "text-orange-600"
      case "error":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Conectado"
      case "authenticated":
        return "Autenticado"
      case "in_room":
        return "Online"
      case "connecting":
        return "Conectando..."
      case "error":
        return "Erro"
      default:
        return "Desconectado"
    }
  }
  useEffect(() => {
  try {
    wsConnect().then(() => {
    showSuccess("Modo WebSocket", "WebSocket habilitado. Comunicação em tempo real ativada!")
   })
    } catch (error) {
      console.error("❌ Erro ao conectar WebSocket:", error)
      showError("Erro WebSocket", "Falha ao conectar WebSocket. Usando HTTP como fallback.")
    }
  }, [sessionId, roomId])

  useEffect(() => {
    const storedNick = localStorage.getItem("userNick")
    const storedSession = localStorage.getItem("chatSession")

    if (!storedNick || !storedSession) {
      router.push("/")
      return
    }
    setSessionId(storedSession)
    setUserNick(storedNick)
    loadRoomInfo()
  }, [roomId, router])
    // Mostrar erros do WebSocket
  useEffect(() => {
    if (lastError) {
      showError("Erro WebSocket", lastError)
    }
  }, [lastError, showError])

  useEffect(() => {
    scrollToBottom()
  }, [allMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadRoomInfo = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`)
      if (response.ok) {
        const info = await response.json()
        setRoomInfo(info)
        setIsConnected(true)
      } else {
        console.error("Erro ao carregar sala:", response.status)
        const errorData = await response.json()
        console.error("Detalhes do erro:", errorData)

        if (response.status === 404) {
          showError(
            "Sala Não Encontrada",
            "A sala que você está tentando acessar não existe ou foi removida. Você será redirecionado para a página inicial.",
            () => router.push("/"),
          )
        } else {
          showError(
            "Erro ao Carregar Sala",
            "Não foi possível carregar as informações da sala. Verifique sua conexão e tente novamente.",
          )
        }
      }
    } catch (error) {
      console.error("Erro ao carregar info da sala:", error)
      showError(
        "Erro de Conexão",
        "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
      )
    }
  }

  const loadMessages = async () => {
    try {
      const sessionId = localStorage.getItem("chatSession")
      const response = await fetch(`/api/rooms/${roomId}/messages`, {
        headers: {
          "session-id": sessionId || "",
        },
      })

      if (response.ok) {
        const data = await response.json()
        const newMessages = data.messages || []

        if (newMessages.length > lastMessageCount && lastMessageCount > 0) {
          setHasNewMessages(true)
        }

        setMessages(newMessages)
        setLastMessageCount(newMessages.length)
      } else {
        console.error("Erro ao carregar mensagens:", response.status)
        const errorData = await response.json()
        console.error("Detalhes:", errorData)
      }
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !sessionId) return

    const messageText = newMessage.trim()
    setNewMessage("")

    console.log("💬 Enviando mensagem:", messageText.substring(0, 50))

    try {
      if (wsConnected) {
        // Enviar via WebSocket
        console.log("📡 Enviando via WebSocket...")
        wsSendMessage(messageText)
      }
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem:", error)
      showError("Erro", "Não foi possível enviar a mensagem. Tente novamente.")
    }

    // Focar no input novamente
    messageInputRef.current?.focus()
  }

  const handleLogout = () => {
    showConfirm(
      "Sair da Sala",
      "Tem certeza que deseja sair da sala? Você precisará do ID da sala para entrar novamente.",
      () => {
        localStorage.removeItem("chatSession")
        localStorage.removeItem("roomId")
        localStorage.removeItem("userRole")
        router.push("/")
      },
      "Sair",
      "Cancelar",
    )
  }

  const handleRejoin = async () => {
    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nick: userNick,
          roomId: roomId,
        }),
      })

      if (response.ok) {
        const { sessionId, sessionTerminated } = await response.json()
        localStorage.setItem("chatSession", sessionId)
        setSessionExpired(false)
        setSessionTerminatedWarning(false)
        loadMessages()

        if (sessionTerminated) {
          showSuccess(
            "Reconectado com Sucesso!",
            "Você foi reconectado à sala. Sua sessão anterior foi encerrada automaticamente.",
          )
        } else {
          showSuccess("Reconectado!", "Você foi reconectado à sala com sucesso.")
        }
      } else {
        const errorData = await response.json()
        showError(
          "Erro ao Reconectar",
          errorData.error || "Não foi possível reconectar. Tente novamente ou saia e entre novamente na sala.",
        )
      }
    } catch (error) {
      console.error("Erro ao reconectar:", error)
      showError(
        "Erro de Conexão",
        "Não foi possível reconectar devido a um problema de conexão. Verifique sua internet e tente novamente.",
      )
    }
  }

  const copyRoomId = () => {
    navigator.clipboard
      .writeText(roomId)
      .then(() => {
        showSuccess(
          "ID Copiado!",
          "O ID da sala foi copiado para sua área de transferência. Você pode compartilhá-lo com outras pessoas.",
        )
      })
      .catch(() => {
        showError("Erro ao Copiar", "Não foi possível copiar o ID da sala. Tente selecionar e copiar manualmente.")
      })
  }

  // Função para navegar para nova sala
  const handleRoomCreated = (newRoomId: string) => {
    showSuccess("Nova Sala Criada!", `Sala ${newRoomId.slice(0, 12)}... criada com sucesso! Redirecionando...`, () => {
      // Atualizar localStorage com nova sessão
      localStorage.setItem("roomId", newRoomId)
      // Navegar para nova sala
      router.push(`/chat/${newRoomId}`)
    })
  }

  // Função para navegar para sala selecionada
  const handleRoomSelected = (selectedRoomId: string) => {
    // Atualizar localStorage
    localStorage.setItem("roomId", selectedRoomId)
    // Navegar para sala selecionada
    router.push(`/chat/${selectedRoomId}`)
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("pt-BR")
  }

  const ThemeIcon = () => {
    if (theme === "dark") return <Moon className="w-4 h-4" />
    if (theme === "light") return <Sun className="w-4 h-4" />
    return <Monitor className="w-4 h-4" />
  }

  const getNextTheme = () => {
    if (theme === "light") return "dark"
    if (theme === "dark") return "system"
    return "light"
  }

  if (!isConnected || !roomInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Conectando à sala...</p>
        </div>
      </div>
    )
  }
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b px-4 py-3 shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-3">
              <Avatar className="w-8 h-8 md:w-10 md:h-10">
                <AvatarFallback>{userNick.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold flex items-center gap-2 text-sm md:text-base truncate">
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{userNick}</span>
                  <span className="hidden sm:inline">- Sala {roomId.slice(0, 8)}</span> 
                  <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1">
                  {wsConnected ? (
                    <Activity className="h-4 w-4 text-green-600" />
                  ) : wsConnecting ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-orange-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                  <span className={getConnectionStatusColor()}>{getConnectionStatusText()}</span>
                </div>
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2 truncate">
                  <Users className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    {roomInfo.participants.join(", ")} ({roomInfo.participants.length}/2)
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Desktop Controls */}
              <div className="hidden md:flex items-center gap-2">
                {sessionExpired && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRejoin}
                    className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Reconectar
                  </Button>
                )}

                {/* Botões exclusivos para criadores */}
                {roomInfo.createdBy === userNick && (
                  <>
                    <CreateRoomModal userNick={userNick} currentRoomId={roomId} onRoomCreated={handleRoomCreated} />
                    <MyRoomsModal userNick={userNick} currentRoomId={roomId} onRoomSelect={handleRoomSelected} />
                  </>
                )}

                <Button variant="outline" size="sm" onClick={copyRoomId}>
                  <Copy className="w-4 h-4 mr-2" />
                  <span className="hidden lg:inline">Copiar ID</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTheme(getNextTheme())}>
                  <ThemeIcon />
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  <span className="hidden lg:inline">Sair</span>
                </Button>
              </div>

              {/* Mobile Menu */}
              <MobileMenu
                roomInfo={roomInfo}
                userNick={userNick}
                messagesCount={messages.length}
                sessionExpired={sessionExpired}
                currentRoomId={roomId}
                onCopyRoomId={copyRoomId}
                onReconnect={handleRejoin}
                onLogout={handleLogout}
                onRoomCreated={handleRoomCreated}
                onRoomSelected={handleRoomSelected}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex max-w-6xl mx-auto w-full">
          {/* Chat Principal */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {allMessages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>Nenhuma mensagem ainda. Seja o primeiro a falar!</p>
                    {wsConnected && (
                      <p className="text-xs mt-2 text-green-600 dark:text-green-400">
                        🌐 Conexão WebSocket ativa - mensagens em tempo real
                      </p>
                    )}
                  </div>
                )}

                {allMessages.map((message, index) => {
                  const showDate =
                    index === 0 || formatDate(message.timestamp) !== formatDate(allMessages[index - 1].timestamp)

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="text-center my-4">
                          <Badge variant="secondary" className="text-xs">
                            {formatDate(message.timestamp)}
                          </Badge>
                        </div>
                      )}

                      {message.type === "system" ? (
                        <div className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              message.content.includes("sessão anterior encerrada")
                                ? "border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950"
                                : message.content.includes("conexão reutilizada")
                                  ? "border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950"
                                  : ""
                            }`}
                          >
                            {message.metadata?.sessionTerminated && <Shield className="w-3 h-3 mr-1" />}
                            {message.metadata?.createdViaReuse && <RefreshCw className="w-3 h-3 mr-1" />}
                            {message.content}
                          </Badge>
                        </div>
                      ) : (
                        <div
                          className={`flex items-start space-x-3 ${
                            message.nick === userNick ? "flex-row-reverse space-x-reverse" : ""
                          }`}
                        >
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarFallback className="text-xs">
                              {message.nick && message.nick.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div
                            className={`flex flex-col space-y-1 max-w-[75%] sm:max-w-xs lg:max-w-md ${
                              message.nick === userNick ? "items-end" : "items-start"
                            }`}
                          >
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{message.nick}</span>
                              <span>{formatTime(message.timestamp)}</span>
                            </div>
                            <div
                              className={`px-4 py-2 rounded-lg break-words ${
                                message.nick === userNick ? "bg-primary text-primary-foreground" : "bg-muted border"
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="bg-card border-t p-4">
              {sessionExpired ? (
                <div className="flex items-center justify-center p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <Shield className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                  <span className="text-red-800 dark:text-red-200 text-sm">
                    <span className="hidden sm:inline">
                      Sua sessão foi encerrada. Clique em "Reconectar" para continuar conversando.
                    </span>
                    <span className="sm:hidden">Sessão encerrada. Reconecte para continuar.</span>
                  </span>
                </div>
              ) : (
                // <form onSubmit={} className="flex space-x-2">
                  <div className="flex gap-2">
                    <Input
                    ref={messageInputRef}
                    value={newMessage}
                    onKeyUp={handleKeyPress}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Mensagem para ${roomInfo.participants.filter((p) => p !== userNick)[0] || "sala"}...`}
                    className="flex-1 min-w-0"
                    disabled={isLoading}
                    maxLength={1000}
                  />
                  <Button onClick={handleSendMessage} disabled={isLoading || !newMessage.trim()} className="flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                  </div>
                // </form>
              )}
            </div>
          </div>

          {/* Desktop Sidebar - Hidden on Mobile */}
            <div className="fixed top-0 right-0 h-screen w-80 bg-card border-l p-4 space-y-4 hidden md:block z-40">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Informações da Sala
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">ID:</span>
                  <p className="text-muted-foreground break-all">{roomId}</p>
                </div>
                <div>
                  <span className="font-medium">Criada por:</span>
                  <p className="text-muted-foreground">{roomInfo.createdBy}</p>
                </div>
                <div>
                  <span className="font-medium">Participantes:</span>
                  {/* Users List */}
                  <div className="space-y-2">
                    {wsUsers.map((user) => (
                      <div key={user.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{user.nick.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.nick === userNick ? `${user.nick} (você)` : user.nick}</p>
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="text-xs text-muted-foreground">Online</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Mensagens:</span>
                  <p className="text-muted-foreground">{allMessages.length}</p>
                </div>
                <div>
                  <span className="font-medium">Criada em:</span>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(roomInfo.createdAt)} às {formatTime(roomInfo.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Seção especial para criadores */}
            {roomInfo.createdBy === userNick && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Gerenciar Salas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Como criador, você pode criar novas salas rapidamente e gerenciar todas suas conversas.
                  </p>
                  <div className="space-y-2">
                    <CreateRoomModal userNick={userNick} currentRoomId={roomId} onRoomCreated={handleRoomCreated} />
                    <MyRoomsModal userNick={userNick} currentRoomId={roomId} onRoomSelect={handleRoomSelected} />
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                    <p>• ⚡ Reutiliza conexão MongoDB atual</p>
                    <p>• 🚀 Criação instantânea de salas</p>
                    <p>• 📋 Gerenciamento centralizado</p>
                    <p>• 🔄 Navegação rápida entre salas</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {roomInfo.participants.length < 2 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-orange-600 dark:text-orange-400">
                    Aguardando participante
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Compartilhe o ID da sala para que alguém possa se juntar ao chat.</p>
                  <Button variant="outline" size="sm" className="w-full mt-2 bg-transparent" onClick={copyRoomId}>
                    <Copy className="w-3 h-3 mr-2" />
                    Copiar ID da Sala
                  </Button>
                </CardContent>
              </Card>
            )}
            {/* <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">🔒 Segurança de Sessão</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• Apenas uma sessão ativa por nick</p>
                <p>• Sessões anteriores são encerradas automaticamente</p>
                <p>• Reconecte se sua sessão for encerrada</p>
                <p>• Nicks são livres (sem cadastro prévio)</p>
              </CardContent>
            </Card> */}
            {/* WebSocket Info */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">🌐 WebSocket Comum</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• 🚀 Comunicação bidirecional em tempo real</p>
                <p>• ⚡ Latência ultra-baixa para mensagens</p>
                <p>• 🌐 Protocolo ws:// (desenvolvimento)</p>
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  <strong>Status:</strong> {getConnectionStatusText()}
                  <br />
                  <strong>URL:</strong> ws://localhost:8080
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={isOpen}
        onClose={closeAlert}
        onConfirm={config.onConfirm}
        type={config.type}
        title={config.title}
        message={config.message}
        confirmText={config.confirmText}
        cancelText={config.cancelText}
        showCancel={config.showCancel}
      />
    </>
  )
}
