'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Inbox as InboxIcon, MessageSquareQuote, SendHorizontal, Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Message {
    id: string;
    content: string;
    created_at: string;
    status: 'pending' | 'replied' | 'archived';
}

export default function InboxPage() {
    const { user, signOut, loading: authLoading } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        if (!user) return;

        fetchMessages();

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
                    // Only add if it's pending (though the filter should handle most)
                    if (newMessage && newMessage.status === 'pending') {
                        setMessages(prev => [newMessage, ...prev]);
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
    }, [user]);

    const fetchMessages = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/inbox`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
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

    const handleDelete = async (messageId: string) => {
        if (!confirm('Are you sure you want to delete this message? It will be gone forever.')) return;

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
            } else {
                toast.error('Failed to delete');
            }
        } catch {
            toast.error('Connection error');
        }
    };

    if (authLoading || loading) return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-16 h-16 rounded-full bg-stone-900 border border-stone-800 mb-8"
            />
            <div className="w-48 h-4 bg-stone-900 rounded-full animate-pulse" />
        </div>
    );

    if (!user) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
            <h1 className="text-4xl font-bold tracking-tighter mb-4">Replied</h1>
            <p className="text-stone-500 max-w-sm mb-8">Please sign in to access your private inbox.</p>
            <Button onClick={() => window.location.href = '/'} className="bg-white text-black hover:bg-stone-200 px-8">Return Home</Button>
        </div>
    );

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex items-center justify-between mb-12">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Your Inbox</h1>
                        <p className="text-stone-400 mt-1">Found {messages.length} messages waiting for a response</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/settings">
                            <Button variant="ghost" size="sm" className="text-stone-500 hover:text-white">
                                <Settings className="w-4 h-4 mr-2" />
                                Settings
                            </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={signOut} className="text-stone-500 hover:text-white">
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                        </Button>
                    </div>
                </header>

                <div className="grid gap-6">
                    <AnimatePresence>
                        {messages.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-20 border-2 border-dashed border-stone-800 rounded-3xl"
                            >
                                <InboxIcon className="w-12 h-12 mx-auto text-stone-700 mb-4" />
                                <h3 className="text-lg font-medium text-stone-500">Silence is an answer too.</h3>
                                <p className="text-stone-600 text-sm">Share your link to get messages.</p>
                            </motion.div>
                        ) : (
                            messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    layout
                                    variants={{
                                        initial: { opacity: 0, scale: 0.95 },
                                        animate: { opacity: 1, scale: 1 },
                                        exit: { opacity: 0, scale: 0.8, x: 20, transition: { duration: 0.3 } }
                                    }}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                >
                                    <Card className="border-stone-800 bg-stone-900/20 backdrop-blur shadow-xl hover:bg-stone-900/30 transition-all border-l-4 border-l-stone-700">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-2">
                                                <MessageSquareQuote className="w-3 h-3" />
                                                Anonymous Message • {new Date(msg.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-start justify-between gap-4">
                                                <CardTitle className="text-lg leading-relaxed font-medium text-stone-200">
                                                    &quot;{msg.content}&quot;
                                                </CardTitle>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(msg.id)}
                                                    className="text-stone-600 hover:text-red-500 hover:bg-red-500/10 -mt-2 -mr-2 shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {replyingTo === msg.id ? (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="space-y-4 pt-2"
                                                >
                                                    <Textarea
                                                        autoFocus
                                                        placeholder="Your thoughtful response..."
                                                        className="bg-stone-950 border-stone-800 focus:border-stone-600 resize-none min-h-[100px]"
                                                        value={replyContent}
                                                        onChange={(e) => setReplyContent(e.target.value)}
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            disabled={publishing || !replyContent.trim()}
                                                            onClick={() => handleReply(msg.id)}
                                                            className="flex-1 bg-white text-black hover:bg-stone-200"
                                                        >
                                                            {publishing ? 'Publishing...' : 'Reply & Publish'}
                                                            <SendHorizontal className="w-4 h-4 ml-2" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => setReplyingTo(null)}
                                                            className="text-stone-400 hover:text-white"
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => setReplyingTo(msg.id)}
                                                    className="w-full sm:w-auto bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white border-stone-700"
                                                >
                                                    Respond to this
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
