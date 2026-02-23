'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LoadingScreen } from '@/components/loading-screen';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            // Check URL for errors first
            const params = new URLSearchParams(window.location.search);
            const error = params.get('error');
            const errorDescription = params.get('error_description');

            if (error) {
                console.error('Auth error from URL:', error, errorDescription);
                toast.error(errorDescription || 'Authentication failed');
                router.push('/');
                return;
            }

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                console.error('Session error:', sessionError.message);
                router.push('/?error=auth-failed');
                return;
            }

            if (session) {
                await processProfile(session.user.id);
            } else {
                let sessionFound = false;

                // Wait for the session to be established
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'SIGNED_IN' && session) {
                        sessionFound = true;
                        await processProfile(session.user.id);
                        subscription.unsubscribe();
                    }
                });

                // Fail after 4 seconds if still no session
                setTimeout(() => {
                    subscription.unsubscribe();
                    if (!sessionFound) {
                        router.push('/?error=timeout');
                    }
                }, 4000);
            }
        };

        const processProfile = async (userId: string) => {
            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', userId)
                    .single();

                if (!error && profile?.username) {
                    router.push('/inbox');
                } else {
                    router.push('/setup');
                }
            } catch {
                router.push('/setup');
            }
        };

        handleCallback();
    }, [router]);

    return <LoadingScreen />;
}
