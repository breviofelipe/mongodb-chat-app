"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertModal } from "@/components/ui/alert-modal"
import { useAlertModal } from "@/hooks/use-alert-modal"
import { MessageCircle, Plus, LogIn, AlertTriangle, Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

export default function LoginPage() {
  const [nick, setNick] = useState("")
  const [mongoUri, setMongoUri] = useState("")
  const [roomId, setRoomId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { isOpen, config, showSuccess, showError, showWarning, closeAlert } = useAlertModal()

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nick.trim() || !mongoUri.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorNick: nick.trim(),
          mongoUri: mongoUri.trim(),
        }),
      })

      if (response.ok) {
        const { roomId, sessionId } = await response.json()
        localStorage.setItem("chatSession", sessionId)
        localStorage.setItem("userNick", nick.trim())
        localStorage.setItem("roomId", roomId)
        localStorage.setItem("userRole", "creator")

        showSuccess(
          "Sala Criada com Sucesso!",
          `Sua sala foi criada. ID: ${roomId.slice(0, 12)}...\nRedirecionando para o chat...`,
          () => router.push(`/chat/${roomId}`),
        )
      } else {
        const errorData = await response.json()
        showError(
          "Erro ao Criar Sala",
          errorData.error ||
            "Não foi possível criar a sala. Verifique sua string de conexão MongoDB e tente novamente.",
        )
      }
    } catch (error) {
      console.error("Erro ao criar sala:", error)
      showError(
        "Erro de Conexão",
        "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nick.trim() || !roomId.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nick: nick.trim(),
          roomId: roomId.trim(),
        }),
      })

      if (response.ok) {
        const { sessionId, rejoining, sessionTerminated } = await response.json()
        localStorage.setItem("chatSession", sessionId)
        localStorage.setItem("userNick", nick.trim())
        localStorage.setItem("roomId", roomId.trim())
        localStorage.setItem("userRole", "participant")

        if (rejoining && sessionTerminated) {
          showWarning(
            "Sessão Anterior Encerrada",
            "Sua sessão anterior foi encerrada automaticamente. Você está agora conectado com uma nova sessão.",
            () => router.push(`/chat/${roomId.trim()}`),
          )
        } else {
          showSuccess(
            "Entrada na Sala Confirmada!",
            `Você entrou na sala com sucesso.\nRedirecionando para o chat...`,
            () => router.push(`/chat/${roomId.trim()}`),
          )
        }
      } else {
        const error = await response.json()
        showError(
          "Erro ao Entrar na Sala",
          error.error || "Não foi possível entrar na sala. Verifique o ID da sala e tente novamente.",
        )
      }
    } catch (error) {
      console.error("Erro ao entrar na sala:", error)
      showError(
        "Erro de Conexão",
        "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
      )
    } finally {
      setIsLoading(false)
    }
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

  const getThemeLabel = () => {
    if (theme === "dark") return "Escuro"
    if (theme === "light") return "Claro"
    return "Sistema"
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="w-full max-w-2xl">
          <Card className="w-full">
            <CardHeader className="text-center">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1" />
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-8 h-8" />
                  <CardTitle className="text-3xl font-bold">Chat P2P MongoDB</CardTitle>
                </div>
                <div className="flex-1 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setTheme(getNextTheme())} className="gap-2">
                    <ThemeIcon />
                    <span className="hidden sm:inline">{getThemeLabel()}</span>
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground mt-2">
                Chat privado entre duas pessoas com seus dados salvos no seu próprio MongoDB
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create">Criar Sala</TabsTrigger>
                  <TabsTrigger value="join">Entrar na Sala</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label htmlFor="creator-nick">Seu Nick</Label>
                      <Input
                        id="creator-nick"
                        type="text"
                        placeholder="Digite seu nick (ex: João, Maria123, Dev_User)..."
                        value={nick}
                        onChange={(e) => setNick(e.target.value)}
                        maxLength={20}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Escolha um nick único. Máximo 20 caracteres, sem espaços no início/fim.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="mongoUri">String de Conexão MongoDB</Label>
                      <Textarea
                        id="mongoUri"
                        placeholder="mongodb+srv://username:password@cluster.mongodb.net/database"
                        value={mongoUri}
                        onChange={(e) => setMongoUri(e.target.value)}
                        className="min-h-[100px] resize-none"
                        required
                      />
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Importante:</strong> Você será o host da sala e todas as mensagens serão salvas no seu
                          MongoDB. Compartilhe o ID da sala com a pessoa que deseja conversar.
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleCreateRoom}>
                    <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading || !nick || !mongoUri}>
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Criando Sala...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Plus className="w-5 h-5" />
                          Criar Sala de Chat
                        </div>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="join" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label htmlFor="participant-nick">Seu Nick</Label>
                      <Input
                        id="participant-nick"
                        type="text"
                        placeholder="Digite seu nick (ex: João, Maria123, Dev_User)..."
                        value={nick}
                        onChange={(e) => setNick(e.target.value)}
                        maxLength={20}
                        required
                      />
                      <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-amber-800 dark:text-amber-200">
                            <p className="font-medium mb-1">Atenção:</p>
                            <p>
                              Se você já esteve nesta sala com este nick, sua sessão anterior será encerrada
                              automaticamente e você entrará com uma nova sessão.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="roomId">ID da Sala</Label>
                      <Input
                        id="roomId"
                        type="text"
                        placeholder="Cole o ID da sala aqui..."
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        className="h-12"
                        required
                      />
                      <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                          <strong>Dica:</strong> Peça o ID da sala para a pessoa que a criou. O ID é gerado
                          automaticamente quando uma sala é criada.
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleJoinRoom}>
                    <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading || !nick || !roomId}>
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Entrando...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <LogIn className="w-5 h-5" />
                          Entrar na Sala
                        </div>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Sistema de chat P2P onde seus dados ficam no seu próprio MongoDB.
              <br />
              Máximo de 2 pessoas por sala para conversas privadas.
            </p>
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
