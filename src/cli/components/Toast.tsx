/**
 * Toast Notification Component
 * Shows temporary notification messages in the CLI
 */

import React from "react";
import { Box, Text } from "ink";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose?: () => void;
}

const iconMap: Record<ToastType, string> = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
};

const colorMap: Record<ToastType, string> = {
    success: "green",
    error: "red",
    warning: "yellow",
    info: "cyan",
};

export function Toast({
    message,
    type = "info",
    duration = 3000,
    onClose,
}: ToastProps) {
    const [visible, setVisible] = React.useState(true);

    React.useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setVisible(false);
                onClose?.();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    if (!visible) return null;

    const icon = iconMap[type];
    const color = colorMap[type];

    return (
        <Box
            borderStyle="round"
            borderColor={color as any}
            paddingX={1}
            paddingY={0}
        >
            <Text>
                {icon} <Text bold color={color as any}>{message}</Text>
            </Text>
        </Box>
    );
}

/**
 * Toast Container Component
 * Manages multiple toast notifications
 */

export interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContainerProps {
    toasts: ToastItem[];
    onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
    return (
        <Box flexDirection="column">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onClose={() => onRemove(toast.id)}
                />
            ))}
        </Box>
    );
}

/**
 * Toast Manager Hook
 * Provides functions to show and manage toasts
 */
export function useToast() {
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);

    const addToast = React.useCallback(
        (message: string, type: ToastType = "info", duration = 3000) => {
            const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            setToasts((prev) => [...prev, { id, message, type, duration }]);
            return id;
        },
        [],
    );

    const removeToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const success = React.useCallback(
        (message: string, duration?: number) => addToast(message, "success", duration),
        [addToast],
    );

    const error = React.useCallback(
        (message: string, duration?: number) => addToast(message, "error", duration),
        [addToast],
    );

    const warning = React.useCallback(
        (message: string, duration?: number) => addToast(message, "warning", duration),
        [addToast],
    );

    const info = React.useCallback(
        (message: string, duration?: number) => addToast(message, "info", duration),
        [addToast],
    );

    return {
        toasts,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
    };
}