"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, MessageCircle, Users, Plus, X } from "lucide-react";
import type { Conversation, User, Notification } from "@/lib/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatSidebarProps {
    conversations: Conversation[];
    users: User[];
    currentUserId: string;
    selectedConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onSelectUser: (userId: string) => void;
    isCreatingConversation?: boolean;
    isLoading?: boolean;
    usersById: Record<string, User>;
    notifications: Notification[];
}

export function ChatSidebar({
    conversations,
    users,
    currentUserId,
    selectedConversationId,
    onSelectConversation,
    onSelectUser,
    isCreatingConversation,
    isLoading,
    usersById,
    notifications
}: ChatSidebarProps) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);
    const [userSearchQuery, setUserSearchQuery] = React.useState("");

    const filteredConversations = React.useMemo(() => {
        if (!searchQuery) return conversations;
        return conversations.filter(conv => {
            const name = getConversationName(conv);
            return name.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [conversations, searchQuery, currentUserId, usersById]);

    const filteredUsers = React.useMemo(() => {
        if (!userSearchQuery) return users;
        return users.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) && u.id !== currentUserId);
    }, [users, userSearchQuery, currentUserId]);

    function getConversationName(conv: Conversation) {
        if (conv.type === 'group_channel') return conv.name || "Gruppo";
        if (conv.type === 'client_channel') return conv.name?.replace("client-", "") || "Canale Cliente";

        const otherMemberId = conv.memberIds.find(id => id !== currentUserId);
        return otherMemberId ? usersById[otherMemberId]?.name || "Utente sconosciuto" : "Chat";
    }

    function getConversationInitials(conv: Conversation) {
        const name = getConversationName(conv);
        return name.substring(0, 2).toUpperCase();
    }

    function getUnreadCount(conv: Conversation) {
        return notifications.filter(n => n.link?.includes(`conversationId=${conv.id}`) && !n.isRead).length;
    }

    const handleUserSelect = (userId: string) => {
        onSelectUser(userId);
        setIsNewChatOpen(false);
    };

    return (
        <div className="flex flex-col h-full border-r bg-card w-80 flex-shrink-0">
            {/* Header */}
            <div className="p-4 border-b space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Messaggi
                    </h2>
                    <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                        <DialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Nuova Chat</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <Input
                                    placeholder="Cerca utente..."
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                />
                                <ScrollArea className="h-[300px]">
                                    <div className="space-y-2">
                                        {filteredUsers.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => handleUserSelect(user.id)}
                                                className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-md transition-colors text-left"
                                            >
                                                <Avatar>
                                                    <AvatarImage src={user.avatar || undefined} />
                                                    <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{user.name}</p>
                                                    <p className="text-xs text-muted-foreground">{user.role}</p>
                                                </div>
                                            </button>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <p className="text-center text-sm text-muted-foreground py-4">Nessun utente trovato.</p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cerca conversazioni..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="p-4 space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-1/2 bg-muted animate-pulse" />
                                    <div className="h-3 w-3/4 bg-muted animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nessuna conversazione</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredConversations.map((conv) => {
                            const unreadCount = getUnreadCount(conv);
                            const isActive = selectedConversationId === conv.id;

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => onSelectConversation(conv.id)}
                                    className={cn(
                                        "w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center gap-3",
                                        isActive && "bg-muted"
                                    )}
                                >
                                    <Avatar>
                                        <AvatarFallback>{getConversationInitials(conv)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className="font-medium truncate">{getConversationName(conv)}</p>
                                            {unreadCount > 0 && (
                                                <Badge variant="destructive" className="ml-2 h-5 w-5 flex items-center justify-center p-0 rounded-full text-xs">
                                                    {unreadCount}
                                                </Badge>
                                            )}
                                        </div>
                                        {conv.lastMessage && (
                                            <p className="text-sm text-muted-foreground truncate">
                                                {conv.lastMessage.userId === currentUserId && "Tu: "}{conv.lastMessage.text}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ChatSidebar;
