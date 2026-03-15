'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Heart, Bookmark, Activity, ArrowRight, Star } from 'lucide-react';
import { LoadingScreen } from '@/components/loading-screen';
import Link from 'next/link';

interface Profile {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    bio?: string;
    is_paused: boolean;
}

interface Conversation {
    id: string;
    content: string;
    created_at: string;
    thread_id: string;
    sender_id?: string;
    replies: any;
    is_liked: boolean;
    is_bookmarked: boolean;
    likes_count: number;
    bookmarks_count: number;
}

export default function PublicProfileClient({ username }: { username: string }) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [publishedPairs, setPublishedPairs] = useState<Conversation[]>([]);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [minLoading, setMinLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [replyingToThread, setReplyingToThread] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setMinLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        async function fetchData() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setCurrentUserId(session?.user.id || null);

                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/profile/${username}`, {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token || ''}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setProfile(data.profile);
                    setPublishedPairs(data.messages || []);
                } else {
                    console.error('Failed to fetch profile from backend');
                }
            } catch (err) {
                console.error('Error fetching profile from backend:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [username]);

    const handleSubmit = async () => {
        if (!profile || !message.trim()) {
            if (!message.trim()) toast.error('Message cannot be empty');
            return;
        }

        setSending(true);
        const { data: { session } } = await supabase.auth.getSession();

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    receiver_id: profile.id,
                    content: message,
                    thread_id: replyingToThread || undefined
                })
            });

            if (response.ok) {
                toast.success(replyingToThread ? 'Follow-up sent!' : 'Message sent! It will appear if replied to.');
                setMessage('');
                setReplyingToThread(null);
            } else {
                const errData = await response.json();
                toast.error(errData.error || 'Failed to send');
            }
        } catch {
            toast.error('Connection error');
        } finally {
            setSending(false);
        }
    };

    const handleSocialAction = async (messageId: string, type: 'like' | 'bookmark', isActive: boolean) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            toast.error('Sign in to leave a mark');
            return;
        }

        const previousPairs = [...publishedPairs];
        setPublishedPairs(prev => prev.map(p => {
            if (p.id === messageId) {
                return {
                    ...p,
                    [`is_${type}`]: !isActive,
                    [`${type}s_count`]: isActive
                        ? (p[`${type}s_count` as keyof Conversation] as number) - 1
                        : (p[`${type}s_count` as keyof Conversation] as number) + 1
                };
            }
            return p;
        }));

        try {
            const method = isActive ? 'DELETE' : 'POST';
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/messages/${messageId}/${type}`, {
                method,
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) {
                setPublishedPairs(previousPairs);
                const errData = await response.json();
                toast.error(errData.error || `Failed to ${type}`);
            }
        } catch {
            setPublishedPairs(previousPairs);
            toast.error('Connection error');
        }
    };

    if (loading || minLoading) return <LoadingScreen />;
    if (!profile) return <div className="min-h-screen flex items-center justify-center text-4xl font-black bg-[#FF80FF] text-black uppercase">User Not Found</div>;

    return (
        <div className="min-h-screen bg-[#1C7BFF] text-black selection:bg-[#D4FF00] selection:text-black font-sans pb-24">
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#D4FF00] border-b-4 border-black">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <Link href="/" className="text-2xl font-black tracking-tighter uppercase whitespace-nowrap">
                        REPLIED
                    </Link>
                    <div className="text-xl font-bold uppercase tracking-widest hidden sm:block truncate ml-4">
                        @{profile.username}&apos;S INBOX 
                    </div>
                </div>
            </nav>

            <main className="pt-32 max-w-2xl mx-auto px-6 space-y-20">
                {/* Profile Header Block */}
                <section className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 md:p-12 relative overflow-visible">
                    <div className="absolute -top-16 right-8 w-32 h-32 md:w-40 md:h-40 bg-[#FF80FF] border-4 border-black rounded-full overflow-hidden flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-10">
                        {profile.avatar_url ? (
                            <Image
                                src={profile.avatar_url}
                                alt={profile.display_name || 'Profile'}
                                width={160}
                                height={160}
                                unoptimized
                                className="w-full h-full object-cover grayscale"
                            />
                        ) : (
                            <span className="text-6xl font-black">{profile.username[0].toUpperCase()}</span>
                        )}
                    </div>

                    <div className="mt-8 md:mt-0 max-w-[70%]">
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-2 break-all">
                            {profile.display_name || profile.username}
                        </h1>
                        <p className="text-xl font-bold uppercase italic tracking-widest text-[#1C7BFF] mb-6 block">
                            @{profile.username}
                        </p>
                        {profile.bio && (
                            <p className="text-lg md:text-2xl font-bold leading-tight">
                                {profile.bio}
                            </p>
                        )}
                    </div>
                </section>

                {/* Submission Block */}
                <section className="bg-[#D4FF00] border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    {profile.is_paused ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                            <Lock className="w-16 h-16 fill-black mb-6" />
                            <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4">Inbox Paused</h3>
                            <p className="text-xl font-bold uppercase">This user has temporarily paused new messages.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter flex items-center gap-4">
                                <Star className="w-8 h-8 fill-black" />
                                {replyingToThread ? "FOLLOW-UP QUESTION" : "START A CONVERSATION"}
                            </h2>
                            
                            <Textarea
                                placeholder={replyingToThread ? "Type your follow-up anonymous question..." : "Ask me anything anonymously..."}
                                className="w-full bg-white border-4 border-black focus-visible:ring-0 text-xl md:text-2xl p-6 resize-none placeholder:text-gray-400 font-bold min-h-[160px] rounded-none shadow-inner"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                maxLength={500}
                            />

                            {replyingToThread && (
                                <button
                                    onClick={() => setReplyingToThread(null)}
                                    className="self-start text-sm md:text-base font-black uppercase underline hover:text-[#FF80FF] transition-colors"
                                >
                                    Cancel Follow-up
                                </button>
                            )}

                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <span className={`text-xl font-black uppercase ${message.length > 450 ? 'text-red-600' : 'text-black'}`}>
                                    {message.length} / 500
                                </span>

                                <button
                                    disabled={sending || !message.trim()}
                                    onClick={handleSubmit}
                                    className="w-full sm:w-auto bg-black text-white hover:bg-white hover:text-black border-4 border-black px-10 py-4 font-black text-xl uppercase tracking-widest transition-all disabled:opacity-50 disabled:hover:bg-black disabled:hover:text-white flex items-center justify-center gap-4 group"
                                >
                                    {sending ? 'Sending...' : 'Send'}
                                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Feed Block */}
                <section>
                    <div className="bg-black text-white inline-block px-6 py-2 border-4 border-black mb-8">
                        <h2 className="text-3xl font-black uppercase tracking-widest">THE RECORD</h2>
                    </div>

                    <div className="space-y-12">
                        <AnimatePresence mode="popLayout">
                            {publishedPairs.length === 0 ? (
                                <p className="text-2xl font-bold uppercase p-8 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
                                    No conversations public yet.
                                </p>
                            ) : (
                                (() => {
                                    const threads: Record<string, Conversation[]> = {};
                                    publishedPairs.forEach(pair => {
                                        if (!threads[pair.thread_id]) threads[pair.thread_id] = [];
                                        threads[pair.thread_id].push(pair);
                                    });

                                    return Object.entries(threads).sort((a, b) => {
                                        const latestA = new Date(Math.max(...a[1].map(m => new Date(m.created_at).getTime()))).getTime();
                                        const latestB = new Date(Math.max(...b[1].map(m => new Date(m.created_at).getTime()))).getTime();
                                        return latestB - latestA;
                                    }).map(([threadId, messages], tIdx) => (
                                        <motion.div
                                            key={threadId}
                                            initial={{ opacity: 0, y: 40 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true, margin: "-100px" }}
                                            className="space-y-8 bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative"
                                        >
                                            <div className="absolute -top-4 -right-4 bg-[#FF80FF] border-2 border-black w-8 h-8 rounded-full flex items-center justify-center font-black">{tIdx + 1}</div>
                                            {messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((pair, idx) => (
                                                <div key={pair.id} className="space-y-6 border-b-4 border-dashed border-black pb-8 last:border-0 last:pb-0">
                                                    {/* Q */}
                                                    <div className="bg-black text-white p-6 md:p-8 block border-4 border-black transition-transform hover:-translate-y-1 shadow-[4px_4px_0px_0px_rgba(212,255,0,1)]">
                                                        <span className="text-xs uppercase tracking-[0.2em] font-black opacity-80 mb-2 block text-[#D4FF00]">
                                                            {idx === 0 ? 'Anonymous Ask' : 'Follow-up Ask'}
                                                        </span>
                                                        <div className="text-xl md:text-3xl font-bold uppercase leading-snug">
                                                            {pair.content}
                                                        </div>
                                                    </div>

                                                    {/* A */}
                                                    {(() => {
                                                        const reply = Array.isArray(pair.replies) ? pair.replies[0] : pair.replies;
                                                        if (!reply || !reply.content) return null;

                                                        return (
                                                            <div className="ml-8 md:ml-16 bg-[#1C7BFF] text-black p-6 md:p-8 border-4 border-black transition-transform hover:-translate-y-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
                                                                <span className="text-xs uppercase tracking-[0.2em] font-black mb-2 block w-full text-right">
                                                                    Official Response @{profile.username}
                                                                </span>
                                                                <div className="text-xl md:text-3xl font-bold uppercase leading-snug text-right">
                                                                    {reply.content}
                                                                </div>

                                                                {currentUserId && (
                                                                    <div className="flex items-center justify-end gap-6 mt-6">
                                                                        <button
                                                                            onClick={() => handleSocialAction(pair.id, 'like', pair.is_liked)}
                                                                            className="flex items-center gap-2 group transition-all"
                                                                        >
                                                                            <Heart className={`w-8 h-8 transition-transform group-hover:scale-110 ${pair.is_liked ? 'fill-[#FF80FF] text-[#FF80FF]' : 'text-black'}`} />
                                                                            <span className="text-xl font-black">{pair.likes_count}</span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleSocialAction(pair.id, 'bookmark', pair.is_bookmarked)}
                                                                            className="flex items-center gap-2 group transition-all"
                                                                        >
                                                                            <Bookmark className={`w-8 h-8 transition-transform group-hover:scale-110 ${pair.is_bookmarked ? 'fill-black text-black' : 'text-black'}`} />
                                                                            <span className="text-xl font-black">{pair.bookmarks_count}</span>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ))}

                                            {messages[0].sender_id === currentUserId && (
                                                <button
                                                    onClick={() => {
                                                        setReplyingToThread(threadId);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="w-full bg-[#D4FF00] border-4 border-black py-4 font-black uppercase text-xl hover:bg-black hover:text-[#D4FF00] transition-colors"
                                                >
                                                    + Ask Follow-up
                                                </button>
                                            )}
                                        </motion.div>
                                    ));
                                })()
                            )}
                        </AnimatePresence>
                    </div>
                </section>
            </main>
        </div>
    );
}
