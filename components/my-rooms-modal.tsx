"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertModal } from "@/components/ui/alert-modal"
import { useAlertModal } from "@/hooks/use-alert-modal"
import { HotelIcon as Rooms, Copy, Users, Clock, MessageCircle, RefreshCw, ArrowRight } from "lucide-react"

interface Room {
  roomId: string
  createdBy: string
  createdAt: string
  participants: string[]
  participantCount: number
  messageCount: number
  lastActivity: string
  status: string
}

interface MyRoomsModalProps {
  userNick: string
  currentRoomId?: string
  onRoomSelect?: (roomId: string) => void
}

export function MyRoomsModal({ userNick, currentRoomId, onRoomSelect }: MyRoomsModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { isOpen: alertOpen, config, showError, showSuccess, showConfirm, closeAlert } = useAlertModal()

  const loadMyRooms = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/rooms/my-rooms?creator=${encodeURIComponent(userNick)}`)

      if (response.ok) {
        const data = await response.json()
        setRooms(data.rooms || [])
      } else {
        const errorData = await response.json()
        showError("Erro ao Carregar Salas", errorData.error || "Não foi possível carregar suas salas. Tente novamente.")
      }
    } catch (error) {
      console.error("Erro ao carregar salas:", error)
      showError("Erro de Conexão", "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadMyRooms()
    }
  }, [isOpen, userNick])

  const copyRoomId = (roomId: string) => {
    navigator.clipboard
      .writeText(roomId)
      .then(() => {
        showSuccess("ID Copiado!", "O ID da sala foi copiado para sua área de transferência.")
      })
      .catch(() => {
        showError("Erro ao Copiar", "Não foi possível copiar o ID da sala.")
      })
  }

  const goToRoom = (roomId: string) => {
    if (roomId === currentRoomId) {
      showSuccess("Já na Sala", "Você já está nesta sala!")
      setIsOpen(false)
      return
    }

    showConfirm(
      "Ir para Sala",
      `Deseja ir para a sala ${roomId.slice(0, 12)}...? Você sairá da sala atual.`,
      () => {
        if (onRoomSelect) {
          onRoomSelect(roomId)
        }
        setIsOpen(false)
      },
      "Ir para Sala",
      "Cancelar",
    )
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

  const getStatusBadge = (room: Room) => {
    if (room.participantCount >= 2) {
      return (
        <Badge variant="default" className="text-xs">
          Ativa (2/2)
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary" className="text-xs">
          Aguardando (1/2)
        </Badge>
      )
    }
  }

  const isCurrentRoom = (roomId: string) => roomId === currentRoomId

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Rooms className="w-4 h-4" />
            <span className="hidden sm:inline">Minhas Salas</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rooms className="w-5 h-5" />
              Minhas Salas
            </DialogTitle>
            <DialogDescription>
              Salas de chat criadas por você. Clique em uma sala para acessá-la ou copie o ID para compartilhar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Criador: <span className="font-medium">{userNick}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadMyRooms}
                disabled={isLoading}
                className="gap-2 bg-transparent"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            <ScrollArea className="h-[400px] w-full">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Carregando suas salas...</p>
                  </div>
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Você ainda não criou nenhuma sala.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use o botão "Nova Sala" para criar sua primeira sala.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rooms.map((room) => (
                    <div
                      key={room.roomId}
                      className={`border rounded-lg p-4 transition-colors ${
                        isCurrentRoom(room.roomId)
                          ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm truncate">
                              Sala {room.roomId.slice(0, 12)}...
                              {isCurrentRoom(room.roomId) && (
                                <span className="text-blue-600 dark:text-blue-400 ml-2">(atual)</span>
                              )}
                            </h3>
                            {getStatusBadge(room)}
                          </div>
                          <p className="text-xs text-muted-foreground">ID: {room.roomId}</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyRoomId(room.roomId)}
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          {!isCurrentRoom(room.roomId) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => goToRoom(room.roomId)}
                              className="h-8 w-8 p-0"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{room.participantCount}/2 participantes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          <span>{room.messageCount} mensagens</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Criada: {formatDate(room.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Ativa: {formatTime(room.lastActivity)}</span>
                        </div>
                      </div>

                      {room.participants.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Participantes:</p>
                          <div className="flex flex-wrap gap-1">
                            {room.participants.map((participant) => (
                              <Badge key={participant} variant="outline" className="text-xs">
                                {participant}
                                {participant === userNick && " (você)"}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={alertOpen}
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
