'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { AtSign, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingScreen } from '@/components/loading-screen';

export default function SetupPage() {
    const [username, setUsername] = useState('');
    const [checking, setChecking] = useState(false);
    const [available, setAvailable] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [minLoading, setMinLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setMinLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);
    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/');
                return;
            }

            // If profile already exists with username, go to inbox
            const { data: profile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', session.user.id)
                .single();

            if (profile?.username) {
                router.push('/inbox');
            } else {
                setCheckingAuth(false);
            }
        }
        checkAuth();
    }, [router]);

    // Check username availability
    useEffect(() => {
        if (username.length < 3) {
            setAvailable(null);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setChecking(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', username.toLowerCase())
                .maybeSingle();

            if (!error) {
                setAvailable(!data);
            }
            setChecking(false);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [username]);

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!available || username.length < 3) return;

        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            toast.error('Session expired. Please sign in again.');
            router.push('/');
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: session.user.id,
                username: username.toLowerCase(),
                display_name: username.toLowerCase(),
                avatar_url: session.user.user_metadata.avatar_url || '',
                email: session.user.email,
                updated_at: new Date().toISOString(),
            });

        if (error) {
            toast.error(error.message);
            setLoading(false);
        } else {
            toast.success('Profile created! Welcome to Replied.');
            router.push('/inbox');
        }
    };

    if (checkingAuth || minLoading) {
        return <LoadingScreen />;
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-white/30 flex items-center justify-center px-6 relative overflow-hidden">
            {/* Background Auras */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-stone-900/40 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-stone-900/20 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="text-center mb-10 space-y-2">
                    <h1 className="text-4xl font-bold tracking-tighter">Claim Your Handle</h1>
                    <p className="text-stone-500 font-light">This will be your permanent public link.</p>
                </div>

                <Card className="bg-stone-950/50 border-stone-800/50 backdrop-blur-xl shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-xl">Choose a username</CardTitle>
                        <CardDescription>Letters, numbers, and underscores only. Min 3 chars.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSetup} className="space-y-6">
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500">
                                    <AtSign className="w-4 h-4" />
                                </div>
                                <Input
                                    placeholder="username"
                                    className="pl-11 h-12 bg-black/50 border-stone-800 focus:border-white transition-all rounded-xl text-lg lowercase"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                    maxLength={30}
                                    required
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {checking && <Loader2 className="w-4 h-4 text-stone-500 animate-spin" />}
                                    {!checking && available === true && username.length >= 3 && (
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    )}
                                    {!checking && available === false && username.length >= 3 && (
                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                    )}
                                </div>
                            </div>

                            {available === false && username.length >= 3 && (
                                <p className="text-red-500 text-xs font-mono uppercase tracking-widest pl-1">
                                    Handle already taken
                                </p>
                            )}

                            <div className="pt-2">
                                <span className="text-[10px] text-stone-600 font-serif uppercase tracking-widest block mb-4 italic">
                                    replied.to/{username || 'username'}
                                </span>
                                <Button
                                    type="submit"
                                    disabled={!available || loading || username.length < 3}
                                    className="w-full h-12 rounded-xl bg-white text-black hover:bg-stone-200 font-bold transition-all shadow-xl shadow-white/5 cursor-pointer"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'Complete Setup'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center mt-8 text-stone-600 text-sm font-serif italic tracking-widest">
                    The Record Begins Now
                </p>
            </motion.div>
        </div>
    );
}
