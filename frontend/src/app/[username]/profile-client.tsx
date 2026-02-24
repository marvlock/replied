'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import { LoadingScreen } from '@/components/loading-screen';

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
    replies: any;
}

export default function PublicProfileClient({ username }: { username: string }) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [publishedPairs, setPublishedPairs] = useState<Conversation[]>([]);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [minLoading, setMinLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setMinLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/profile/${username}`);
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
                })
            });

            if (response.ok) {
                toast.success('Message sent! It will appear if replied to.');
                setMessage('');
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

    if (loading || minLoading) return <LoadingScreen />;
    if (!profile) return <div className="min-h-screen flex items-center justify-center text-xl font-bold bg-black text-white">User Not Found</div>;

    return (
        <div className="min-h-screen bg-black text-stone-200 selection:bg-primary/30">
            {/* Background Decor */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-stone-800/20 blur-[120px] rounded-full" />
            </div>

            <main className="relative z-10 max-w-2xl mx-auto px-6 py-20 space-y-24">
                {/* Profile Header & Submission */}
                <section className="space-y-12">
                    <motion.header
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-6"
                    >
                        <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-stone-800 to-stone-950 p-1 shadow-2xl">
                            <div className="w-full h-full rounded-full overflow-hidden bg-black flex items-center justify-center border border-white/10">
                                {profile.avatar_url ? (
                                    <Image
                                        src={profile.avatar_url}
                                        alt={profile.display_name || 'Profile'}
                                        width={96}
                                        height={96}
                                        unoptimized
                                        className="w-full h-full object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-700"
                                    />
                                ) : (
                                    <span className="text-3xl font-light text-stone-500">{profile.username[0].toUpperCase()}</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h1 className="text-4xl font-extrabold tracking-tighter text-stone-100 uppercase">
                                    {profile.display_name || profile.username}
                                </h1>
                                <p className="text-stone-600 font-mono text-[10px] uppercase tracking-[0.4em] font-black">
                                    @{profile.username}
                                </p>
                            </div>
                            {profile.bio && (
                                <p className="max-w-md mx-auto text-stone-400 leading-relaxed italic text-sm font-serif">
                                    &quot;{profile.bio}&quot;
                                </p>
                            )}
                            <p className="text-stone-500 font-mono text-[9px] uppercase tracking-[0.3em] opacity-40">Curated Conversations</p>
                        </div>
                    </motion.header>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="border-stone-800/50 bg-stone-950/40 backdrop-blur-2xl shadow-2xl overflow-hidden rounded-[32px]">
                            <CardContent className="p-2 space-y-2">
                                {profile.is_paused ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                            <Lock className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-white font-bold">Inbox Paused</h3>
                                            <p className="text-stone-500 text-sm max-w-xs mx-auto">This user has temporarily paused new messages. Check back later!</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Textarea
                                            placeholder="Ask me anything anonymously..."
                                            className="min-h-[180px] bg-transparent border-none focus-visible:ring-0 text-xl p-8 resize-none text-stone-200 placeholder:text-stone-800 transition-all duration-300 font-serif"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            maxLength={500}
                                        />

                                        <div className="flex items-center justify-between px-8 pb-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-mono text-stone-700 uppercase tracking-widest font-bold">
                                                    Character Count
                                                </span>
                                                <span className="text-xs font-mono text-stone-500">
                                                    {message.length} / 500
                                                </span>
                                            </div>
                                            <Button
                                                disabled={sending || !message.trim()}
                                                onClick={handleSubmit}
                                                className="bg-white text-black hover:bg-stone-200 h-14 px-10 rounded-2xl font-bold text-sm shadow-2xl transition-all active:scale-95 disabled:opacity-20"
                                            >
                                                {sending ? 'Sending...' : 'Send Message'}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </section>

                {/* Conversation Feed */}
                <section className="space-y-12">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-stone-800" />
                        <span className="text-[10px] font-mono text-stone-600 uppercase tracking-[0.3em]">The Record</span>
                        <div className="h-px flex-1 bg-stone-800" />
                    </div>

                    <div className="space-y-16">
                        <AnimatePresence mode="popLayout">
                            {publishedPairs.length === 0 ? (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center text-stone-700 italic font-serif"
                                >
                                    No conversations public yet.
                                </motion.p>
                            ) : (
                                publishedPairs.map((pair, idx) => (
                                    <motion.div
                                        key={pair.id}
                                        initial={{ opacity: 0, y: 40 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, margin: "-100px" }}
                                        transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.21, 0.45, 0.32, 0.9] }}
                                        className="relative"
                                    >
                                        <div className="space-y-8">
                                            {/* Question */}
                                            <div className="max-w-[85%] space-y-3 text-left">
                                                <div className="flex items-center gap-2 px-1">
                                                    <div className="w-1 h-1 rounded-full bg-stone-500" />
                                                    <span className="text-[9px] font-mono text-stone-500 uppercase tracking-[0.2em] font-bold">Anonymous Ask</span>
                                                </div>
                                                <div className="p-6 rounded-[28px] rounded-tl-none bg-white/[0.02] border border-white/5 text-stone-300 leading-relaxed italic font-serif text-lg shadow-inner">
                                                    &quot;{pair.content}&quot;
                                                </div>
                                            </div>

                                            {/* Response */}
                                            {(() => {
                                                const reply = Array.isArray(pair.replies) ? pair.replies[0] : pair.replies;
                                                if (!reply || !reply.content) return null;

                                                return (
                                                    <div className="ml-auto max-w-[92%] space-y-3 text-right">
                                                        <div className="flex items-center justify-end gap-2 px-1">
                                                            <span className="text-[9px] font-mono text-stone-500 uppercase tracking-[0.2em] font-bold">Official Response</span>
                                                            <div className="h-px w-4 bg-stone-800" />
                                                            <span className="text-[9px] font-mono text-white uppercase tracking-widest font-black">@{profile.username}</span>
                                                        </div>
                                                        <div className="p-8 rounded-[32px] rounded-br-none bg-gradient-to-br from-stone-800 via-stone-900 to-black text-white leading-relaxed shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-serif text-lg border border-white/5 relative overflow-hidden group">
                                                            {/* Subtle inner glow */}
                                                            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
                                                            <div className="relative z-10">
                                                                {reply.content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </section>

                <footer className="pt-20 text-center space-y-4">
                    <div className="text-[10px] font-mono text-stone-700 uppercase tracking-widest">
                        Built with Replied
                    </div>
                </footer>
            </main>
        </div>
    );
}
