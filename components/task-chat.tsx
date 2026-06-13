'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addTaskComment } from '@/lib/actions';
import type { Task, User } from '@/lib/data';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { cn } from '@/lib/utils';


interface TaskChatProps {
  task: Task;
  users: Record<string, User>;
  isOpen: boolean;
  onClose: () => void;
  onMessageSent: () => void;
}

export function TaskChat({ task, users, isOpen, onClose, onMessageSent }: TaskChatProps) {
  const { currentUser } = useLayoutData();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewMessage(text);

    const lastAt = text.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || /\s/.test(text[lastAt - 1]))) {
      const query = text.substring(lastAt + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setMentionPopoverOpen(true);
        return;
      }
    }
    setMentionPopoverOpen(false);
  };

  const handleMentionSelect = (user: User) => {
    const lastAt = newMessage.lastIndexOf('@');
    const textBefore = newMessage.substring(0, lastAt);
    const mentionText = `@[${user.name}](user:${user.id}) `;
    setNewMessage(textBefore + mentionText);
    setMentionPopoverOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    setIsSending(true);
    try {
      await addTaskComment(task.id, {
        userId: currentUser.id,
        text: newMessage,
      });
      setNewMessage('');
      onMessageSent();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Errore',
        description: "Impossibile inviare il messaggio.",
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const renderCommentText = (text: string) => {
    // Regex ancora più robusta e sicura: cerca pattern che iniziano con @[...] e finiscono con (user:...)
    // La parte (user:...) prende tutto fino alla parentesi chiusa, gestendo vari caratteri.
    const mentionRegex = /(@\[[^\]]+\]\(user:[^)]+\))/g;
    const parts = text.split(mentionRegex);

    return parts.map((part, index) => {
      // Controlliamo se la parte e' una menzione
      const match = part.match(/@\[([^\]]+)\]\(user:([^)]+)\)/);

      if (match) {
        const userName = match[1];
        // const userId = match[2]; // ID non usato nel render
        return <strong key={index} className="text-primary hover:underline cursor-pointer">@{userName}</strong>;
      }

      return <span key={index}>{part}</span>;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/40 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat: {task.title}
          </DialogTitle>
          <DialogDescription>
            Conversazione relativa al task.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-hidden bg-background">
          <ScrollArea className="h-full px-4">
            <div className="space-y-4 py-4">
              {(task.comments || []).map((msg, index) => {
                const user = users[msg.userId];
                const isCurrentUser = msg.userId === currentUser?.id;

                return (
                  <div
                    key={index}
                    className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''
                      }`}
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={user?.avatar || undefined} />
                      <AvatarFallback style={{ backgroundColor: user?.color, color: 'white' }}>
                        {user?.name.split(' ')[0].charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`p-3 rounded-lg max-w-[80%] shadow-sm ${isCurrentUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                        }`}
                    >
                      <p className="font-semibold text-xs mb-1 opacity-90">{user?.name}</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{renderCommentText(msg.text)}</p>
                      <p
                        className={`text-[10px] mt-1 text-right ${isCurrentUser
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                          }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {(!task.comments || task.comments.length === 0) && (
                <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
                  <p>Nessun messaggio ancora.</p>
                  <p className="text-sm">Inizia la conversazione!</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 border-t bg-muted/40 shrink-0">
          <Popover open={mentionPopoverOpen} onOpenChange={setMentionPopoverOpen}>
            <PopoverTrigger asChild>
              <div className="w-full">
                <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
                  <Input
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder="Scrivi un messaggio... (usa @ per menzionare)"
                    disabled={isSending}
                    className="flex-1 bg-background"
                  />
                  <Button type="submit" size="icon" disabled={isSending}>
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" side="top" align="start">
              <Command>
                <CommandInput placeholder="Menziona utente..." value={mentionQuery} onValueChange={setMentionQuery} />
                <CommandList>
                  <CommandEmpty>Nessun utente trovato.</CommandEmpty>
                  {Object.values(users).filter(user => user.name.toLowerCase().includes(mentionQuery.toLowerCase())).map(user => (
                    <CommandItem key={user.id} onSelect={() => handleMentionSelect(user)}>
                      {user.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper icon component removed as it is now imported from lucide-react
