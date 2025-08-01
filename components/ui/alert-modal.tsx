"use client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CheckCircle, AlertTriangle, XCircle, Info, AlertCircle } from "lucide-react"

export type AlertType = "success" | "error" | "warning" | "info" | "confirm"

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  type: AlertType
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

const alertIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  confirm: AlertCircle,
}

const alertColors = {
  success: "text-green-600 dark:text-green-400",
  error: "text-red-600 dark:text-red-400",
  warning: "text-orange-600 dark:text-orange-400",
  info: "text-blue-600 dark:text-blue-400",
  confirm: "text-blue-600 dark:text-blue-400",
}

export function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  type,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancelar",
  showCancel = false,
}: AlertModalProps) {
  const Icon = alertIcons[type]
  const iconColor = alertColors[type]

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    onClose()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            <Icon className={`w-6 h-6 ${iconColor}`} />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-relaxed pt-2">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          {showCancel && <AlertDialogCancel className="w-full sm:w-auto">{cancelText}</AlertDialogCancel>}
          <AlertDialogAction
            onClick={handleConfirm}
            className={`w-full sm:w-auto ${
              type === "error"
                ? "bg-red-600 hover:bg-red-700"
                : type === "warning"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : type === "success"
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
            }`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
