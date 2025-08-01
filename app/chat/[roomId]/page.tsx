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
} from "lucide-react"
import { useTheme } from "next-themes"
import { CreateRoomModal } from "@/components/create-room-modal"
import { MyRoomsModal } from "@/components/my-rooms-modal"

interface Message {
  id: string
  sender: string
  content: string
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
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const { isOpen, config, showSuccess, showError, showWarning, showInfo, showConfirm, closeAlert } = useAlertModal()

  useEffect(() => {
    const storedNick = localStorage.getItem("userNick")
    const storedSession = localStorage.getItem("chatSession")

    if (!storedNick || !storedSession) {
      router.push("/")
      return
    }

    setUserNick(storedNick)
    loadRoomInfo()
    loadMessages()
  }, [roomId, router])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  const checkForNewMessages = async () => {
    setIsCheckingMessages(true)
    setHasNewMessages(false)

    try {
      await loadMessages()
    } catch (error) {
      console.error("Erro ao verificar mensagens:", error)
    } finally {
      setIsCheckingMessages(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isLoading) return

    setIsLoading(true)
    try {
      const sessionId = localStorage.getItem("chatSession")
      const response = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "session-id": sessionId || "",
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          sender: userNick,
        }),
      })

      if (response.ok) {
        setNewMessage("")
        await loadMessages()
        setSessionExpired(false)
        setSessionTerminatedWarning(false)
      } else if (response.status === 401) {
        const errorData = await response.json()
        if (errorData.sessionExpired || errorData.reason === "session_terminated_or_invalid") {
          setSessionExpired(true)
          setSessionTerminatedWarning(true)
          showWarning(
            "Sessão Encerrada",
            "Sua sessão foi encerrada automaticamente. Isso pode ter acontecido porque você entrou na sala em outro dispositivo ou aba do navegador. Use o botão 'Reconectar' para continuar.",
          )
        }
      } else {
        const errorData = await response.json()
        showError("Erro ao Enviar Mensagem", errorData.error || "Não foi possível enviar a mensagem. Tente novamente.")
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error)
      showError(
        "Erro de Conexão",
        "Não foi possível enviar a mensagem devido a um problema de conexão. Verifique sua internet e tente novamente.",
      )
    } finally {
      setIsLoading(false)
    }
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

  return (
    <>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="bg-card border-b px-4 py-3 shadow-sm">
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
                  {sessionExpired && (
                    <Badge variant="destructive" className="text-xs flex-shrink-0">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">Sessão Encerrada</span>
                      <span className="sm:hidden">!</span>
                    </Badge>
                  )}
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
            {/* Botão de Verificar Mensagens */}
            <div className="bg-card border-b px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkForNewMessages}
                    disabled={isCheckingMessages}
                    className={
                      hasNewMessages
                        ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                        : ""
                    }
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingMessages ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">
                      {isCheckingMessages ? "Verificando..." : "Verificar Mensagens"}
                    </span>
                    <span className="sm:hidden">{isCheckingMessages ? "..." : "Verificar"}</span>
                  </Button>
                  {hasNewMessages && (
                    <Badge variant="default" className="text-xs animate-pulse">
                      <span className="hidden sm:inline">Novas mensagens!</span>
                      <span className="sm:hidden">Novas!</span>
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {messages.length} msg{messages.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* Warning de Sessão Encerrada */}
            {sessionTerminatedWarning && (
              <div className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 px-4 py-2">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200 text-sm">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span className="min-w-0">
                    <strong>Sessão Encerrada:</strong>
                    <span className="hidden sm:inline">
                      {" "}
                      Você pode ter entrado na sala em outro dispositivo. Clique em "Reconectar" para continuar.
                    </span>
                    <span className="sm:hidden"> Reconecte para continuar.</span>
                  </span>
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>Nenhuma mensagem ainda. Seja o primeiro a falar!</p>
                  </div>
                )}

                {messages.map((message, index) => {
                  const showDate =
                    index === 0 || formatDate(message.timestamp) !== formatDate(messages[index - 1].timestamp)

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
                            message.sender === userNick ? "flex-row-reverse space-x-reverse" : ""
                          }`}
                        >
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarFallback className="text-xs">
                              {message.sender.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div
                            className={`flex flex-col space-y-1 max-w-[75%] sm:max-w-xs lg:max-w-md ${
                              message.sender === userNick ? "items-end" : "items-start"
                            }`}
                          >
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{message.sender}</span>
                              <span>{formatTime(message.timestamp)}</span>
                            </div>
                            <div
                              className={`px-4 py-2 rounded-lg break-words ${
                                message.sender === userNick ? "bg-primary text-primary-foreground" : "bg-muted border"
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                <form onSubmit={sendMessage} className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Mensagem para ${roomInfo.participants.filter((p) => p !== userNick)[0] || "sala"}...`}
                    className="flex-1 min-w-0"
                    disabled={isLoading}
                    maxLength={1000}
                  />
                  <Button type="submit" disabled={isLoading || !newMessage.trim()} className="flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Desktop Sidebar - Hidden on Mobile */}
          <div className="hidden md:block w-80 bg-card border-l p-4 space-y-4">
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
                  <div className="space-y-1 mt-1">
                    {roomInfo.participants.map((participant) => (
                      <div key={participant} className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">{participant.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className={participant === userNick ? "font-medium" : ""}>
                          {participant}
                          {participant === userNick && " (você)"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Mensagens:</span>
                  <p className="text-muted-foreground">{messages.length}</p>
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

            {sessionExpired && (
              <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Sessão Encerrada
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-red-800 dark:text-red-200">
                  <p className="mb-3">
                    Sua sessão foi encerrada automaticamente. Isso acontece quando você entra na sala em outro
                    dispositivo ou aba do navegador.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700"
                    onClick={handleRejoin}
                  >
                    <Shield className="w-3 h-3 mr-2" />
                    Reconectar Agora
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">🔒 Segurança de Sessão</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• Apenas uma sessão ativa por nick</p>
                <p>• Sessões anteriores são encerradas automaticamente</p>
                <p>• Reconecte se sua sessão for encerrada</p>
                <p>• Nicks são livres (sem cadastro prévio)</p>
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
