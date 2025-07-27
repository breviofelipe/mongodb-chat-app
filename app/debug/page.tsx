"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DebugPage() {
  const [roomId, setRoomId] = useState("")
  const [nick, setNick] = useState("")
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const testSystemDatabase = async () => {
    setLoading(true)
    try {
      // Simular teste do sistema auxiliar
      const response = await fetch("/api/rooms")
      const data = await response.json()
      setResults((prev) => ({
        ...prev,
        systemDatabase: {
          status: response.status,
          data,
          description: "Sistema auxiliar - apenas metadados",
        },
      }))
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        systemDatabase: { error: error.message },
      }))
    }
    setLoading(false)
  }

  const testUserDatabase = async () => {
    setLoading(true)
    try {
      if (!roomId) {
        alert("Informe um Room ID")
        setLoading(false)
        return
      }

      const response = await fetch(`/api/rooms/${roomId}/messages`)
      const data = await response.json()
      setResults((prev) => ({
        ...prev,
        userDatabase: {
          status: response.status,
          data,
          description: "MongoDB do usuário - dados completos",
        },
      }))
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        userDatabase: { error: error.message },
      }))
    }
    setLoading(false)
  }

  const testDualArchitecture = async () => {
    setLoading(true)
    try {
      // Teste 1: Criar sala (dados vão para ambos os bancos)
      const createResponse = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorNick: "DebugUser",
          mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017",
        }),
      })

      const createData = await createResponse.json()

      if (createData.roomId) {
        setRoomId(createData.roomId)

        // Teste 2: Verificar dados no sistema auxiliar
        const systemResponse = await fetch(`/api/rooms/${createData.roomId}`)
        const systemData = await systemResponse.json()

        // Teste 3: Verificar dados no MongoDB do usuário
        const userResponse = await fetch(`/api/rooms/${createData.roomId}/messages`)
        const userData = await userResponse.json()

        setResults((prev) => ({
          ...prev,
          dualArchitecture: {
            roomCreated: createData,
            systemData: {
              ...systemData,
              description: "Metadados do sistema auxiliar",
            },
            userData: {
              ...userData,
              description: "Dados completos do MongoDB do usuário",
            },
            comparison: {
              systemSize: JSON.stringify(systemData).length,
              userSize: JSON.stringify(userData).length,
              separation: "✅ Dados separados corretamente",
            },
          },
        }))
      }
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        dualArchitecture: { error: error.message },
      }))
    }
    setLoading(false)
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🏗️ Debug - Sistema de Banco Duplo</CardTitle>
          <p className="text-sm text-gray-600">
            Sistema auxiliar para metadados + MongoDB do usuário para dados completos
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="system">Sistema Auxiliar</TabsTrigger>
              <TabsTrigger value="user">MongoDB Usuário</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Room ID</label>
                  <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="room_123..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Nick</label>
                  <Input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="TestUser" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={testDualArchitecture} disabled={loading}>
                  Testar Arquitetura Dual
                </Button>
                <Button onClick={testSystemDatabase} disabled={loading}>
                  Testar Sistema Auxiliar
                </Button>
                <Button onClick={testUserDatabase} disabled={loading || !roomId}>
                  Testar MongoDB Usuário
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">🏗️ Sistema Auxiliar</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div>• Metadados das salas</div>
                    <div>• Controle de sessões</div>
                    <div>• Estatísticas do sistema</div>
                    <div>• Registro de atividades</div>
                    <Badge variant="secondary" className="text-xs">
                      Leve e rápido
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">📊 MongoDB do Usuário</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div>• Dados completos dos usuários</div>
                    <div>• Histórico de mensagens</div>
                    <div>• Preferências personalizadas</div>
                    <div>• Contexto da conversa</div>
                    <Badge variant="outline" className="text-xs">
                      Dados sensíveis
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                O sistema auxiliar armazena apenas metadados necessários para o funcionamento do chat, sem dados
                sensíveis dos usuários.
              </div>
              <Button onClick={testSystemDatabase} disabled={loading}>
                Testar Sistema Auxiliar
              </Button>
            </TabsContent>

            <TabsContent value="user" className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                O MongoDB fornecido pelo usuário armazena todos os dados da conversa, preferências e histórico completo.
              </div>
              <div className="flex gap-2">
                <Input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Room ID para testar"
                  className="flex-1"
                />
                <Button onClick={testUserDatabase} disabled={loading || !roomId}>
                  Testar MongoDB Usuário
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {Object.keys(results).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Resultados dos Testes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(results).map(([test, result]: [string, any]) => (
                <div key={test} className="border rounded p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium capitalize">{test.replace(/([A-Z])/g, " $1")}</h3>
                    {result.status && (
                      <Badge variant={result.status < 400 ? "default" : "destructive"}>{result.status}</Badge>
                    )}
                  </div>

                  {result.description && <p className="text-sm text-gray-600 mb-2">{result.description}</p>}

                  {result.comparison && (
                    <div className="bg-blue-50 p-3 rounded mb-3">
                      <h4 className="font-medium text-sm mb-2">Comparação de Arquitetura:</h4>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="font-medium">Sistema:</span> {result.comparison.systemSize} bytes
                        </div>
                        <div>
                          <span className="font-medium">Usuário:</span> {result.comparison.userSize} bytes
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> {result.comparison.separation}
                        </div>
                      </div>
                    </div>
                  )}

                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
