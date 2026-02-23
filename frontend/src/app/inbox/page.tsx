'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Inbox as InboxIcon, MessageSquareQuote, SendHorizontal, Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function InboxPage() {
    const { user, signOut, loading: authLoading } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        if (user) {
            fetchMessages();
        }
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
        } catch (error) {
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
        } catch (error) {
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
        } catch (error) {
            toast.error('Connection error');
        }
    };

    if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background">Loading Inbox...</div>;
    if (!user) return <div className="min-h-screen flex items-center justify-center bg-background">Please sign in to view your inbox.</div>;

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
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8, x: 20 }}
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
                                                    "{msg.content}"
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
