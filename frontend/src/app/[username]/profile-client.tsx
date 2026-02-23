'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';

export default function PublicProfileClient({ username }: { username: string }) {
    const { user, signInWithGoogle, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [publishedPairs, setPublishedPairs] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            // 1. Fetch Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', username)
                .single();

            if (profileError) {
                console.error('Error fetching profile:', profileError);
                setLoading(false);
                return;
            }
            setProfile(profileData);

            // 2. Fetch Published Conversations
            const { data: messagesData, error: messagesError } = await supabase
                .from('messages')
                .select(`
          id,
          content,
          created_at,
          replies (
            content,
            created_at
          )
        `)
                .eq('receiver_id', profileData.id)
                .eq('status', 'replied')
                .order('created_at', { ascending: false });

            if (messagesError) {
                console.error('Error fetching conversations:', messagesError);
            } else {
                setPublishedPairs(messagesData || []);
            }

            setLoading(false);
        }
        fetchData();
    }, [username]);

    const handleSubmit = async () => {
        if (!message.trim()) {
            toast.error('Message cannot be empty');
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
        } catch (error: any) {
            toast.error('Connection error');
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white font-mono uppercase tracking-tighter">Loading...</div>;
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
                                    <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover grayscale opacity-80 hover:grayscale-0 transition-all duration-700" />
                                ) : (
                                    <span className="text-3xl font-light text-stone-500">{profile.display_name?.[0]}</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold tracking-tighter text-white">{profile.display_name || profile.username}</h1>
                            {profile.bio && (
                                <p className="max-w-md mx-auto text-stone-400 leading-relaxed italic text-sm">
                                    "{profile.bio}"
                                </p>
                            )}
                            <p className="text-stone-500 font-mono text-[9px] uppercase tracking-[0.3em]">Curated Conversations</p>
                        </div>
                    </motion.header>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="border-stone-800/50 bg-stone-900/40 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
                            <CardContent className="p-6 space-y-4">
                                {profile.is_paused ? (
                                    <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
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
                                            className="min-h-[140px] bg-transparent border-none focus-visible:ring-0 text-lg p-0 resize-none text-stone-200 placeholder:text-stone-600 shadow-none focus:ring-0"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            maxLength={500}
                                        />

                                        <div className="flex items-center justify-between pt-4 border-t border-stone-800/50">
                                            <span className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">
                                                {message.length}/500
                                            </span>
                                            <Button
                                                disabled={sending || !message.trim()}
                                                onClick={handleSubmit}
                                                size="sm"
                                                className="bg-stone-100 text-black hover:bg-white rounded-full px-6 font-bold text-xs shadow-xl shadow-white/5 active:scale-95 transition-all"
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
                                            <div className="max-w-[85%] space-y-2 text-left">
                                                <span className="text-[9px] font-mono text-stone-600 uppercase tracking-widest">Anonymous Ask</span>
                                                <div className="p-5 rounded-2xl rounded-tl-none bg-stone-900/30 border border-stone-800/50 text-stone-400 leading-relaxed italic">
                                                    "{pair.content}"
                                                </div>
                                            </div>

                                            {/* Response */}
                                            {pair.replies?.[0] && (
                                                <div className="ml-auto max-w-[85%] space-y-2 text-right">
                                                    <span className="text-[9px] font-mono text-stone-500 uppercase tracking-widest">{profile.display_name || profile.username}'s Reply</span>
                                                    <div className="p-6 rounded-3xl rounded-br-none bg-gradient-to-br from-stone-800/40 to-black border border-white/5 text-white leading-relaxed shadow-2xl">
                                                        {pair.replies[0].content}
                                                    </div>
                                                </div>
                                            )}
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
