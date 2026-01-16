"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SidebarContextType {
    isOpen: boolean
    setOpen: (open: boolean) => void
    toggle: () => void
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children, defaultOpen = false }: { children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = React.useState(defaultOpen)

    const setOpen = React.useCallback((open: boolean) => {
        setIsOpen(open)
    }, [])

    const toggle = React.useCallback(() => {
        setIsOpen((prev) => !prev)
    }, [])

    return (
        <SidebarContext.Provider value={{ isOpen, setOpen, toggle }}>
            <div data-state={isOpen ? 'expanded' : 'collapsed'} className="group">
                {children}
            </div>
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    const context = React.useContext(SidebarContext)
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider")
    }
    return context
}

export const Sidebar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const { isOpen } = useSidebar()

    return (
        <div
            ref={ref}
            className={cn(
                "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] bg-sidebar border-r border-sidebar-border flex flex-col h-full z-50 relative",
                isOpen ? 'w-64' : 'w-[72px]',
                className
            )}
            data-state={isOpen ? 'expanded' : 'collapsed'}
            {...props}
        >
            {children}
        </div>
    )
})
Sidebar.displayName = "Sidebar"

export const SidebarContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col flex-1 overflow-y-auto overflow-x-hidden py-2", className)} {...props} />
))
SidebarContent.displayName = "SidebarContent"

export const SidebarHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-3 flex-shrink-0", className)} {...props} />
))
SidebarHeader.displayName = "SidebarHeader"

export const SidebarFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-2 mt-auto flex-shrink-0", className)} {...props} />
))
SidebarFooter.displayName = "SidebarFooter"

export const SidebarTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
    const { toggle, isOpen } = useSidebar()

    return (
        <button
            ref={ref}
            onClick={toggle}
            className={cn(
                "p-2.5 hover:bg-primary/10 rounded-xl transition-all duration-300 text-muted-foreground hover:text-primary",
                className
            )}
            title={isOpen ? "Comprimi sidebar" : "Espandi sidebar"}
            {...props}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                    "transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    !isOpen && 'rotate-180'
                )}
            >
                <polyline points="15 18 9 12 15 6" />
            </svg>
        </button>
    )
})
SidebarTrigger.displayName = "SidebarTrigger"

export const SidebarInset = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-auto", className)} {...props} />
))
SidebarInset.displayName = "SidebarInset"

export const SidebarMenu = React.forwardRef<
    HTMLUListElement,
    React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("space-y-1 px-3", className)} {...props} />
))
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<
    HTMLLIElement,
    React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
    <li ref={ref} className={cn("relative", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isActive?: boolean
    tooltip?: string
}

export const SidebarMenuButton = React.forwardRef<
    HTMLButtonElement,
    SidebarMenuButtonProps
>(({ className, isActive, tooltip, children, ...props }, ref) => {
    const { isOpen } = useSidebar()
    const [showTooltip, setShowTooltip] = React.useState(false)
    const [tooltipPos, setTooltipPos] = React.useState({ top: 0, left: 0, height: 0, width: 0 })
    const buttonRef = React.useRef<HTMLButtonElement>(null)

    const handleMouseEnter = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setTooltipPos({
                top: rect.top,
                left: rect.left, // Start from button left
                height: rect.height,
                width: rect.width
            })
            setShowTooltip(true)
        }
    }

    return (
        <>
            <button
                ref={(node) => {
                    // Handle both refs
                    (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
                    if (typeof ref === 'function') ref(node)
                    else if (ref) ref.current = node
                }}
                className={cn(
                    "w-full text-left rounded-xl flex items-center gap-3 relative",
                    "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    isOpen ? 'px-3 py-2.5' : 'p-2.5 justify-center',
                    isActive
                        ? 'bg-sidebar-primary/15 text-sidebar-primary font-medium shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    className
                )}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShowTooltip(false)}
                {...props}
            >
                {children}
            </button>

            {/* Seamless tooltip - covers button and extends with label */}
            {!isOpen && tooltip && showTooltip && (
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        top: tooltipPos.top,
                        left: tooltipPos.left,
                        height: tooltipPos.height
                    }}
                >
                    <div
                        className={cn(
                            "h-full flex items-center gap-3",
                            "rounded-xl text-sm font-medium whitespace-nowrap",
                            "bg-sidebar-primary text-sidebar-primary-foreground",
                            "shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
                        )}
                        style={{ paddingLeft: tooltipPos.width / 2 - 10, paddingRight: 16 }}
                    >
                        {tooltip}
                    </div>
                </div>
            )}
        </>
    )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

export const SidebarGroup = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("py-2", className)} {...props} />
))
SidebarGroup.displayName = "SidebarGroup"

export const SidebarGroupLabel = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
    const { isOpen } = useSidebar()

    return (
        <div
            ref={ref}
            className={cn(
                "px-3 mb-1 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider",
                "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                !isOpen && "opacity-0 h-0 mb-0 overflow-hidden",
                className
            )}
            {...props}
        />
    )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

export const SidebarGroupContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={className} {...props} />
))
SidebarGroupContent.displayName = "SidebarGroupContent"
