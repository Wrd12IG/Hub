import * as React from "react"
import { Cross2Icon } from "@radix-ui/react-icons"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Viewport>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Viewport
        ref={ref}
        className={cn(
            "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
            className
        )}
        {...props}
    />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
    "group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-4 pr-8 shadow-xl transition-all backdrop-blur-sm data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
    {
        variants: {
            variant: {
                default: "border bg-background/95 text-foreground shadow-lg",
                destructive: "border-destructive/50 bg-destructive/95 text-destructive-foreground shadow-destructive/20",
                success: "border-green-200 dark:border-green-800 bg-green-50/95 dark:bg-green-950/95 text-green-800 dark:text-green-200 shadow-green-500/10",
                warning: "border-amber-200 dark:border-amber-800 bg-amber-50/95 dark:bg-amber-950/95 text-amber-800 dark:text-amber-200 shadow-amber-500/10",
                info: "border-blue-200 dark:border-blue-800 bg-blue-50/95 dark:bg-blue-950/95 text-blue-800 dark:text-blue-200 shadow-blue-500/10",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

// Icon component based on variant
const ToastIcon = ({ variant }: { variant?: "default" | "destructive" | "success" | "warning" | "info" | null }) => {
    const iconClasses = "h-5 w-5 shrink-0"

    switch (variant) {
        case "success":
            return (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                    <CheckCircle2 className={cn(iconClasses, "text-green-600 dark:text-green-400")} />
                </div>
            )
        case "destructive":
            return (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                    <AlertCircle className={cn(iconClasses, "text-red-600 dark:text-red-400")} />
                </div>
            )
        case "warning":
            return (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
                    <AlertTriangle className={cn(iconClasses, "text-amber-600 dark:text-amber-400")} />
                </div>
            )
        case "info":
            return (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
                    <Info className={cn(iconClasses, "text-blue-600 dark:text-blue-400")} />
                </div>
            )
        default:
            return null
    }
}

const Toast = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, children, ...props }, ref) => {
    return (
        <ToastPrimitives.Root
            ref={ref}
            className={cn(toastVariants({ variant }), className)}
            {...props}
        >
            <ToastIcon variant={variant} />
            <div className="flex-1 space-y-1">
                {children}
            </div>
        </ToastPrimitives.Root>
    )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Action>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Action
        ref={ref}
        className={cn(
            "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border bg-transparent px-3 text-sm font-medium transition-all hover:bg-secondary hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            "group-[.success]:border-green-300 group-[.success]:hover:bg-green-100 dark:group-[.success]:border-green-700 dark:group-[.success]:hover:bg-green-900",
            "group-[.warning]:border-amber-300 group-[.warning]:hover:bg-amber-100 dark:group-[.warning]:border-amber-700 dark:group-[.warning]:hover:bg-amber-900",
            "group-[.info]:border-blue-300 group-[.info]:hover:bg-blue-100 dark:group-[.info]:border-blue-700 dark:group-[.info]:hover:bg-blue-900",
            "group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
            className
        )}
        {...props}
    />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Close>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Close
        ref={ref}
        className={cn(
            "absolute right-2 top-2 rounded-full p-1.5 opacity-60 transition-all hover:opacity-100 hover:bg-foreground/10 focus:outline-none focus:ring-2 focus:ring-ring",
            "group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:hover:bg-red-800",
            "group-[.success]:hover:bg-green-200 dark:group-[.success]:hover:bg-green-800",
            "group-[.warning]:hover:bg-amber-200 dark:group-[.warning]:hover:bg-amber-800",
            "group-[.info]:hover:bg-blue-200 dark:group-[.info]:hover:bg-blue-800",
            className
        )}
        toast-close=""
        {...props}
    >
        <X className="h-4 w-4" />
    </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Title>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Title
        ref={ref}
        className={cn("text-sm font-semibold leading-tight", className)}
        {...props}
    />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Description>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Description
        ref={ref}
        className={cn("text-sm opacity-80 leading-snug", className)}
        {...props}
    />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
    type ToastProps,
    type ToastActionElement,
    ToastProvider,
    ToastViewport,
    Toast,
    ToastTitle,
    ToastDescription,
    ToastClose,
    ToastAction,
}
