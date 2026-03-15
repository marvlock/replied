'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Inbox as InboxIcon, MessageSquareQuote, SendHorizontal, Settings, Trash2, AlertTriangle, History, Archive, CheckCircle2, XCircle, Users, Bookmark, Heart, Activity, Clock, MessageSquare, User } from 'lucide-react';
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
    receiver_id?: string;
    profiles?: {
        username: string;
        avatar_url?: string;
    };
}

function InboxPage() {
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
    const searchParams = useSearchParams();
    const initialView = (searchParams.get('tab') as any) || 'inbox';
    const [view, setView] = useState<'inbox' | 'history' | 'feed' | 'bookmarks' | 'likes' | 'account'>(initialView);
    const [historyMessages, setHistoryMessages] = useState<Message[]>([]);
    const [feedMessages, setFeedMessages] = useState<Message[]>([]);
    const [bookmarkMessages, setBookmarkMessages] = useState<Message[]>([]);
    const [likedMessages, setLikedMessages] = useState<Message[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [archiving, setArchiving] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['inbox', 'history', 'feed', 'bookmarks', 'likes', 'account'].includes(tab)) {
            setView(tab as any);
        }
    }, [searchParams]);

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
        fetchFeed();
        fetchBookmarks();
        fetchLikes();
        fetchFriends();
        fetchUserProfile();

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

    const fetchBookmarks = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/bookmarks`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setBookmarkMessages(data);
            }
        } catch (err) {
            console.error('Error fetching bookmarks:', err);
        }
    };

    const fetchLikes = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/likes`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setLikedMessages(data);
            }
        } catch (err) {
            console.error('Error fetching likes:', err);
        }
    };

    const fetchFeed = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/friends/feed`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setFeedMessages(data);
            }
        } catch (err) {
            console.error('Error fetching feed:', err);
        }
    };

    const fetchFriends = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/friends/list`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFriends(data || []);
            }
        } catch (err) {
            console.error('Error fetching friends:', err);
        }
    };

    const fetchUserProfile = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (data) setUserProfile(data);
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
        <div className="min-h-screen bg-[#1C7BFF] text-black selection:bg-[#D4FF00] selection:text-black font-sans pb-32 md:pb-24">
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#D4FF00] border-b-4 border-black flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black text-[#D4FF00] border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <MessageSquareQuote className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-black uppercase tracking-tighter">
                        Replied
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/settings">
                        <button className="w-10 h-10 bg-white border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <Settings className="w-5 h-5" />
                        </button>
                    </Link>
                    <button onClick={signOut} className="w-10 h-10 bg-[#FF80FF] border-4 border-black flex items-center justify-center hover:bg-black hover:text-[#FF80FF] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </nav>

            <main className="pt-32 max-w-4xl mx-auto px-6 space-y-12">
                {/* Desktop Navigation */}
                <div className="hidden md:flex flex-wrap gap-4 border-b-4 border-black pb-8">
                    {[
                        { id: 'inbox', label: 'Inbox', icon: <InboxIcon className="w-5 h-5" /> },
                        { id: 'history', label: 'Ledger', icon: <History className="w-5 h-5" /> },
                        { id: 'feed', label: 'Feed', icon: <Activity className="w-5 h-5" /> },
                        { id: 'bookmarks', label: 'Saved', icon: <Bookmark className="w-5 h-5" /> },
                        { id: 'likes', label: 'Liked', icon: <Heart className="w-5 h-5" /> },
                        { id: 'account', label: 'Account', icon: <User className="w-5 h-5" /> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.id as any)}
                            className={`flex flex-col sm:flex-row items-center justify-center gap-2 flex-1 min-w-[120px] px-4 py-4 border-4 border-black font-black uppercase tracking-widest text-sm transition-all ${view === tab.id ? 'bg-black text-[#D4FF00] translate-y-[4px] shadow-none' : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FF80FF]'}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Mobile Navigation */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#D4FF00] border-t-4 border-black px-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
                    <nav className="flex items-center justify-around py-3">
                        {[
                            { id: 'inbox', label: 'Inbox', icon: <InboxIcon className="w-6 h-6" /> },
                            { id: 'history', label: 'Ledger', icon: <History className="w-6 h-6" /> },
                            { id: 'feed', label: 'Feed', icon: <Activity className="w-6 h-6" /> },
                            { id: 'bookmarks', label: 'Saved', icon: <Bookmark className="w-6 h-6" /> },
                            { id: 'likes', label: 'Liked', icon: <Heart className="w-6 h-6" /> },
                            { id: 'account', label: 'Account', icon: <User className="w-6 h-6" /> },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setView(tab.id as any)}
                                className={`flex flex-col items-center gap-1 transition-transform ${view === tab.id ? 'scale-110 text-black' : 'text-black/60 hover:text-black'}`}
                            >
                                {tab.icon}
                                <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
                                {view === tab.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-black absolute -bottom-2" />
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="grid gap-8">
                    <AnimatePresence mode="wait">
                        {view === 'inbox' ? (
                            messages.length === 0 ? (
                                <motion.div
                                    key="empty-inbox"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center py-32 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                                >
                                    <InboxIcon className="w-24 h-24 mx-auto fill-black/5 stroke-black mb-8 stroke-2" />
                                    <h3 className="text-5xl font-black uppercase tracking-tighter mb-4 text-black">Dead Quiet</h3>
                                    <p className="text-2xl font-bold uppercase text-black/60">Share your link to get messages.</p>
                                    <Link href={`/${userProfile?.username}`}>
                                        <button className="mt-8 bg-[#D4FF00] hover:bg-black hover:text-[#D4FF00] text-black border-4 border-black px-8 py-4 text-xl font-black uppercase tracking-widest transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            View Profile
                                        </button>
                                    </Link>
                                </motion.div>
                            ) : (
                                <div className="grid gap-8">
                                    {messages.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-full">
                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                                                    <div className="flex items-center gap-2 bg-black text-white px-3 py-1 font-bold uppercase text-sm border-2 border-black w-fit shadow-[4px_4px_0px_0px_rgba(28,123,255,1)]">
                                                        <MessageSquareQuote className="w-4 h-4" />
                                                        {new Date(msg.created_at).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex items-center gap-3 self-end sm:self-auto">
                                                        <button
                                                            disabled={archiving === msg.id}
                                                            onClick={() => handleArchive(msg.id)}
                                                            className="bg-[#D4FF00] hover:bg-black hover:text-[#D4FF00] text-black border-4 border-black px-4 py-2 font-black uppercase text-sm flex items-center gap-2 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                                                        >
                                                            <Archive className="w-4 h-4" />
                                                            Silence
                                                        </button>
                                                        <Dialog open={messageToDelete === msg.id} onOpenChange={(open) => !open && setMessageToDelete(null)}>
                                                            <DialogTrigger asChild>
                                                                <button
                                                                    onClick={() => setMessageToDelete(msg.id)}
                                                                    className="bg-[#FF4040] hover:bg-black hover:text-[#FF4040] text-black border-4 border-black p-2 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                                                >
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </DialogTrigger>
                                                            <DialogContent className="bg-white border-4 border-black p-0 overflow-hidden shadow-[16px_16px_0px_0px_rgba(255,64,64,1)] rounded-none">
                                                                <DialogHeader className="bg-[#FF4040] p-6 border-b-4 border-black">
                                                                    <DialogTitle className="text-3xl font-black uppercase tracking-tighter flex items-center gap-2 text-black">
                                                                        <AlertTriangle className="w-8 h-8 fill-black stroke-[#FF4040]" />
                                                                        NUKE THIS?
                                                                    </DialogTitle>
                                                                    <DialogDescription className="text-xl font-bold text-black/80 uppercase mt-2">
                                                                        This deletes it from existence. Forever.
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <DialogFooter className="p-6 bg-white flex flex-col sm:flex-row gap-4">
                                                                    <button onClick={() => setMessageToDelete(null)} className="flex-1 bg-white hover:bg-black hover:text-white border-4 border-black py-4 text-xl font-black uppercase transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">Cancel</button>
                                                                    <button onClick={() => handleDelete(msg.id)} className="flex-1 bg-black text-white hover:text-[#FF4040] border-4 border-black py-4 text-xl font-black uppercase transition-colors shadow-[4px_4px_0px_0px_rgba(255,64,64,1)]">Nuke</button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                </div>
                                                
                                                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight mb-8">
                                                    "{msg.content}"
                                                </h2>

                                                <div className="mt-auto">
                                                    {replyingTo === msg.id ? (
                                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                                            <Textarea
                                                                autoFocus
                                                                placeholder="TYPE YOUR RESPONSE..."
                                                                className="bg-[#D4FF00] border-4 border-black focus-visible:ring-0 rounded-none text-2xl font-black uppercase p-6 min-h-[160px] shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.1)] resize-none text-black placeholder:text-black/30"
                                                                value={replyContent}
                                                                onChange={(e) => setReplyContent(e.target.value)}
                                                            />
                                                            <div className="flex flex-col sm:flex-row gap-4">
                                                                <button
                                                                    disabled={publishing || !replyContent.trim()}
                                                                    onClick={() => handleReply(msg.id)}
                                                                    className="flex-1 bg-black text-[#1C7BFF] hover:text-white border-4 border-black py-4 text-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-[4px_4px_0px_0px_rgba(28,123,255,1)] disabled:opacity-50"
                                                                >
                                                                    {publishing ? 'SENDING...' : 'PUBLISH'}
                                                                    <SendHorizontal className="w-6 h-6" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setReplyingTo(null)}
                                                                    className="sm:w-32 bg-white hover:bg-black hover:text-white border-4 border-black py-4 text-xl font-black uppercase transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                                                >
                                                                    DROP
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setReplyingTo(msg.id)}
                                                            className="w-full bg-[#1C7BFF] hover:bg-black text-black hover:text-[#1C7BFF] border-4 border-black py-6 text-2xl font-black uppercase tracking-widest transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                                                        >
                                                            Respond
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        ) : view === 'history' ? (
                            historyMessages.length === 0 ? (
                                <motion.div
                                    key="empty-history"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center py-32 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                                >
                                    <History className="w-24 h-24 mx-auto fill-black/5 stroke-black mb-8 stroke-2" />
                                    <h3 className="text-5xl font-black uppercase tracking-tighter mb-4 text-black">Clean Slate</h3>
                                    <p className="text-2xl font-bold uppercase text-black/60">No history yet.</p>
                                </motion.div>
                            ) : (
                                <div className="grid gap-8">
                                    {historyMessages.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        {msg.status === 'replied' ? (
                                                            <div className="bg-[#D4FF00] text-black border-2 border-black px-3 py-1 font-black uppercase text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                                                                <CheckCircle2 className="w-4 h-4 stroke-[3px]" />
                                                                Published
                                                            </div>
                                                        ) : (
                                                            <div className="bg-black text-white border-2 border-black px-3 py-1 font-black uppercase text-xs sm:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                                                                <XCircle className="w-4 h-4 stroke-[3px]" />
                                                                Silenced
                                                            </div>
                                                        )}
                                                        <span className="text-xs sm:text-sm font-bold uppercase bg-white border-2 border-black px-3 py-1">
                                                            {new Date(msg.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(msg.id)}
                                                        className="self-end sm:self-auto bg-[#FF4040] hover:bg-black hover:text-[#FF4040] border-4 border-black p-2 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                                    >
                                                        <Trash2 className="w-5 h-5 text-black hover:text-[#FF4040] transition-colors" />
                                                    </button>
                                                </div>
                                                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-tight opacity-50 mb-8 line-through decoration-4 decoration-black">
                                                    "{msg.content}"
                                                </h2>

                                                {(() => {
                                                    const reply = Array.isArray(msg.replies) ? msg.replies[0] : msg.replies;
                                                    if (!reply || !reply.content) return null;

                                                    return (
                                                        <div className="pt-8 border-t-8 border-black border-dashed">
                                                            <div className="bg-[#FF80FF] text-black border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
                                                                <div className="absolute -top-4 left-6 bg-black text-white px-4 py-1.5 font-black uppercase text-sm border-2 border-black">
                                                                    Response
                                                                </div>
                                                                <p className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight mt-4">
                                                                    {reply.content}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        ) : view === 'feed' ? (
                            feedMessages.length === 0 ? (
                                <motion.div
                                    key="empty-feed"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center py-32 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                                >
                                    <Activity className="w-24 h-24 mx-auto stroke-black mb-8 stroke-2" />
                                    <h3 className="text-5xl font-black uppercase tracking-tighter mb-4 text-black">No Pulse</h3>
                                    <p className="text-xl font-bold uppercase text-black/60">Add users to track their activity.</p>
                                    <Link href="/friends">
                                        <button className="mt-8 bg-[#D4FF00] hover:bg-black hover:text-[#D4FF00] text-black border-4 border-black px-8 py-4 text-xl font-black uppercase tracking-widest transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            Find Users
                                        </button>
                                    </Link>
                                </motion.div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {feedMessages.map((msg: any) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-full hover:translate-x-1 hover:-translate-y-1 transition-transform">
                                                <div className="p-6 border-b-4 border-black flex flex-row items-center gap-4 bg-[#D4FF00]">
                                                    <div className="w-12 h-12 rounded-none bg-white border-4 border-black flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                                        {msg.profiles?.avatar_url ? (
                                                            <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-xl font-black text-black">
                                                                {msg.profiles?.username?.[0]?.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <Link href={`/${msg.profiles?.username}`} className="text-black font-black uppercase tracking-widest text-lg hover:underline truncate block">
                                                            @{msg.profiles?.username}
                                                        </Link>
                                                        <div className="flex items-center gap-2 text-xs text-black font-bold uppercase tracking-widest mt-1">
                                                            <Clock className="w-3 h-3 stroke-[3px]" />
                                                            {new Date(msg.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-6 flex-1 flex flex-col gap-6">
                                                    <div className="bg-[#1C7BFF] p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                        <p className="text-black text-2xl font-black uppercase leading-tight">"{msg.content}"</p>
                                                    </div>
                                                    {msg.replies?.[0] && (
                                                        <div className="flex flex-col gap-2 mt-auto">
                                                            <div className="flex items-center gap-2">
                                                                <MessageSquareQuote className="w-4 h-4 text-[#FF4040] stroke-[3px]" />
                                                                <span className="text-sm font-black text-[#FF4040] uppercase tracking-widest">
                                                                    Response
                                                                </span>
                                                            </div>
                                                            <p className="text-black text-xl font-bold uppercase pl-6 border-l-4 border-black">
                                                                {msg.replies[0].content}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        ) : view === 'bookmarks' ? (
                            bookmarkMessages.length === 0 ? (
                                <motion.div
                                    key="empty-bookmarks"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center py-32 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                                >
                                    <Bookmark className="w-24 h-24 mx-auto stroke-black mb-8 stroke-2" />
                                    <h3 className="text-5xl font-black uppercase tracking-tighter mb-4 text-black">No Saves</h3>
                                    <p className="text-xl font-bold uppercase text-black/60">Saved posts from public profiles appear here.</p>
                                </motion.div>
                            ) : (
                                <div className="grid gap-8">
                                    {bookmarkMessages.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-3 h-3 bg-[#1C7BFF] border-2 border-black" />
                                                        <span className="text-sm text-black font-black uppercase tracking-[0.2em] border-2 border-black px-3 py-1 bg-[#D4FF00]">
                                                            SAVED • @{msg.profiles?.username}
                                                        </span>
                                                    </div>
                                                    <Link href={`/${msg.profiles?.username}`}>
                                                        <button className="bg-[#1C7BFF] hover:bg-black hover:text-[#1C7BFF] text-black border-4 border-black px-4 py-2 text-sm font-black uppercase tracking-widest transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                            View
                                                        </button>
                                                    </Link>
                                                </div>
                                                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight mb-8">
                                                    "{msg.content}"
                                                </h2>

                                                {(() => {
                                                    const reply = Array.isArray(msg.replies) ? msg.replies[0] : msg.replies;
                                                    if (!reply || !reply.content) return null;

                                                    return (
                                                        <div className="pt-8 border-t-8 border-black border-dashed mt-8">
                                                            <div className="bg-[#FF80FF] border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
                                                                <div className="absolute -top-4 left-6 bg-black text-white px-4 py-1.5 font-black uppercase text-sm border-2 border-black">
                                                                    Official Response
                                                                </div>
                                                                <p className="text-xl md:text-3xl font-black uppercase tracking-tighter leading-tight text-black mt-4">
                                                                    {reply.content}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        ) : view === 'likes' ? (
                            likedMessages.length === 0 ? (
                                <motion.div
                                    key="empty-likes"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center py-32 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                                >
                                    <Heart className="w-24 h-24 mx-auto stroke-black mb-8 stroke-2" />
                                    <h3 className="text-5xl font-black uppercase tracking-tighter mb-4 text-black">No Likes</h3>
                                    <p className="text-xl font-bold uppercase text-black/60">Posts you like will be collected here.</p>
                                </motion.div>
                            ) : (
                                <div className="grid gap-8">
                                    {likedMessages.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                        >
                                            <div className="bg-white border-4 border-black border-l-8 border-l-[#FF4040] p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <Heart className="w-5 h-5 text-[#FF4040] fill-current" />
                                                        <span className="text-sm text-black font-black uppercase tracking-[0.2em] border-2 border-black px-3 py-1 bg-[#FF4040] text-white">
                                                            LIKED • @{msg.profiles?.username}
                                                        </span>
                                                    </div>
                                                    <Link href={`/${msg.profiles?.username}`}>
                                                        <button className="bg-white hover:bg-[#FF4040] hover:text-white text-black border-4 border-black px-4 py-2 text-sm font-black uppercase tracking-widest transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                            View
                                                        </button>
                                                    </Link>
                                                </div>
                                                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight mb-8">
                                                    "{msg.content}"
                                                </h2>

                                                {(() => {
                                                    const reply = Array.isArray(msg.replies) ? msg.replies[0] : msg.replies;
                                                    if (!reply || !reply.content) return null;

                                                    return (
                                                        <div className="pt-8 border-t-8 border-black border-dashed mt-8">
                                                            <div className="bg-black text-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(255,128,255,1)] relative">
                                                                <div className="absolute -top-4 left-6 bg-[#D4FF00] text-black px-4 py-1.5 font-black uppercase text-sm border-2 border-black">
                                                                    Official Response
                                                                </div>
                                                                <p className="text-xl md:text-3xl font-black uppercase tracking-tighter leading-tight mt-4">
                                                                    {reply.content}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )
                        ) : (
                            <motion.div
                                key="account-view"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="grid gap-8"
                            >
                                {/* Account Identity Header Preview */}
                                <Link
                                    href={`/${userProfile?.username}`}
                                    className="p-8 md:p-12 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-center gap-8 hover:translate-x-1 hover:-translate-y-1 transition-transform cursor-pointer"
                                >
                                    <div className="w-32 h-32 bg-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(212,255,0,1)] flex flex-col items-center justify-center overflow-hidden flex-shrink-0">
                                        {userProfile?.avatar_url ? (
                                            <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white">
                                                {userProfile?.username?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center sm:text-left flex-1 max-w-2xl">
                                        <h2 className="text-4xl md:text-6xl font-black text-black tracking-tighter uppercase mb-2">@{userProfile?.username}</h2>
                                        <div className="inline-block bg-black text-[#D4FF00] font-bold text-xs uppercase tracking-widest px-4 py-2 border-2 border-black mb-4">
                                            {userProfile?.display_name || 'Anonymous User'}
                                        </div>
                                        <p className="text-black text-xl font-bold uppercase opacity-80 border-l-4 border-black pl-4 py-1">
                                            {userProfile?.bio || 'No bio yet. Define your curation style in settings.'}
                                        </p>
                                    </div>

                                </Link>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Friends Preview Card */}
                                    <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-full">
                                        <div className="p-8 border-b-4 border-black flex items-center gap-4 bg-[#1C7BFF]">
                                            <div className="w-16 h-16 bg-black flex items-center justify-center border-4 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                                                <Users className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Network</h3>
                                                <p className="text-sm text-black font-black uppercase tracking-widest bg-[#D4FF00] inline-block px-2 border-2 border-black mt-1">
                                                    {friends.length} Active
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-8 pb-0 min-h-[100px] flex items-center bg-[url('/noise.png')] bg-repeat opacity-90">
                                            {friends.length === 0 ? (
                                                <p className="text-black text-xl font-bold uppercase text-center w-full bg-white p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    Your network is dead.<br/>Find some noise.
                                                </p>
                                            ) : (
                                                <div className="flex -space-x-4 overflow-hidden py-4 px-2">
                                                    {friends.slice(0, 5).map((friend, i) => (
                                                        <div key={i} className="inline-block h-16 w-16 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center overflow-hidden z-10" title={friend.username}>
                                                            {friend.avatar_url ? (
                                                                <img src={friend.avatar_url} className="h-full w-full object-cover grayscale" />
                                                            ) : (
                                                                <div className="text-xl font-black text-black">
                                                                    {friend.username?.[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {friends.length > 5 && (
                                                        <div className="flex items-center justify-center h-16 w-16 bg-black border-4 border-black text-lg font-black text-[#D4FF00] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20">
                                                            +{friends.length - 5}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-8 mt-auto">
                                            <Link href="/friends">
                                                <button className="w-full bg-black text-white hover:bg-[#D4FF00] hover:text-black border-4 border-black py-4 text-xl font-black uppercase transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    Manage Network
                                                </button>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Settings Preview Card */}
                                    <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col h-full">
                                        <div className="p-8 border-b-4 border-black flex items-center gap-4 bg-[#FF80FF]">
                                            <div className="w-16 h-16 bg-black flex items-center justify-center border-4 border-black shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                                                <Settings className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Config</h3>
                                                <p className="text-sm text-black font-black uppercase tracking-widest bg-white inline-block px-2 border-2 border-black mt-1">
                                                    Control Panel
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-8 space-y-6 flex-1 bg-[url('/noise.png')] bg-repeat opacity-95">
                                            <div className="bg-white p-4 border-4 border-black flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                <span className="text-black font-bold uppercase text-lg">Inbox Status</span>
                                                <span className={userProfile?.is_paused ? "text-white font-black uppercase tracking-widest px-4 py-2 bg-[#FF4040] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "text-black font-black uppercase tracking-widest px-4 py-2 bg-[#D4FF00] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"}>
                                                    {userProfile?.is_paused ? 'Paused' : 'Active'}
                                                </span>
                                            </div>
                                            <div className="bg-white p-4 border-4 border-black flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                <span className="text-black font-bold uppercase text-lg">Word Filters</span>
                                                <span className="text-white font-black uppercase tracking-widest px-4 py-2 bg-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(255,128,255,1)]">
                                                    {userProfile?.blocked_phrases?.length || 0} Blocked
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-8 mt-auto border-t-4 border-black">
                                            <Link href="/settings">
                                                <button className="w-full bg-black text-white hover:bg-[#FF80FF] hover:text-black border-4 border-black py-4 text-xl font-black uppercase transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    Full Config
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}

export default function SuspenseInboxPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <InboxPage />
        </Suspense>
    );
}
