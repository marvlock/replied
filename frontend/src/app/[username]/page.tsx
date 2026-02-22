import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import PublicProfileClient from './profile-client';

interface Props {
    params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username } = await params;
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

    if (!profile) return { title: 'User Not Found | Replied' };

    const title = `Message ${profile.display_name || username} | Replied`;
    const description = profile.bio || `Send me an anonymous message and I'll publish my favorite responses.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [profile.avatar_url || '/og-image.png'],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        }
    };
}

export default async function Page({ params }: Props) {
    const { username } = await params;
    return <PublicProfileClient username={username} />;
}
