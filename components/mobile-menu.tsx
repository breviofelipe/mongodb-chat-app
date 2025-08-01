"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AlertModal } from "@/components/ui/alert-modal"
import { useAlertModal } from "@/hooks/use-alert-modal"
import { CreateRoomModal } from "@/components/create-room-modal"
import { MyRoomsModal } from "@/components/my-rooms-modal"
import {
  Menu,
  Users,
  Clock,
  Copy,
  Shield,
  Moon,
  Sun,
  Monitor,
  MessageCircle,
  AlertTriangle,
  LogOut,
} from "lucide-react"
import { useTheme } from "next-themes"

interface RoomInfo {
  roomId: string
  createdBy: string
  participants: string[]
  createdAt: string
  messageCount: number
}

interface MobileMenuProps {
  roomInfo: RoomInfo
  userNick: string
  messagesCount: number
  sessionExpired: boolean
  currentRoomId?: string
  onCopyRoomId: () => void
  onReconnect: () => void
  onLogout: () => void
  onRoomCreated?: (roomId: string) => void
  onRoomSelected?: (roomId: string) => void
}

export function MobileMenu({
  roomInfo,
  userNick,
  messagesCount,
  sessionExpired,
  currentRoomId,
  onCopyRoomId,
  onReconnect,
  onLogout,
  onRoomCreated,
  onRoomSelected,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { isOpen, config, showConfirm, closeAlert } = useAlertModal()

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

  const getThemeLabel = () => {
    if (theme === "dark") return "Escuro"
    if (theme === "light") return "Claro"
    return "Sistema"
  }

  const handleLogout = () => {
    setOpen(false)
    showConfirm(
      "Sair da Sala",
      "Tem certeza que deseja sair da sala? Você precisará do ID da sala para entrar novamente.",
      onLogout,
      "Sair",
      "Cancelar",
    )
  }

  const handleRoomCreated = (roomId: string) => {
    setOpen(false)
    if (onRoomCreated) {
      onRoomCreated(roomId)
    }
  }

  const handleRoomSelected = (roomId: string) => {
    setOpen(false)
    if (onRoomSelected) {
      onRoomSelected(roomId)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="md:hidden bg-transparent">
            <Menu className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[350px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Menu da Sala
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Ações Rápidas */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessageCircle className="w-4 h-4" />
                Ações Rápidas
              </div>

              <div className="space-y-2 pl-6">
                {/* Botões exclusivos para criadores */}
                {roomInfo.createdBy === userNick && (
                  <div className="space-y-2 mb-3 pb-3 border-b">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                      ⚡ Gerenciar Salas (Criador):
                    </div>
                    <CreateRoomModal
                      userNick={userNick}
                      currentRoomId={currentRoomId}
                      onRoomCreated={handleRoomCreated}
                    />
                    <MyRoomsModal userNick={userNick} currentRoomId={currentRoomId} onRoomSelect={handleRoomSelected} />
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-transparent"
                  onClick={() => {
                    onCopyRoomId()
                    setOpen(false)
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar ID da Sala
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-transparent"
                  onClick={() => setTheme(getNextTheme())}
                >
                  <ThemeIcon />
                  <span className="ml-2">Tema: {getThemeLabel()}</span>
                </Button>

                {sessionExpired && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900"
                    onClick={() => {
                      onReconnect()
                      setOpen(false)
                    }}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Reconectar Sessão
                  </Button>
                )}

                <Button variant="destructive" size="sm" className="w-full justify-start mt-4" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da Sala
                </Button>
              </div>
            </div>

            {/* Informações da Sala */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="w-4 h-4" />
                Informações da Sala
              </div>

              <div className="space-y-3 text-sm pl-6">
                <div>
                  <span className="font-medium text-muted-foreground">ID:</span>
                  <p className="text-foreground break-all mt-1 font-mono text-xs bg-muted p-2 rounded">
                    {roomInfo.roomId}
                  </p>
                </div>

                <div>
                  <span className="font-medium text-muted-foreground">Criada por:</span>
                  <p className="text-foreground mt-1">{roomInfo.createdBy}</p>
                </div>

                <div>
                  <span className="font-medium text-muted-foreground">Participantes:</span>
                  <div className="space-y-2 mt-2">
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

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="font-medium text-muted-foreground">Mensagens:</span>
                    <p className="text-foreground mt-1 text-lg font-semibold">{messagesCount}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Criada em:</span>
                    <p className="text-foreground flex items-center gap-1 mt-1 text-xs">
                      <Clock className="w-3 h-3" />
                      {formatTime(roomInfo.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status da Sala */}
            {roomInfo.participants.length < 2 && (
              <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-sm font-medium mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Aguardando participante
                </div>
                <p className="text-orange-600 dark:text-orange-400 text-sm">
                  Compartilhe o ID da sala para que alguém possa se juntar ao chat.
                </p>
              </div>
            )}

            {/* Segurança de Sessão */}
            {sessionExpired ? (
              <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm font-medium mb-2">
                  <Shield className="w-4 h-4" />
                  Sessão Encerrada
                </div>
                <p className="text-red-600 dark:text-red-400 text-sm mb-3">
                  Sua sessão foi encerrada automaticamente. Isso acontece quando você entra na sala em outro
                  dispositivo.
                </p>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm font-medium mb-2">
                  <Shield className="w-4 h-4" />
                  Segurança de Sessão
                </div>
                <div className="text-green-600 dark:text-green-400 text-xs space-y-1">
                  <p>• Apenas uma sessão ativa por nick</p>
                  <p>• Sessões anteriores são encerradas automaticamente</p>
                  <p>• Nicks são livres (sem cadastro prévio)</p>
                  <p>• Dados seguros no seu MongoDB</p>
                </div>
              </div>
            )}

            {/* Dicas para Criadores */}
            {roomInfo.createdBy === userNick && (
              <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="text-blue-700 dark:text-blue-300 text-sm font-medium mb-2 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Dicas para Criadores
                </div>
                <div className="text-blue-600 dark:text-blue-400 text-xs space-y-1">
                  <p>• ⚡ "Nova Sala" reutiliza sua conexão MongoDB</p>
                  <p>• 🚀 Criação instantânea sem reconfigurar</p>
                  <p>• 📋 "Minhas Salas" mostra todas suas salas</p>
                  <p>• 🔄 Navegue rapidamente entre conversas</p>
                  <p>• 📱 Funciona perfeitamente no mobile</p>
                </div>
              </div>
            )}

            {/* Dicas Mobile Gerais */}
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800">
              <div className="text-gray-700 dark:text-gray-300 text-sm font-medium mb-2 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Dicas Mobile
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-xs space-y-1">
                <p>• Toque em "Verificar Mensagens" para atualizar</p>
                <p>• Use este menu para acessar todas as funções</p>
                <p>• Gire o dispositivo para melhor visualização</p>
                <p>• Mantenha a tela ativa durante conversas</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
