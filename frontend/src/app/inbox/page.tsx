'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Inbox as InboxIcon, MessageSquareQuote, SendHorizontal, Settings, Trash2, AlertTriangle, History, Archive, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { LoadingScreen } from '@/components/loading-screen';

interface Message {
    id: string;
    content: string;
    created_at: string;
    status: 'pending' | 'replied' | 'archived';
    replies?: {
        content: string;
        created_at: string;
    }[];
}

export default function InboxPage() {
    const { user, hasUsername, signOut, loading: authLoading } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [minLoading, setMinLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setMinLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);
    const [replyContent, setReplyContent] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
    const [view, setView] = useState<'inbox' | 'history'>('inbox');
    const [historyMessages, setHistoryMessages] = useState<Message[]>([]);
    const [archiving, setArchiving] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
            return;
        }

        if (!authLoading && user && hasUsername === false) {
            router.push('/setup');
            return;
        }

        if (!user) return;

        fetchMessages();
        fetchHistory();

        // Subscribe to real-time updates for new messages
        const channel = supabase
            .channel(`inbox-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${user.id}`
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    if (newMessage && newMessage.status === 'pending') {
                        fetchMessages(); // Re-fetch to get decrypted content
                        toast('New message received!', {
                            icon: <InboxIcon className="w-4 h-4" />
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, authLoading, hasUsername, router]);

    const fetchMessages = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/inbox`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setMessages(data || []);
            } else {
                toast.error('Failed to fetch inbox');
            }
        } catch {
            toast.error('Backend connection error');
        } finally {
            setLoading(false);
        }
    };

    const handleReply = async (messageId: string) => {
        if (!replyContent.trim()) return;

        setPublishing(true);
        const { data: { session } } = await supabase.auth.getSession();

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    message_id: messageId,
                    content: replyContent
                })
            });

            if (response.ok) {
                toast.success('Replied and published!');
                setReplyContent('');
                setReplyingTo(null);
                // Refresh inbox
                setMessages(prev => prev.filter(m => m.id !== messageId));
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to publish');
            }
        } catch {
            toast.error('Connection error');
        } finally {
            setPublishing(false);
        }
    };

    const fetchHistory = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/history`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setHistoryMessages(data || []);
            } else {
                console.warn('History route returned status:', response.status);
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    };

    const handleArchive = async (messageId: string) => {
        setArchiving(messageId);
        const { data: { session } } = await supabase.auth.getSession();

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/messages/${messageId}/archive`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (response.ok) {
                toast.success('Message archived');
                setMessages(prev => prev.filter(m => m.id !== messageId));
                fetchHistory(); // Refresh history
            } else {
                toast.error('Failed to archive');
            }
        } catch {
            toast.error('Connection error');
        } finally {
            setArchiving(null);
        }
    };

    const handleDelete = async (messageId: string) => {
        setMessageToDelete(null);

        const { data: { session } } = await supabase.auth.getSession();

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (response.ok) {
                toast.success('Message deleted');
                setMessages(prev => prev.filter(m => m.id !== messageId));
                setHistoryMessages(prev => prev.filter(m => m.id !== messageId));
            } else {
                toast.error('Failed to delete');
            }
        } catch {
            toast.error('Connection error');
        }
    };

    if (authLoading || loading || minLoading) return <LoadingScreen />;

    if (!user) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
            <h1 className="text-4xl font-bold tracking-tighter mb-4">Replied</h1>
            <p className="text-stone-500 max-w-sm mb-8">Please sign in to access your private inbox.</p>
            <Button onClick={() => window.location.href = '/'} className="bg-white text-black hover:bg-stone-200 px-8">Return Home</Button>
        </div>
    );

    return (
        <div className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex flex-col items-center md:flex-row md:items-center justify-between mb-12 gap-6 text-center md:text-left">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">{view === 'inbox' ? 'Your Inbox' : 'The Ledger'}</h1>
                        <p className="text-stone-400 mt-1 font-serif italic text-sm">
                            {view === 'inbox'
                                ? `Found ${messages.length} messages waiting`
                                : `Reviewing ${historyMessages.length} conversations`}
                        </p>
                    </div>
                    <div className="flex flex-col items-center sm:flex-row sm:items-center gap-4 w-full md:w-auto">
                        <Tabs value={view} onValueChange={(v: string) => setView(v as 'inbox' | 'history')} className="bg-white/5 p-1 rounded-xl w-full sm:w-64">
                            <TabsList className="bg-transparent border-none w-full grid grid-cols-2">
                                <TabsTrigger value="inbox" className="data-[state=active]:bg-white data-[state=active]:text-black rounded-lg px-4 gap-2 transition-all">
                                    <InboxIcon className="w-4 h-4" />
                                    Inbox
                                </TabsTrigger>
                                <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-black rounded-lg px-4 gap-2 transition-all">
                                    <History className="w-4 h-4" />
                                    Ledger
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Link href="/settings" className="flex-1">
                                <Button variant="ghost" size="sm" className="w-full text-stone-500 hover:text-white border border-stone-800 md:border-none rounded-xl">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </Button>
                            </Link>
                            <Button variant="ghost" size="sm" onClick={signOut} className="flex-1 text-stone-500 hover:text-white border border-stone-800 md:border-none rounded-xl">
                                <LogOut className="w-4 h-4 mr-2" />
                                Sign Out
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="grid gap-6">
                    <AnimatePresence mode="wait">
                        {view === 'inbox' ? (
                            messages.length === 0 ? (
                                <motion.div
                                    key="empty-inbox"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center py-20 border-2 border-dashed border-stone-800 rounded-3xl"
                                >
                                    <InboxIcon className="w-12 h-12 mx-auto text-stone-700 mb-4" />
                                    <h3 className="text-lg font-serif italic text-stone-500">Silence is an answer too.</h3>
                                    <p className="text-stone-600 text-sm">Share your link to get messages.</p>
                                </motion.div>
                            ) : (
                                <div className="grid gap-6">
                                    {messages.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                        >
                                            <Card className="border-stone-800 bg-stone-900/20 backdrop-blur shadow-xl hover:bg-stone-900/30 transition-all border-l-4 border-l-stone-700">
                                                <CardHeader className="pb-3 px-8 pt-8">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                                        <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase tracking-widest font-bold">
                                                            <MessageSquareQuote className="w-3 h-3" />
                                                            Message • {new Date(msg.created_at).toLocaleDateString()}
                                                        </div>
                                                        <div className="flex items-center gap-2 self-end sm:self-auto">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={archiving === msg.id}
                                                                onClick={() => handleArchive(msg.id)}
                                                                className="text-stone-500 hover:text-stone-200 hover:bg-white/5 rounded-lg h-8 px-3 text-[10px] uppercase font-bold tracking-wider"
                                                            >
                                                                <Archive className="w-3.5 h-3.5 mr-2" />
                                                                Silence
                                                            </Button>

                                                            <Dialog open={messageToDelete === msg.id} onOpenChange={(open) => !open && setMessageToDelete(null)}>
                                                                <DialogTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => setMessageToDelete(msg.id)}
                                                                        className="text-stone-700 hover:text-red-500 hover:bg-red-500/10 h-8 w-8 rounded-lg"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </DialogTrigger>
                                                                <DialogContent className="bg-stone-950 border-stone-800 text-white max-w-sm">
                                                                    <DialogHeader>
                                                                        <DialogTitle className="flex items-center gap-2">
                                                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                                                            Delete Completely?
                                                                        </DialogTitle>
                                                                        <DialogDescription className="text-stone-400">
                                                                            This will permanently delete the message from the recording.
                                                                        </DialogDescription>
                                                                    </DialogHeader>
                                                                    <DialogFooter className="mt-4 gap-2">
                                                                        <Button variant="ghost" onClick={() => setMessageToDelete(null)}>Cancel</Button>
                                                                        <Button variant="destructive" onClick={() => handleDelete(msg.id)}>Delete</Button>
                                                                    </DialogFooter>
                                                                </DialogContent>
                                                            </Dialog>
                                                        </div>
                                                    </div>
                                                    <CardTitle className="text-xl leading-relaxed font-serif italic text-stone-200">
                                                        &quot;{msg.content}&quot;
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="px-8 pb-8">
                                                    {replyingTo === msg.id ? (
                                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4">
                                                            <Textarea
                                                                autoFocus
                                                                placeholder="Your thoughtful response..."
                                                                className="bg-stone-950/50 border-stone-800 focus:border-stone-600 resize-none min-h-[120px] font-serif p-6 rounded-2xl text-lg shadow-inner"
                                                                value={replyContent}
                                                                onChange={(e) => setReplyContent(e.target.value)}
                                                            />
                                                            <div className="flex gap-3">
                                                                <Button
                                                                    disabled={publishing || !replyContent.trim()}
                                                                    onClick={() => handleReply(msg.id)}
                                                                    className="flex-1 bg-white text-black hover:bg-stone-200 h-12 rounded-xl font-bold"
                                                                >
                                                                    {publishing ? 'Publishing...' : 'Reply & Publish'}
                                                                    <SendHorizontal className="w-4 h-4 ml-2" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    onClick={() => setReplyingTo(null)}
                                                                    className="text-stone-400 hover:text-white rounded-xl px-6"
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    ) : (
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => setReplyingTo(msg.id)}
                                                            className="bg-stone-800/50 text-stone-200 hover:bg-stone-700 hover:text-white border-stone-700 h-12 px-8 rounded-xl font-semibold transition-all"
                                                        >
                                                            Respond to this
                                                        </Button>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        ) : (
                            historyMessages.length === 0 ? (
                                <motion.div
                                    key="empty-history"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-20 border-2 border-dashed border-stone-800 rounded-3xl"
                                >
                                    <History className="w-12 h-12 mx-auto text-stone-700 mb-4" />
                                    <h3 className="text-lg font-serif italic text-stone-500">The record is empty.</h3>
                                    <p className="text-stone-600 text-sm">Archived and replied messages will appear here.</p>
                                </motion.div>
                            ) : (
                                <div className="grid gap-6">
                                    {historyMessages.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <Card className="border-stone-900 bg-stone-950/20 backdrop-blur border-l-4 border-l-stone-800 opacity-80">
                                                <CardHeader className="p-8">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-4">
                                                            {msg.status === 'replied' ? (
                                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[9px] font-black tracking-widest uppercase">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    Published
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-stone-500/10 text-stone-500 text-[9px] font-black tracking-widest uppercase">
                                                                    <XCircle className="w-3 h-3" />
                                                                    Silenced
                                                                </div>
                                                            )}
                                                            <span className="text-[9px] text-stone-600 font-mono uppercase tracking-widest">
                                                                {new Date(msg.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(msg.id)}
                                                            className="text-stone-800 hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                    <CardTitle className="text-lg leading-relaxed font-serif italic text-stone-400">
                                                        &quot;{msg.content}&quot;
                                                    </CardTitle>

                                                    {(() => {
                                                        const reply = Array.isArray(msg.replies) ? msg.replies[0] : msg.replies;
                                                        if (!reply || !reply.content) return null;

                                                        return (
                                                            <div className="mt-6 pt-6 border-t border-stone-900">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <span className="text-[9px] font-mono text-stone-600 uppercase tracking-widest font-bold">Your Official Response</span>
                                                                </div>
                                                                <p className="text-stone-200 font-serif leading-relaxed">
                                                                    {reply.content}
                                                                </p>
                                                            </div>
                                                        );
                                                    })()}
                                                </CardHeader>
                                            </Card>
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        )}
                    </AnimatePresence>
                </div >
            </div >
        </div >
    );
}
