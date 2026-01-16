'use client';
import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { getFirestore, collection, query, onSnapshot, orderBy, where, doc, getDoc, addDoc } from 'firebase/firestore';
import type { Message, User } from '@/lib/data';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/lib/firebase';

interface ThreadViewProps {
    parentMessage: Message;
    conversationId: string;
    usersById: Record<string, User>;
    currentUserId: string;
    isOpen: boolean;
    onClose: () => void;
}


function parseTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
        return timestamp;
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return new Date();
    return date;
}

export function ThreadView({ parentMessage, conversationId, usersById, currentUserId, isOpen, onClose }: ThreadViewProps) {
    const [threadMessages, setThreadMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        setIsLoading(true);
        const threadQuery = query(
            collection(db, 'conversations', conversationId, 'messages', parentMessage.id, 'thread'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(threadQuery, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Message);
            setThreadMessages(messages);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching thread messages:", error);
            toast.error("Impossibile caricare il thread.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, conversationId, parentMessage.id]);

    const handleSendReply = async () => {
        if (!replyText.trim() || !currentUserId) return;

        setIsSending(true);
        try {
            const threadCollectionRef = collection(db, 'conversations', conversationId, 'messages', parentMessage.id, 'thread');
            await addDoc(threadCollectionRef, {
                userId: currentUserId,
                text: replyText,
                timestamp: new Date().toISOString(),
                reactions: {},
            });
            setReplyText('');
        } catch (error) {
            console.error("Error sending reply:", error);
            toast.error("Impossibile inviare la risposta.");
        } finally {
            setIsSending(false);
        }
    };

    const userId = parentMessage.userId;
    const parentSender = userId ? usersById[userId] : undefined;


    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-[450px] sm:max-w-xl flex flex-col">
                <SheetHeader>
                    <SheetTitle>Thread</SheetTitle>
                    <SheetDescription>
                        Risposta al messaggio di {parentSender?.name || 'sconosciuto'}.
                    </SheetDescription>
                </SheetHeader>

                {/* Parent Message */}
                <div className="p-4 border-b">
                    <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarFallback style={{ backgroundColor: parentSender?.color, color: 'white' }}>
                                {parentSender?.name.split(' ')[0].charAt(0) || '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <p className="font-semibold">{parentSender?.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(parseTimestamp(parentMessage.timestamp), { addSuffix: true, locale: it })}
                                </p>
                            </div>
                            <div className="p-3 bg-secondary rounded-md mt-1">
                                <p className="text-sm whitespace-pre-wrap">{parentMessage.text}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4 py-4">
                        {isLoading ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : threadMessages.length > 0 ? (
                            threadMessages.map(msg => {
                                const replyUserId = msg.userId;
                                const sender = replyUserId ? usersById[replyUserId] : undefined;
                                return (
                                    <div key={msg.id} className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback style={{ backgroundColor: sender?.color, color: 'white' }}>
                                                {sender?.name.split(' ')[0].charAt(0) || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <p className="font-semibold text-sm">{sender?.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(parseTimestamp(msg.timestamp), { addSuffix: true, locale: it })}
                                                </p>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap mt-1">{msg.text}</p>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-center text-sm text-muted-foreground py-8">Nessuna risposta ancora. Sii il primo a rispondere!</p>
                        )}
                    </div>
                </ScrollArea>

                <SheetFooter>
                    <div className="flex w-full items-center gap-2">
                        <Input
                            placeholder="Rispondi..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                        />
                        <Button size="icon" onClick={handleSendReply} disabled={isSending}>
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
