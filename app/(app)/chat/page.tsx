'use client';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient, QueryClient, QueryClientProvider, type UseMutationResult } from '@tanstack/react-query';
import {
  sendMessage,
  markNotificationsAsRead,
  toggleMessageReaction,
  createOrGetDirectConversation,
  createGroupConversation,
  createClientChannel,
  deleteConversation,
  deleteMessage,
  editMessage,
} from '@/lib/actions';
import type { User, Conversation, Message, Attachment, Notification } from '@/lib/data';
import { toast } from 'sonner';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2, MessageSquare, Plus, Paperclip, File as FileIcon, X, Smile,
  MessageCircleReply, Send, Check, CheckCheck, Search, MoreVertical,
  Phone, Video, Image as ImageIcon, Users, User as UserIcon, Building2,
  Trash2, Edit2, MoreHorizontal
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatSidebar from '@/components/ChatSidebar';
import { Suspense } from 'react';
import { getFirestore, collection, query, onSnapshot, orderBy, where, doc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import dynamic from 'next/dynamic';
import type { EmojiClickData } from 'emoji-picker-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '@/lib/firebase';
import { useLayoutData } from '@/app/(app)/layout-context';
import { ThreadView } from '@/components/thread-view';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { playSound } from '@/lib/sounds';


const EmojiPicker = dynamic(() => import('emoji-picker-react').then(mod => mod.default), { ssr: false });

// Helper to safely parse timestamps (handles Firestore Timestamp, string, or Date)
function parseTimestamp(timestamp: any): Date | null {
  if (!timestamp) return null;
  try {
    // Firestore Timestamp object
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    // Already a Date
    if (timestamp instanceof Date) {
      return timestamp;
    }
    // String or number
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

// Format time safely
function formatTime(timestamp: any): string {
  const date = parseTimestamp(timestamp);
  if (!date) return '';
  return format(date, 'HH:mm');
}

// WhatsApp-style date separator
function DateSeparator({ date }: { date: Date }) {
  let label = format(date, 'd MMMM yyyy', { locale: it });
  if (isToday(date)) label = 'OGGI';
  else if (isYesterday(date)) label = 'IERI';

  return (
    <div className="flex justify-center my-4">
      <span className="bg-[#e1f2fb] dark:bg-slate-700 text-[#54656f] dark:text-slate-300 text-xs px-3 py-1 rounded-lg shadow-sm font-medium">
        {label}
      </span>
    </div>
  );
}

// WhatsApp-style message bubble
function MessageBubble({
  message,
  isCurrentUser,
  sender,
  showAvatar,
  isFirstInGroup,
  isLastInGroup,
  onReply,
  onReaction,
  onDelete,
  onEdit
}: {
  message: Message;
  isCurrentUser: boolean;
  sender?: User;
  showAvatar: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onReply: () => void;
  onReaction: (emoji: string) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const time = formatTime(message.timestamp);

  // Read receipt logic
  // If readBy has entries (excluding current user if they happen to be in there, though usually not), it's read by someone
  const isRead = message.readBy && message.readBy.length > 0;
  // Firestore messages are always "Delivered" (2 ticks) if present here.
  // We use CheckCheck gray for Delivered, CheckCheck green for Read.
  // One Check gray (Sent) is transient in optimistic UI, but here we view DB state.

  const StatusIcon = isRead ? CheckCheck : CheckCheck;
  const statusColor = isRead ? "text-[#53bdeb]" : "text-[#667781] dark:text-[#8696a0]"; // WhatsApp blue/green for read
  // Adjust: User asked for Green for read. WhatsApp uses Blue. I'll use Green as requested or Blue as standard?
  // User asked: "due spunte verdi letto". OK Green.
  const statusClassName = isRead ? "text-green-500" : "text-[#667781] dark:text-[#8696a0]";

  // Deleted message handling
  if (message.deleted) {
    return (
      <div className={cn(
        "flex items-end gap-1 group",
        isCurrentUser ? "justify-end" : "justify-start",
        !isLastInGroup && "mb-[2px]",
        isLastInGroup && "mb-2"
      )}>
        <div className={cn(
          "px-3 py-2 rounded-lg text-sm italic text-muted-foreground bg-black/5 dark:bg-white/5",
          isCurrentUser ? "rounded-tr-none" : "rounded-tl-none"
        )}>
          🚫 {message.text}
        </div>
      </div>
    );
  }
  const imageAttachments = message.attachments?.filter(att =>
    att.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || att.type?.startsWith('image/')
  ) || [];
  const otherAttachments = message.attachments?.filter(att =>
    !att.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !att.type?.startsWith('image/')
  ) || [];

  return (
    <div
      className={cn(
        "flex items-end gap-1 group",
        isCurrentUser ? "justify-end" : "justify-start",
        !isLastInGroup && "mb-[2px]",
        isLastInGroup && "mb-2"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar placeholder for alignment */}
      {!isCurrentUser && (
        <div className="w-8 flex-shrink-0">
          {showAvatar && sender && (
            <Avatar className="h-8 w-8">
              <AvatarFallback
                style={{ backgroundColor: sender.color || '#25D366' }}
                className="text-white text-xs"
              >
                {sender.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          "relative max-w-[65%] min-w-[80px] shadow-sm",
          isCurrentUser
            ? "bg-[#d9fdd3] dark:bg-[#005c4b]"
            : "bg-white dark:bg-[#202c33]",
          // Rounded corners based on position in group
          isFirstInGroup && isLastInGroup && (isCurrentUser ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"),
          isFirstInGroup && !isLastInGroup && (isCurrentUser ? "rounded-t-2xl rounded-l-2xl rounded-br-md" : "rounded-t-2xl rounded-r-2xl rounded-bl-md"),
          !isFirstInGroup && isLastInGroup && (isCurrentUser ? "rounded-b-2xl rounded-l-2xl rounded-tr-md" : "rounded-b-2xl rounded-r-2xl rounded-tl-md"),
          !isFirstInGroup && !isLastInGroup && (isCurrentUser ? "rounded-l-2xl rounded-r-md" : "rounded-r-2xl rounded-l-md"),
        )}
      >
        {/* Tail */}
        {isLastInGroup && (
          <div
            className={cn(
              "absolute bottom-0 w-3 h-3",
              isCurrentUser
                ? "-right-1.5 bg-[#d9fdd3] dark:bg-[#005c4b]"
                : "-left-1.5 bg-white dark:bg-[#202c33]"
            )}
            style={{
              clipPath: isCurrentUser
                ? 'polygon(0 0, 0% 100%, 100% 100%)'
                : 'polygon(100% 0, 0% 100%, 100% 100%)'
            }}
          />
        )}

        <div className="px-2 pt-1.5 pb-1">
          {/* Sender name for group chats */}
          {!isCurrentUser && isFirstInGroup && sender && (
            <p className="text-xs font-semibold mb-0.5" style={{ color: sender.color || '#25D366' }}>
              {sender.name.split(' ')[0]}
            </p>
          )}

          {/* Quoted Message (Reply) */}
          {message.replyTo && (
            <div className="mb-1 rounded-md bg-black/5 dark:bg-white/5 border-l-4 border-[#25d366] p-2 bg-opacity-50">
              <p className="text-xs font-bold text-[#25d366] mb-0.5">{message.replyTo.username || 'Utente'}</p>
              <p className="text-xs text-[#111b21] dark:text-[#e9edef] truncate line-clamp-2 opacity-80">{message.replyTo.text}</p>
            </div>
          )}

          {/* Image attachments */}
          {imageAttachments.length > 0 && (
            <div className="mb-1 -mx-1 -mt-0.5 rounded-lg overflow-hidden">
              {imageAttachments.map((att, index) => (
                <a href={att.url} key={index} target="_blank" rel="noopener noreferrer">
                  <img
                    src={att.url}
                    alt={att.filename}
                    className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Message text */}
          {message.text && (
            <p className="text-sm text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap break-words pr-14">
              {message.text}
            </p>
          )}

          {/* Other attachments */}
          {otherAttachments.length > 0 && (
            <div className="mt-1 space-y-1">
              {otherAttachments.map((att, index) => (
                <a
                  href={att.url}
                  key={index}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                >
                  <FileIcon className="h-4 w-4 text-[#54656f]" />
                  <span className="text-sm truncate">{att.filename}</span>
                </a>
              ))}
            </div>
          )}

          {/* Time and status */}
          <div className={cn(
            "flex items-center gap-1 justify-end mt-1",
            message.text ? "" : ""
          )}>
            {message.isEdited && <span className="text-[10px] text-[#667781] dark:text-[#8696a0] italic mr-1">modificato</span>}
            <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">
              {time}
            </span>
            {isCurrentUser && (
              <StatusIcon className={cn("h-4 w-4", statusClassName)} />
            )}
          </div>

          {/* Reactions */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 -mb-0.5">
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => onReaction(emoji)}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-xs hover:bg-black/10 dark:hover:bg-white/20 transition"
                >
                  <span>{emoji}</span>
                  {(users as string[]).length > 1 && <span className="text-[10px]">{(users as string[]).length}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions (visible on hover) */}
      <div className={cn(
        "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
        isCurrentUser ? "order-first mr-1" : "ml-1"
      )}>
        <Popover>
          <PopoverTrigger asChild>
            <button className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
              <Smile className="h-4 w-4 text-[#54656f]" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1 border-0" side="top">
            <div className="flex gap-1">
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                <button
                  key={emoji}
                  className="p-1.5 hover:bg-black/5 rounded-full transition text-lg"
                  onClick={() => onReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <button
          className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
          onClick={onReply}
          title="Rispondi"
        >
          <MessageCircleReply className="h-4 w-4 text-[#54656f]" />
        </button>

        {isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition">
                <MoreVertical className="h-4 w-4 text-[#54656f]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isCurrentUser ? "end" : "start"}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit2 className="h-3 w-3 mr-2" /> Modifica
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">
                <Trash2 className="h-3 w-3 mr-2" /> Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function ChatPageContent({ queryClient }: { queryClient: QueryClient }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, users, notifications, isLoadingLayout, usersById, clients, soundSettings } = useLayoutData();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');


  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentThread, setCurrentThread] = useState<Message | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatUserSearch, setNewChatUserSearch] = useState('');

  // Group creation state
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Client channel creation state
  const [showClientChannelDialog, setShowClientChannelDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedChannelMembers, setSelectedChannelMembers] = useState<string[]>([]);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null); // State for quoting messages
  const [editingMessage, setEditingMessage] = useState<Message | null>(null); // State for editing

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    const qConversations = query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', currentUser.id)
    );
    const unsubConversations = onSnapshot(qConversations, (snapshot) => {
      const updatedConversations = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Conversation);
      updatedConversations.sort((a, b) => {
        const timeA = parseTimestamp(a.lastMessage?.timestamp)?.getTime() || 0;
        const timeB = parseTimestamp(b.lastMessage?.timestamp)?.getTime() || 0;
        return timeB - timeA;
      });
      setConversations(updatedConversations);
    }, (error) => console.error("Error fetching conversations:", error));

    return () => unsubConversations();
  }, [currentUser?.id, db]);

  const selectedConversation = useMemo(() => {
    return conversations?.find(c => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  const markAsReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) => markNotificationsAsRead(currentUser!.id, notificationIds),
    onSuccess: () => { },
    onError: (error) => {
      console.error("Failed to mark notifications as read", error);
      toast.error("Errore nell'aggiornare le notifiche.");
    },
    onMutate: () => {
      if (!currentUser) throw new Error("User not authenticated");
    }
  });

  const handleConversationSelect = (conversationId: string | null) => {
    if (!currentUser) return;
    if (!conversationId) {
      setSelectedConversationId(null);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('conversationId');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
      return;
    }
    setSelectedConversationId(conversationId);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('conversationId', conversationId);
    router.replace(newUrl.pathname + newUrl.search, { scroll: false });

    const unreadNotifications = notifications.filter(
      n => n.type === 'chat_message' && n.resourceId === conversationId && !n.readAt
    );
    if (unreadNotifications.length > 0) {
      markAsReadMutation.mutate(unreadNotifications.map(n => n.id));
    }
  };

  const createDirectConversationMutation = useMutation({
    mutationFn: (otherUserId: string) => createOrGetDirectConversation(currentUser!.id, otherUserId),
    onSuccess: (newConversationId: string) => {
      toast.success('Conversazione creata!');
      handleConversationSelect(newConversationId);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('conversationId', newConversationId);
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    },
    onError: (error) => {
      console.error("Failed to create/get conversation", error);
      toast.error('Errore nella creazione della conversazione.');
    },
    onMutate: () => {
      if (!currentUser) throw new Error("User not authenticated");
    }
  });

  const handleSelectUser = (userId: string) => {
    createDirectConversationMutation.mutate(userId);
  };

  // Create a group conversation
  const handleCreateGroup = async () => {
    if (!currentUser || !groupName.trim() || selectedGroupMembers.length === 0) {
      toast.error('Inserisci un nome e seleziona almeno un membro');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const conversationId = await createGroupConversation(
        groupName.trim(),
        selectedGroupMembers,
        currentUser.id
      );
      toast.success('Gruppo creato!');
      handleConversationSelect(conversationId);
      setShowGroupDialog(false);
      setGroupName('');
      setSelectedGroupMembers([]);
    } catch (error) {
      console.error('Failed to create group', error);
      toast.error('Errore nella creazione del gruppo');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Create a client channel
  const handleCreateClientChannel = async () => {
    if (!currentUser || !selectedClientId) {
      toast.error('Seleziona un cliente');
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    setIsCreatingChannel(true);
    try {
      const conversationId = await createClientChannel(
        selectedClientId,
        client.name,
        selectedChannelMembers,
        currentUser.id
      );
      toast.success(`Canale ${client.name} creato!`);
      handleConversationSelect(conversationId);
      setShowClientChannelDialog(false);
      setSelectedClientId(null);
      setSelectedChannelMembers([]);
    } catch (error) {
      console.error('Failed to create client channel', error);
      toast.error('Errore nella creazione del canale');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  useEffect(() => {
    const convId = searchParams.get('conversationId');
    if (convId && !selectedConversationId) {
      setSelectedConversationId(convId);
    }
  }, [searchParams, selectedConversationId]);

  // Ref to track if this is initial messages load (don't play sound on first load)
  const isInitialMessagesLoadRef = useRef<boolean>(true);
  const prevMessagesCountRef = useRef<number>(0);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      isInitialMessagesLoadRef.current = true;
      prevMessagesCountRef.current = 0;
      return;
    }
    setIsLoadingMessages(true);
    const qMessages = query(
      collection(db, 'conversations', selectedConversationId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Message);

      // Play sound for new incoming messages (not on initial load, not from current user)
      if (!isInitialMessagesLoadRef.current && soundSettings.enabled && soundSettings.messageSound) {
        if (fetchedMessages.length > prevMessagesCountRef.current) {
          // Get the last message
          const lastMessage = fetchedMessages[fetchedMessages.length - 1];
          // Only play sound if it's from someone else
          if (lastMessage && lastMessage.userId !== currentUser?.id) {
            playSound('message', soundSettings.volume);
          }
        }
      }

      prevMessagesCountRef.current = fetchedMessages.length;
      isInitialMessagesLoadRef.current = false;

      setMessages(fetchedMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      setIsLoadingMessages(false);
    });
    return () => unsubMessages();
  }, [selectedConversationId, db, soundSettings.enabled, soundSettings.messageSound, soundSettings.volume, currentUser?.id]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: ({ text, attachments, replyTo }: { text: string; attachments: Attachment[]; replyTo?: any }) =>
      sendMessage(selectedConversationId!, text, currentUser!.id, attachments, replyTo),
    onSuccess: () => {
      setMessageText('');
      setFilesToUpload([]);
      setReplyingTo(null); // Clear reply state
    },
    onError: (error) => {
      console.error("Failed to send message", error);
      toast.error("Errore nell'invio del messaggio.");
    },
    onMutate: () => {
      if (!currentUser || !selectedConversationId) throw new Error("User not authenticated or no conversation selected");
    }
  });

  const toggleReactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string, emoji: string }) =>
      toggleMessageReaction(selectedConversationId!, messageId, emoji, currentUser!.id),
    onError: (error) => {
      console.error("Failed to toggle reaction", error);
      toast.error("Errore nella reazione.");
    },
    onMutate: () => {
      if (!currentUser || !selectedConversationId) throw new Error("User not authenticated or no conversation selected");
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => deleteConversation(conversationId),
    onSuccess: () => {
      toast.success('Chat eliminata');
      setSelectedConversationId(null);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('conversationId');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    },
    onError: (error) => {
      console.error("Failed to delete conversation", error);
      toast.error('Errore durante l\'eliminazione della chat');
    }
  });

  const handleDeleteConversation = () => {
    if (!selectedConversationId) return;
    if (confirm('Sei sicuro di voler eliminare questa chat? Questa azione è irreversibile per tutti i partecipanti.')) {
      deleteConversationMutation.mutate(selectedConversationId);
    }
  };

  const deleteMessageMutation = useMutation({
    mutationFn: ({ messageId }: { messageId: string }) => deleteMessage(selectedConversationId!, messageId, currentUser!.id),
    onSuccess: () => toast.success("Messaggio eliminato"),
    onError: () => toast.error("Errore eliminazione")
  });

  const editMessageMutation = useMutation({
    mutationFn: ({ messageId, newText }: { messageId: string, newText: string }) => editMessage(selectedConversationId!, messageId, newText, currentUser!.id),
    onSuccess: () => {
      setEditingMessage(null);
      setMessageText("");
      toast.success("Messaggio modificato");
    },
    onError: () => toast.error("Errore modifica")
  });

  const handleSendMessage = async () => {
    if ((!messageText.trim() && filesToUpload.length === 0) || !selectedConversationId) return;

    let uploadedAttachments: Attachment[] = [];
    if (filesToUpload.length > 0) {
      setIsUploading(true);
      try {
        const storage = getStorage();
        for (const file of filesToUpload) {
          const storageRef = ref(storage, `chat_attachments/${selectedConversationId}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          uploadedAttachments.push({
            filename: file.name,
            url,
            type: file.type,
            size: file.size,
            date: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error("File upload failed", error);
        toast.error("Errore nel caricamento del file.");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // Prepare reply data if quoting
    let replyData = undefined;
    if (replyingTo && !editingMessage) {
      const replyUser = replyingTo.userId ? usersById[replyingTo.userId] : undefined;
      replyData = {
        id: replyingTo.id,
        text: replyingTo.text,
        senderId: replyingTo.userId || replyingTo.senderId,
        username: replyUser?.name || 'Utente'
      };
    }

    if (editingMessage) {
      editMessageMutation.mutate({ messageId: editingMessage.id, newText: messageText.trim() });
    } else {
      sendMessageMutation.mutate({
        text: messageText.trim(),
        attachments: uploadedAttachments,
        replyTo: replyData
      });
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessageText(prev => prev + emojiData.emoji);
  };

  const onReactionClick = (messageId: string, emoji: string) => {
    toggleReactionMutation.mutate({ messageId, emoji });
  };

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.type === 'group_channel') return 'Gruppo';
    const otherMemberId = conv.memberIds.find(id => id !== currentUser?.id);
    const otherUser = otherMemberId ? usersById[otherMemberId] : undefined;
    if (!otherUser) return 'Chat';
    return otherUser.name;
  };

  const getOtherUser = (conv: Conversation): User | undefined => {
    if (conv.type === 'group_channel') return undefined;
    const otherMemberId = conv.memberIds.find(id => id !== currentUser?.id);
    return otherMemberId ? usersById[otherMemberId] : undefined;
  };

  // Group messages by date and sender for cleaner display
  const groupedMessages = useMemo(() => {
    const groups: { date: Date; messages: (Message & { isFirstInGroup: boolean; isLastInGroup: boolean; showAvatar: boolean })[] }[] = [];
    let currentDate: Date | null = null;
    let currentSenderId: string | null = null;

    messages.forEach((msg, index) => {
      const msgDate = parseTimestamp(msg.timestamp) || new Date();
      const nextMsg = messages[index + 1];
      const prevMsg = messages[index - 1];

      // Check if we need a new date group
      if (!currentDate || !isSameDay(currentDate, msgDate)) {
        currentDate = msgDate;
        currentSenderId = null;
        groups.push({ date: msgDate, messages: [] });
      }

      const isFirstInGroup = msg.userId !== currentSenderId;
      const isLastInGroup = !nextMsg ||
        nextMsg.userId !== msg.userId ||
        (nextMsg.timestamp && parseTimestamp(nextMsg.timestamp) && !isSameDay(parseTimestamp(nextMsg.timestamp)!, msgDate));

      currentSenderId = msg.userId || null;

      groups[groups.length - 1].messages.push({
        ...msg,
        isFirstInGroup: Boolean(isFirstInGroup),
        isLastInGroup: Boolean(isLastInGroup),
        showAvatar: Boolean(isLastInGroup) && msg.userId !== currentUser?.id
      });
    });

    return groups;
  }, [messages, currentUser?.id]);


  return (
    <div className="flex h-full flex-1 bg-[#f0f2f5] dark:bg-[#111b21]">
      {/* Sidebar */}
      <div className="w-[350px] flex-shrink-0 border-r border-[#e9edef] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex flex-col">
        {/* Sidebar Header */}
        <div className="h-14 px-4 flex items-center justify-between bg-[#f0f2f5] dark:bg-[#202c33]">
          <div className="flex items-center gap-3">
            {currentUser && (
              <Avatar className="h-10 w-10">
                <AvatarFallback style={{ backgroundColor: currentUser.color || '#25D366' }} className="text-white">
                  {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] hover:bg-[#e9edef] dark:hover:bg-[#374248]">
                  <Plus className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                <button
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left rounded-md hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] transition"
                  onClick={() => setShowNewChatDialog(true)}
                >
                  <UserIcon className="h-4 w-4 text-[#54656f]" />
                  <span>Nuova chat diretta</span>
                </button>
                <button
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left rounded-md hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] transition"
                  onClick={() => setShowGroupDialog(true)}
                >
                  <Users className="h-4 w-4 text-[#54656f]" />
                  <span>Nuovo gruppo</span>
                </button>
                <button
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left rounded-md hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] transition"
                  onClick={() => setShowClientChannelDialog(true)}
                >
                  <Building2 className="h-4 w-4 text-[#54656f]" />
                  <span>Chat cliente</span>
                </button>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="rounded-full text-[#54656f] hover:bg-[#e9edef] dark:hover:bg-[#374248]">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 bg-white dark:bg-[#111b21]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#54656f]" />
            <Input
              placeholder="Cerca o inizia una nuova chat"
              className="pl-10 bg-[#f0f2f5] dark:bg-[#202c33] border-0 rounded-lg h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations
            .filter(conv => {
              if (!searchQuery) return true;
              const name = getConversationDisplayName(conv).toLowerCase();
              return name.includes(searchQuery.toLowerCase());
            })
            .map(conv => {
              const otherUser = getOtherUser(conv);
              const unreadCount = notifications.filter(
                n => n.type === 'chat_message' && n.resourceId === conv.id && !n.readAt
              ).length;
              const isSelected = selectedConversationId === conv.id;

              return (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors",
                    isSelected
                      ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
                      : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                  )}
                  onClick={() => handleConversationSelect(conv.id)}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback
                      style={{ backgroundColor: otherUser?.color || '#25D366' }}
                      className="text-white text-lg"
                    >
                      {getConversationDisplayName(conv).split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#222d34] py-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[#111b21] dark:text-[#e9edef] truncate">
                        {getConversationDisplayName(conv)}
                      </span>
                      <span className={cn(
                        "text-xs flex-shrink-0 ml-2",
                        unreadCount > 0 ? "text-[#25d366]" : "text-[#667781] dark:text-[#8696a0]"
                      )}>
                        {formatTime(conv.lastMessage?.timestamp)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="text-sm text-[#667781] dark:text-[#8696a0] truncate">
                        {conv.lastMessage?.text || 'Nessun messaggio'}
                      </p>
                      {unreadCount > 0 && (
                        <span className="ml-2 px-1.5 min-w-[20px] h-5 flex items-center justify-center bg-[#25d366] text-white text-xs rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId && selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-4 flex items-center justify-between bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#222d34]">
              <div className="flex items-center gap-3">
                {(() => {
                  const otherUser = getOtherUser(selectedConversation);
                  return (
                    <>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback
                          style={{ backgroundColor: otherUser?.color || '#25D366' }}
                          className="text-white"
                        >
                          {getConversationDisplayName(selectedConversation).split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-[#111b21] dark:text-[#e9edef]">
                          {getConversationDisplayName(selectedConversation)}
                        </h3>
                        <p className="text-xs text-[#667781] dark:text-[#8696a0]">
                          online
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-full text-[#54656f]">
                  <Search className="h-5 w-5" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full text-[#54656f]">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onClick={handleDeleteConversation}
                    >
                      Elimina Chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages Area with WhatsApp wallpaper */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-16 py-4"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundColor: '#efeae2'
              }}
            >
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-[#25d366]" />
                </div>
              ) : (
                <>
                  {groupedMessages.map((group, groupIndex) => (
                    <React.Fragment key={groupIndex}>
                      <DateSeparator date={group.date} />
                      {group.messages.map((msg) => {
                        return (
                          <MessageBubble
                            key={msg.id}
                            message={msg}
                            isCurrentUser={msg.userId === currentUser?.id}
                            sender={msg.userId ? usersById[msg.userId] : undefined}
                            showAvatar={msg.showAvatar}
                            isFirstInGroup={msg.isFirstInGroup}
                            isLastInGroup={msg.isLastInGroup}
                            onReply={() => {
                              setReplyingTo(msg);
                              setEditingMessage(null); // Clear edit if replying
                            }}
                            onDelete={() => {
                              deleteMessageMutation.mutate({ messageId: msg.id });
                            }}
                            onEdit={() => {
                              setEditingMessage(msg);
                              setMessageText(msg.text);
                              setReplyingTo(null); // Clear reply if editing
                              // focus input
                            }}
                            onReaction={(emoji) => onReactionClick(msg.id, emoji)}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33]">
              {/* Reply/Edit Banner */}
              {(replyingTo || editingMessage) && (
                <div className="flex items-center justify-between bg-white dark:bg-[#2a3942] p-2 rounded-t-lg border-b border-gray-200 dark:border-gray-700 mb-1">
                  <div className={cn("flex flex-col border-l-4 pl-2", editingMessage ? "border-blue-500" : "border-[#25d366]")}>
                    <span className={cn("text-xs font-bold", editingMessage ? "text-blue-500" : "text-[#25d366]")}>
                      {editingMessage ? 'Modifica messaggio' : `Rispondi a ${replyingTo?.userId ? usersById[replyingTo.userId]?.name : 'Utente'}`}
                    </span>
                    <span className="text-xs truncate text-[#54656f] dark:text-[#8696a0] max-w-[300px]">
                      {editingMessage ? editingMessage.text : replyingTo?.text}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setEditingMessage(null); setMessageText(""); }} className="h-6 w-6 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Files preview */}
              {filesToUpload.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {filesToUpload.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white dark:bg-[#2a3942] rounded-lg p-2 pr-3">
                      {file.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(file)} alt="" className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <FileIcon className="h-5 w-5 text-[#54656f]" />
                      )}
                      <span className="text-sm truncate max-w-[100px]">{file.name}</span>
                      <button onClick={() => setFilesToUpload(prev => prev.filter((_, i) => i !== index))}>
                        <X className="h-4 w-4 text-[#54656f] hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Plus/Attach button */}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files) {
                      setFilesToUpload(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-[#54656f] hover:text-[#54656f] hover:bg-[#e9edef] dark:hover:bg-[#374248] flex-shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="h-6 w-6" />
                </Button>

                {/* Input container with rounded pill shape */}
                <div className="flex-1 flex items-center gap-2 bg-white dark:bg-[#2a3942] rounded-full px-4 py-2 shadow-sm">
                  <Input
                    type="text"
                    placeholder="Scrivi un messaggio"
                    className="flex-1 bg-transparent border-0 h-6 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />

                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[#54656f] hover:text-[#25d366] transition flex-shrink-0">
                        <Smile className="h-5 w-5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-0" side="top" align="end">
                      <EmojiPicker onEmojiClick={onEmojiClick} />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Send button */}
                <Button
                  size="icon"
                  className="rounded-full bg-[#00a884] hover:bg-[#008f72] h-10 w-10 flex-shrink-0"
                  onClick={handleSendMessage}
                  disabled={sendMessageMutation.isPending || isUploading || (!messageText.trim() && filesToUpload.length === 0)}
                >
                  {sendMessageMutation.isPending || isUploading
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Send className="h-5 w-5" />
                  }
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35]">
            <div className="text-center max-w-md px-8">
              <div className="w-64 h-64 mx-auto mb-6 relative">
                <svg viewBox="0 0 303 172" className="w-full h-full text-[#8696a0] opacity-20">
                  <path fill="currentColor" d="M229.565 160.229c32.647-26.09 54.922-64.903 56.04-108.935 0.205-8.125-5.973-14.983-14.098-15.188-0.345-0.009-0.692-0.009-1.037 0.002-17.37 0.475-35.145 5.093-50.596 13.465-0.696 0.378-1.406 0.753-2.128 1.123-29.752 15.209-71.631 16.393-102.926 2.907-18.399-7.93-37.689-11.926-57.336-11.885-4.085 0.009-7.394 3.313-7.404 7.398-0.007 2.614 1.358 5.034 3.612 6.408 4.667 2.847 9.009 6.223 12.93 10.08 32.132 31.584 40.588 80.251 21.29 122.414-3.549 7.752 0.193 16.899 8.361 20.441 19.478 8.446 40.476 12.715 62.434 12.715 29.158 0 57.128-7.783 81.427-22.402l0.062-0.037c6.445-4.021 12.478-8.599 18.005-13.673 5.05-4.635 5.391-12.465 0.756-17.515z" />
                  <circle fill="currentColor" cx="126" cy="81" r="22" />
                </svg>
              </div>
              <h2 className="text-3xl font-light text-[#41525d] dark:text-[#e9edef] mb-4">
                W[r]Digital Chat
              </h2>
              <p className="text-sm text-[#667781] dark:text-[#8696a0]">
                Invia e ricevi messaggi con il tuo team. Seleziona una conversazione dalla barra laterale o iniziane una nuova.
              </p>
            </div>
          </div>
        )}
      </div>

      {currentThread && selectedConversation && currentUser && (
        <ThreadView
          parentMessage={currentThread}
          conversationId={selectedConversation.id}
          usersById={usersById}
          currentUserId={currentUser.id}
          isOpen={!!currentThread}
          onClose={() => setCurrentThread(null)}
        />
      )}

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova chat</DialogTitle>
            <DialogDescription>
              Seleziona un membro del team per iniziare una conversazione
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome..."
                className="pl-10"
                value={newChatUserSearch}
                onChange={(e) => setNewChatUserSearch(e.target.value)}
              />
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {users
                  .filter(u => u.id !== currentUser?.id)
                  .filter(u =>
                    !newChatUserSearch ||
                    u.name.toLowerCase().includes(newChatUserSearch.toLowerCase()) ||
                    u.email?.toLowerCase().includes(newChatUserSearch.toLowerCase())
                  )
                  .map(user => (
                    <button
                      key={user.id}
                      className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-muted transition text-left"
                      onClick={() => {
                        handleSelectUser(user.id);
                        setShowNewChatDialog(false);
                        setNewChatUserSearch('');
                      }}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback style={{ backgroundColor: user.color || '#25D366' }} className="text-white">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{user.role || user.email}</p>
                      </div>
                    </button>
                  ))}
                {users.filter(u => u.id !== currentUser?.id).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nessun altro utente disponibile
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Nuovo gruppo
            </DialogTitle>
            <DialogDescription>
              Crea un gruppo con più membri del team
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome gruppo</label>
              <Input
                placeholder="Es: Team Marketing, Progetto XYZ..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Membri ({selectedGroupMembers.length} selezionati)
              </label>
              <ScrollArea className="h-[200px] border rounded-lg p-2">
                <div className="space-y-1">
                  {users
                    .filter(u => u.id !== currentUser?.id)
                    .map(user => {
                      const isSelected = selectedGroupMembers.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          className={cn(
                            "flex items-center gap-3 w-full p-2 rounded-lg transition text-left",
                            isSelected ? "bg-[#25d366]/10 border border-[#25d366]" : "hover:bg-muted"
                          )}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedGroupMembers(prev => prev.filter(id => id !== user.id));
                            } else {
                              setSelectedGroupMembers(prev => [...prev, user.id]);
                            }
                          }}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback style={{ backgroundColor: user.color || '#25D366' }} className="text-white text-xs">
                              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-sm">{user.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-[#25d366]" />}
                        </button>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowGroupDialog(false)}>
                Annulla
              </Button>
              <Button
                className="flex-1 bg-[#25d366] hover:bg-[#1da851]"
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !groupName.trim() || selectedGroupMembers.length === 0}
              >
                {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crea gruppo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Client Channel Dialog */}
      <Dialog open={showClientChannelDialog} onOpenChange={setShowClientChannelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Chat cliente
            </DialogTitle>
            <DialogDescription>
              Crea un canale dedicato per comunicare su un cliente specifico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Seleziona cliente</label>
              <ScrollArea className="h-[150px] border rounded-lg p-2">
                <div className="space-y-1">
                  {clients.map(client => {
                    const isSelected = selectedClientId === client.id;
                    return (
                      <button
                        key={client.id}
                        className={cn(
                          "flex items-center gap-3 w-full p-2 rounded-lg transition text-left",
                          isSelected ? "bg-primary/10 border border-primary" : "hover:bg-muted"
                        )}
                        onClick={() => setSelectedClientId(client.id)}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: client.color || '#3B82F6' }}
                        >
                          {client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="flex-1 text-sm">{client.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                  {clients.length === 0 && (
                    <p className="text-center text-muted-foreground py-4 text-sm">
                      Nessun cliente disponibile
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Membri del canale ({selectedChannelMembers.length} selezionati)
              </label>
              <ScrollArea className="h-[150px] border rounded-lg p-2">
                <div className="space-y-1">
                  {users
                    .filter(u => u.id !== currentUser?.id)
                    .map(user => {
                      const isSelected = selectedChannelMembers.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          className={cn(
                            "flex items-center gap-3 w-full p-2 rounded-lg transition text-left",
                            isSelected ? "bg-primary/10 border border-primary" : "hover:bg-muted"
                          )}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedChannelMembers(prev => prev.filter(id => id !== user.id));
                            } else {
                              setSelectedChannelMembers(prev => [...prev, user.id]);
                            }
                          }}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback style={{ backgroundColor: user.color || '#25D366' }} className="text-white text-xs">
                              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-sm">{user.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowClientChannelDialog(false)}>
                Annulla
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateClientChannel}
                disabled={isCreatingChannel || !selectedClientId}
              >
                {isCreatingChannel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crea canale
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


export default function ChatPage() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<ChatSkeleton />}>
        <ChatPageContent queryClient={queryClient} />
      </Suspense>
    </QueryClientProvider>
  );
}

function ChatSkeleton() {
  return (
    <div className="flex h-full flex-1 bg-[#f0f2f5] dark:bg-[#111b21]">
      <div className="w-[350px] flex-shrink-0 border-r border-[#e9edef] dark:border-[#222d34] bg-white dark:bg-[#111b21]">
        <div className="h-14 px-4 flex items-center bg-[#f0f2f5] dark:bg-[#202c33]">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="p-2">
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <div className="p-3 space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35]">
        <Loader2 className="h-8 w-8 animate-spin text-[#25d366]" />
      </div>
    </div>
  );
}
