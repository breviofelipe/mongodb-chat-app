"use client"

import { useState, useCallback } from "react"
import type { AlertType } from "@/components/ui/alert-modal"

interface AlertConfig {
  type: AlertType
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  onConfirm?: () => void
}

export function useAlertModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<AlertConfig>({
    type: "info",
    title: "",
    message: "",
  })

  const showAlert = useCallback((alertConfig: AlertConfig) => {
    setConfig(alertConfig)
    setIsOpen(true)
  }, [])

  const showSuccess = useCallback(
    (title: string, message: string, onConfirm?: () => void) => {
      showAlert({
        type: "success",
        title,
        message,
        confirmText: "OK",
        onConfirm,
      })
    },
    [showAlert],
  )

  const showError = useCallback(
    (title: string, message: string, onConfirm?: () => void) => {
      showAlert({
        type: "error",
        title,
        message,
        confirmText: "OK",
        onConfirm,
      })
    },
    [showAlert],
  )

  const showWarning = useCallback(
    (title: string, message: string, onConfirm?: () => void) => {
      showAlert({
        type: "warning",
        title,
        message,
        confirmText: "OK",
        onConfirm,
      })
    },
    [showAlert],
  )

  const showInfo = useCallback(
    (title: string, message: string, onConfirm?: () => void) => {
      showAlert({
        type: "info",
        title,
        message,
        confirmText: "OK",
        onConfirm,
      })
    },
    [showAlert],
  )

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, confirmText = "Confirmar", cancelText = "Cancelar") => {
      showAlert({
        type: "confirm",
        title,
        message,
        confirmText,
        cancelText,
        showCancel: true,
        onConfirm,
      })
    },
    [showAlert],
  )

  const closeAlert = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    config,
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    closeAlert,
  }
}
