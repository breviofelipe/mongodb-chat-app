#!/usr/bin/env node

const { spawn } = require("child_process")
const path = require("path")

console.log("🚀 Iniciando servidor WebSocket seguro...")

// Caminho para o arquivo do servidor WebSocket
const serverPath = path.join(__dirname, "..", "lib", "websocket-server.ts")

// Usar ts-node para executar TypeScript diretamente
const server = spawn("npx", ["ts-node", serverPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "development",
    WS_PORT: process.env.WS_PORT || "8443",
    MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017",
  },
})

server.on("error", (error) => {
  console.error("❌ Erro ao iniciar servidor WebSocket:", error)
  process.exit(1)
})

server.on("close", (code) => {
  console.log(`🔌 Servidor WebSocket encerrado com código ${code}`)
  process.exit(code)
})

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Encerrando servidor WebSocket...")
  server.kill("SIGINT")
})

process.on("SIGTERM", () => {
  console.log("\n🛑 Encerrando servidor WebSocket...")
  server.kill("SIGTERM")
})
