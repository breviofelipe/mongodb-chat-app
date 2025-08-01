"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertModal } from "@/components/ui/alert-modal"
import { useAlertModal } from "@/hooks/use-alert-modal"
import { Plus, Copy, MessageCircle, Loader2, Database, Zap } from "lucide-react"

interface CreateRoomModalProps {
  userNick: string
  currentRoomId?: string
  onRoomCreated?: (roomId: string) => void
}

export function CreateRoomModal({ userNick, currentRoomId, onRoomCreated }: CreateRoomModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mongoUri, setMongoUri] = useState("")
  const [useCurrentMongo, setUseCurrentMongo] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [createdRoomId, setCreatedRoomId] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const { isOpen: alertOpen, config, showError, showSuccess: showSuccessAlert, closeAlert } = useAlertModal()

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()

    // Se usar MongoDB atual, não precisa de URI
    if (!useCurrentMongo && !mongoUri.trim()) {
      showError("MongoDB Obrigatório", "Por favor, insira a string de conexão MongoDB ou use a conexão atual.")
      return
    }

    setIsLoading(true)
    try {
      const requestBody: any = {
        creatorNick: userNick,
        useCurrentMongo: useCurrentMongo,
      }

      // Se usar MongoDB atual, incluir o roomId atual para buscar a conexão
      if (useCurrentMongo && currentRoomId) {
        requestBody.currentRoomId = currentRoomId
      } else if (!useCurrentMongo) {
        requestBody.mongoUri = mongoUri.trim()
      }

      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const { roomId } = await response.json()
        setCreatedRoomId(roomId)
        setShowSuccess(true)
        setMongoUri("")

        if (onRoomCreated) {
          onRoomCreated(roomId)
        }
      } else {
        const errorData = await response.json()
        showError(
          "Erro ao Criar Nova Sala",
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

  const copyRoomId = () => {
    navigator.clipboard
      .writeText(createdRoomId)
      .then(() => {
        showSuccessAlert(
          "ID da Nova Sala Copiado!",
          "O ID da nova sala foi copiado para sua área de transferência. Compartilhe com quem deseja conversar.",
        )
      })
      .catch(() => {
        showError("Erro ao Copiar", "Não foi possível copiar o ID da sala. Tente selecionar e copiar manualmente.")
      })
  }

  const goToNewRoom = () => {
    if (onRoomCreated) {
      onRoomCreated(createdRoomId)
    }
    handleClose()
  }

  const handleClose = () => {
    setIsOpen(false)
    setShowSuccess(false)
    setCreatedRoomId("")
    setMongoUri("")
    setUseCurrentMongo(true)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Sala</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          {!showSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Criar Nova Sala
                </DialogTitle>
                <DialogDescription>
                  Crie uma nova sala de chat rapidamente. Você pode reutilizar a conexão MongoDB atual ou usar uma nova.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="creator-info">Criador da Sala</Label>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium">{userNick}</p>
                    <p className="text-xs text-muted-foreground">Você será o criador desta nova sala</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Configuração do MongoDB</Label>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="use-current-mongo"
                      checked={useCurrentMongo}
                      onCheckedChange={(checked) => setUseCurrentMongo(checked as boolean)}
                    />
                    <Label htmlFor="use-current-mongo" className="text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-green-600" />
                      Usar MongoDB da sala atual (recomendado)
                    </Label>
                  </div>

                  {useCurrentMongo ? (
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-green-800 dark:text-green-200 text-sm">
                        <Database className="w-4 h-4" />
                        <span className="font-medium">Conexão Reutilizada</span>
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        A nova sala usará a mesma conexão MongoDB da sala atual. Isso é mais rápido e mantém seus dados
                        organizados.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="new-mongo-uri">Nova String de Conexão MongoDB</Label>
                      <Textarea
                        id="new-mongo-uri"
                        placeholder="mongodb+srv://username:password@cluster.mongodb.net/database"
                        value={mongoUri}
                        onChange={(e) => setMongoUri(e.target.value)}
                        className="min-h-[80px] resize-none"
                        required={!useCurrentMongo}
                        disabled={isLoading}
                      />
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          <strong>Opcional:</strong> Use uma conexão MongoDB diferente para esta sala. Os dados serão
                          salvos separadamente.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="w-full sm:w-auto bg-transparent"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Sala
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <MessageCircle className="w-5 h-5" />
                  Nova Sala Criada!
                </DialogTitle>
                <DialogDescription>
                  Sua nova sala foi criada com sucesso. Você pode ir para a nova sala agora ou copiar o ID para
                  compartilhar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>ID da Nova Sala</Label>
                  <div className="bg-muted p-3 rounded-lg border">
                    <p className="font-mono text-sm break-all">{createdRoomId}</p>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-green-800 dark:text-green-200 text-sm space-y-1">
                    <p className="font-medium">✅ Sala criada com sucesso!</p>
                    <p>• Você é o criador desta sala</p>
                    <p>• Compartilhe o ID com quem deseja conversar</p>
                    <p>• A pessoa pode entrar com qualquer nick</p>
                    <p>• Máximo de 2 pessoas por sala</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={copyRoomId} className="w-full sm:w-auto bg-transparent">
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar ID
                </Button>
                <Button onClick={goToNewRoom} className="w-full sm:w-auto">
                  <Zap className="w-4 h-4 mr-2" />
                  Ir para Nova Sala
                </Button>
              </DialogFooter>
            </>
          )}
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
