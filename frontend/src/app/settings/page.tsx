'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { User, Shield, Share2, ArrowLeft, Copy, Check, QrCode, Lock, Ghost, X, AlertTriangle, Twitter, Instagram, MessageCircle, Camera, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/loading-screen';

export default function SettingsPage() {
    const { user, hasUsername, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
            return;
        }
        if (!authLoading && user && hasUsername === false) {
            router.push('/setup');
            return;
        }
    }, [user, authLoading, hasUsername, router]);

    const [loading, setLoading] = useState(true);
    const [minLoading, setMinLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMinLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);
    const [deleting, setDeleting] = useState(false);
    const [hasCopied, setHasCopied] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [formData, setFormData] = useState({
        display_name: '',
        bio: '',
        username: '',
        avatar_url: '',
        is_paused: false,
        blocked_phrases: [] as string[]
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            const { data: { session } } = await supabase.auth.getSession();
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/profile`, {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setFormData({
                        display_name: data.display_name || '',
                        bio: data.bio || '',
                        username: data.username || '',
                        avatar_url: data.avatar_url || '',
                        is_paused: data.is_paused || false,
                        blocked_phrases: data.blocked_phrases || []
                    });
                }
            } catch (err) {
                console.error('Failed to fetch profile:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchProfile();
        }
    }, [user]);

    const handleTogglePause = async (checked: boolean) => {
        // Optimistic update
        setFormData(prev => ({ ...prev, is_paused: checked }));

        const { data: { session } } = await supabase.auth.getSession();
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/profile/toggle-pause`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ is_paused: checked })
            });

            if (!response.ok) {
                // Revert if failed
                setFormData(prev => ({ ...prev, is_paused: !checked }));
                toast.error('Failed to update status');
            } else {
                toast.success(checked ? 'Inbox paused' : 'Inbox active');
            }
        } catch {
            setFormData(prev => ({ ...prev, is_paused: !checked }));
            toast.error('Connection error');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image must be less than 2MB');
            return;
        }

        setUploading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${session.user.id}/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. Update local state
            setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
            toast.success('Image uploaded! Remember to save changes.');
        } catch (error: any) {
            console.error('Storage error:', error);
            toast.error(error.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateBlockedPhrases = async (newPhrases: string[]) => {
        setFormData(prev => ({ ...prev, blocked_phrases: newPhrases }));

        const { data: { session } } = await supabase.auth.getSession();
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/profile/blocked-phrases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ phrases: newPhrases })
            });

            if (!response.ok) {
                toast.error('Failed to update phrases');
            }
        } catch {
            toast.error('Connection error');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const { data: { session } } = await supabase.auth.getSession();

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                toast.success('Profile updated successfully');
            } else {
                toast.error('Failed to update profile');
            }
        } catch {
            toast.error('Connection error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeleteDialogOpen(false);

        setDeleting(true);
        const { data: { session } } = await supabase.auth.getSession();

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/profile`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (response.ok) {
                toast.success('Account deleted. Goodbye!');
                await supabase.auth.signOut();
                window.location.href = '/';
            } else {
                toast.error('Failed to delete account');
            }
        } catch {
            toast.error('Connection error');
        } finally {
            setDeleting(false);
        }
    };

    const copyLink = () => {
        const link = `${window.location.origin}/${formData.username}`;
        navigator.clipboard.writeText(link);
        setHasCopied(true);
        toast.success('Public link copied to clipboard!');
        setTimeout(() => setHasCopied(false), 2000);
    };

    if (authLoading || loading || minLoading) return <LoadingScreen />;

    return (
        <div className="min-h-screen bg-[#1C7BFF] text-black selection:bg-[#D4FF00] selection:text-black font-sans pb-24">
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#D4FF00] border-b-4 border-black flex items-center gap-4">
                <Link href="/inbox" className="shrink-0">
                    <button className="w-10 h-10 md:w-12 md:h-12 bg-white border-4 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                </Link>
                <div className="text-2xl font-black uppercase tracking-tighter">
                    Settings
                </div>
            </nav>

            <main className="pt-32 max-w-2xl mx-auto px-6 space-y-12">
                {/* Sharing Link Block */}
                <section className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-2 mb-6">
                        <Share2 className="w-8 h-8 fill-black" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Your Identity</h2>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 bg-black text-white p-4 font-bold border-4 border-black overflow-hidden whitespace-nowrap text-lg md:text-xl">
                                {typeof window !== 'undefined' ? `${window.location.origin.replace(/^https?:\/\//, '')}/${formData.username}` : ''}
                            </div>
                            <button
                                onClick={copyLink}
                                className="bg-[#D4FF00] hover:bg-black hover:text-[#D4FF00] border-4 border-black px-6 py-4 font-black uppercase transition-colors shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
                            >
                                {hasCopied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                                Copy
                            </button>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <button className="bg-[#FF80FF] hover:bg-black hover:text-[#FF80FF] border-4 border-black px-6 py-4 font-black uppercase transition-colors shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
                                        <QrCode className="w-6 h-6" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="bg-white border-4 border-black p-0 overflow-hidden shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] rounded-none [&>button]:bg-black [&>button]:text-white [&>button]:border-2 [&>button]:border-black [&>button]:rounded-none [&>button]:top-4 [&>button]:right-4 [&>button]:opacity-100">
                                    <DialogHeader className="bg-[#D4FF00] p-6 border-b-4 border-black">
                                        <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-black">QR Code</DialogTitle>
                                    </DialogHeader>
                                    <div className="p-8 flex flex-col items-center justify-center bg-white space-y-6">
                                        <div className="p-4 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                            <Image
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/${formData.username}` : '')}`}
                                                alt="QR Code"
                                                width={192}
                                                height={192}
                                                unoptimized
                                                className="w-48 h-48"
                                            />
                                        </div>
                                        <p className="text-xl font-black uppercase tracking-widest text-black">
                                            Scan for @{formData.username}
                                        </p>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => {
                                    const link = `${window.location.origin}/${formData.username}`;
                                    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`Send me anonymous messages on Replied! 📝`)}&url=${encodeURIComponent(link)}`, '_blank');
                                }}
                                className="bg-[#1C7BFF] hover:bg-black text-black hover:text-white border-4 border-black px-6 flex-1 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                            >
                                <Twitter className="w-5 h-5 fill-current shrink-0" /> Share on X
                            </button>
                            <button
                                onClick={() => {
                                    const link = `${window.location.origin}/${formData.username}`;
                                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Send me anonymous messages on Replied! 📝 ${link}`)}`, '_blank');
                                }}
                                className="bg-[#D4FF00] hover:bg-black text-black hover:text-[#D4FF00] border-4 border-black px-6 flex-1 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 transition-colors"
                            >
                                <MessageCircle className="w-5 h-5" /> WhatsApp
                            </button>
                            <button
                                onClick={copyLink}
                                className="bg-[#FF80FF] hover:bg-black text-black hover:text-[#FF80FF] border-4 border-black px-6 flex-1 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 transition-colors"
                            >
                                <Instagram className="w-5 h-5" /> IG Story
                            </button>
                        </div>
                    </div>
                </section>

                {/* Moderation Block */}
                <section className="bg-[#FF80FF] border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-2 mb-6 text-black">
                        <Shield className="w-8 h-8 fill-black" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Moderation</h2>
                    </div>

                    <div className="space-y-8">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-4">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black uppercase flex items-center gap-2">
                                    <Lock className="w-6 h-6 fill-black" /> Pause Inbox
                                </h3>
                                <p className="text-lg font-bold">Stop new messages.</p>
                            </div>
                            <Switch
                                checked={formData.is_paused}
                                onCheckedChange={handleTogglePause}
                                className="data-[state=checked]:bg-[#FF80FF] data-[state=unchecked]:bg-[#1C7BFF] border-4 border-black h-10 w-20 shadow-none [&>span]:h-8 [&>span]:w-8 [&>span]:data-[state=checked]:translate-x-10 [&>span]:border-black [&>span]:bg-white"
                            />
                        </div>

                        <div className="p-6 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black uppercase flex items-center gap-2">
                                    <Ghost className="w-6 h-6 fill-black" /> Blocked Phrases
                                </h3>
                                <p className="text-lg font-bold">Reject messages with these words.</p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4">
                                <Input
                                    placeholder="Add word..."
                                    className="flex-1 border-4 border-black bg-[#D4FF00] h-14 rounded-none text-xl font-bold shadow-inner placeholder:text-black/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value.trim();
                                            if (val && !formData.blocked_phrases.includes(val)) {
                                                handleUpdateBlockedPhrases([...formData.blocked_phrases, val]);
                                                e.currentTarget.value = '';
                                            }
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {formData.blocked_phrases.map((phrase) => (
                                    <div key={phrase} className="flex items-center gap-2 px-4 py-2 bg-black text-white font-bold uppercase border-4 border-black text-sm shadow-[4px_4px_0px_0px_rgba(28,123,255,1)]">
                                        {phrase}
                                        <button
                                            onClick={() => handleUpdateBlockedPhrases(formData.blocked_phrases.filter(p => p !== phrase))}
                                            className="hover:text-[#FF80FF] transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                                {formData.blocked_phrases.length === 0 && <span className="font-bold text-xl uppercase opacity-50">Empty</span>}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Profile Block */}
                <section className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-center gap-2 mb-6">
                        <User className="w-8 h-8 fill-black" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Public Info</h2>
                    </div>

                    <div className="space-y-8">
                        <div className="flex flex-col items-center gap-6 pb-8 border-b-4 border-dashed border-black">
                            <div className="relative group">
                                <div className="w-32 h-32 md:w-40 md:h-40 bg-[#D4FF00] border-4 border-black rounded-full overflow-hidden flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative">
                                    {formData.avatar_url ? (
                                        <Image
                                            src={formData.avatar_url}
                                            alt="Profile"
                                            width={160}
                                            height={160}
                                            unoptimized
                                            className={`w-full h-full object-cover grayscale transition-opacity ${uploading ? 'opacity-30' : 'opacity-100'}`}
                                        />
                                    ) : (
                                        <span className="text-6xl font-black">{formData.username?.[0]?.toUpperCase()}</span>
                                    )}
                                    {uploading && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-black animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <label className="absolute bottom-0 right-0 w-12 h-12 rounded-full bg-black text-white flex items-center justify-center cursor-pointer hover:bg-[#FF80FF] hover:text-black transition-colors border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <Camera className="w-6 h-6" />
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xl font-black uppercase text-black block">Handle</label>
                            <Input
                                value={formData.username}
                                readOnly
                                className="bg-white text-black border-4 border-black h-14 rounded-none text-xl font-bold uppercase cursor-not-allowed opacity-70 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xl font-black uppercase text-black block">Display Name</label>
                            <Input
                                value={formData.display_name}
                                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                className="bg-white border-4 border-black focus:border-black h-14 rounded-none text-xl font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                placeholder="YOUR NAME"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xl font-black uppercase text-black block">Bio</label>
                            <Textarea
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                className="bg-white border-4 border-black focus:border-black min-h-[160px] rounded-none text-xl font-bold resize-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                placeholder="TELL THE WORLD..."
                            />
                        </div>

                        <button
                            disabled={saving}
                            onClick={handleSave}
                            className="w-full bg-black text-white hover:bg-[#1C7BFF] hover:text-black border-4 border-black h-16 text-2xl font-black uppercase tracking-widest transition-colors shadow-[8px_8px_0px_0px_rgba(212,255,0,1)] disabled:opacity-50"
                        >
                            {saving ? 'SAVING...' : 'SAVE PROFILE'}
                        </button>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="bg-[#FF4040] border-4 border-black p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-12">
                    <div className="flex items-center gap-2 mb-6">
                        <AlertTriangle className="w-8 h-8 fill-black text-black" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">DANGER ZONE</h2>
                    </div>
                    
                    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <DialogTrigger asChild>
                            <button
                                disabled={deleting}
                                className="w-full bg-black text-white hover:bg-white hover:text-red-600 border-4 border-black h-16 text-2xl font-black uppercase tracking-widest transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                            >
                                DELETE ACCOUNT
                            </button>
                        </DialogTrigger>
                        <DialogContent className="bg-white border-4 border-black p-0 overflow-hidden shadow-[16px_16px_0px_0px_rgba(255,64,64,1)] rounded-none">
                            <DialogHeader className="bg-black text-white p-6 border-b-4 border-black">
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-red-500 whitespace-nowrap overflow-hidden text-ellipsis">A U SURE?</DialogTitle>
                            </DialogHeader>
                            <div className="p-8 space-y-8 bg-white text-black">
                                <p className="text-2xl font-bold uppercase leading-tight">
                                    THIS WILL DELETE EVERYTHING. CANNOT UNDO.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button
                                        onClick={() => setIsDeleteDialogOpen(false)}
                                        className="flex-1 bg-white hover:bg-black hover:text-white border-4 border-black py-4 text-xl font-black uppercase transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                    >
                                        NEVERMIND
                                    </button>
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={deleting}
                                        className="flex-1 bg-red-600 hover:bg-black text-white border-4 border-black py-4 text-xl font-black uppercase transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                    >
                                        {deleting ? 'DELETING...' : 'BURN IT'}
                                    </button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </section>
            </main>
        </div>
    );
}
