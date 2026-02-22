'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            const { error } = await supabase.auth.getSession();
            if (error) {
                console.error('Error in auth callback:', error.message);
                router.push('/login?error=auth-failed');
            } else {
                router.push('/inbox');
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
        </div>
    );
}
