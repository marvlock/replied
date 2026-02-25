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
        <div className="min-h-screen bg-black text-stone-200 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-12">
                <header className="flex items-center gap-4 md:gap-6 mb-12 mt-2">
                    <Link href="/inbox" className="shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-stone-900/40 border border-stone-800/50 hover:bg-white hover:text-black transition-all shadow-xl group"
                        >
                            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 group-hover:-translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white uppercase italic leading-none">Settings</h1>
                        <p className="text-stone-500 text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] mt-2">Account Configuration</p>
                    </div>
                </header>

                {/* Sharing Link Card */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="bg-stone-900/30 border-stone-800 shadow-2xl">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-primary mb-2">
                                <Share2 className="w-4 h-4" />
                                <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Your Identity</span>
                            </div>
                            <CardTitle className="text-white">Sharing Link</CardTitle>
                            <CardDescription className="text-stone-500">Share this URL on your social bios to receive messages.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <div className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-400 font-mono overflow-hidden whitespace-nowrap">
                                    {typeof window !== 'undefined' ? `${window.location.origin.replace(/^https?:\/\//, '')}/${formData.username}` : ''}
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={copyLink}
                                    className="border-stone-800 bg-transparent text-stone-400 hover:text-white rounded-xl px-4"
                                >
                                    {hasCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="bg-white text-black hover:bg-stone-200 rounded-xl px-4">
                                            <QrCode className="w-4 h-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-stone-950 border-stone-800 text-white max-w-sm">
                                        <DialogHeader>
                                            <DialogTitle>Your Profile QR Code</DialogTitle>
                                        </DialogHeader>
                                        <div className="flex flex-col items-center justify-center p-8 space-y-6">
                                            <div className="p-4 bg-white rounded-2xl">
                                                <Image
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/${formData.username}` : '')}`}
                                                    alt="QR Code"
                                                    width={192}
                                                    height={192}
                                                    unoptimized
                                                    className="w-48 h-48"
                                                />
                                            </div>
                                            <p className="text-center text-xs text-stone-500 font-mono uppercase tracking-widest">
                                                Scan to visit @{formData.username}
                                            </p>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const link = `${window.location.origin}/${formData.username}`;
                                        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(`Send me anonymous messages on Replied! 📝`)}&url=${encodeURIComponent(link)}`, '_blank');
                                    }}
                                    className="border-stone-800 bg-stone-950 text-stone-400 hover:text-white hover:border-stone-600 rounded-xl gap-2 h-10 px-4 flex-1 sm:flex-none"
                                >
                                    <Twitter className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Share on X</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const link = `${window.location.origin}/${formData.username}`;
                                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Send me anonymous messages on Replied! 📝 ${link}`)}`, '_blank');
                                    }}
                                    className="border-stone-800 bg-stone-950 text-stone-400 hover:text-white hover:border-stone-600 rounded-xl gap-2 h-10 px-4 flex-1 sm:flex-none"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={copyLink}
                                    className="border-stone-800 bg-stone-950 text-stone-400 hover:text-white hover:border-stone-600 rounded-xl gap-2 h-10 px-4 flex-1 sm:flex-none"
                                >
                                    <Instagram className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">IG Story</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Moderation Controls */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <Card className="bg-stone-900/30 border-stone-800 shadow-2xl">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-red-500 mb-2">
                                <Shield className="w-4 h-4" />
                                <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Safety</span>
                            </div>
                            <CardTitle className="text-white">Moderation</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-stone-950 border border-stone-800">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-medium text-stone-200">
                                        <Lock className="w-4 h-4 text-stone-500" />
                                        Pause Inbox
                                    </div>
                                    <p className="text-xs text-stone-500">Stop receiving new messages temporarily.</p>
                                </div>
                                <Switch
                                    checked={formData.is_paused}
                                    onCheckedChange={handleTogglePause}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-medium text-stone-200">
                                        <Ghost className="w-4 h-4 text-stone-500" />
                                        Blocked Phrases
                                    </div>
                                    <p className="text-xs text-stone-500">Messages containing these words will be rejected.</p>
                                </div>

                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add word or phrase..."
                                        className="bg-stone-950 border-stone-800 h-10 rounded-xl"
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

                                <div className="flex flex-wrap gap-2">
                                    {formData.blocked_phrases.map((phrase) => (
                                        <div key={phrase} className="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-800 text-stone-300 text-xs border border-stone-700">
                                            {phrase}
                                            <button
                                                onClick={() => handleUpdateBlockedPhrases(formData.blocked_phrases.filter(p => p !== phrase))}
                                                className="hover:text-white cursor-pointer"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Profile Details */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="bg-stone-900/30 border-stone-800 shadow-2xl">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-stone-500 mb-2">
                                <User className="w-4 h-4" />
                                <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Public Info</span>
                            </div>
                            <CardTitle className="text-white">Profile Customization</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col items-center gap-6 pb-6 border-b border-stone-800/50">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full overflow-hidden bg-stone-900 border-2 border-stone-800 shadow-xl relative">
                                        {formData.avatar_url ? (
                                            <Image
                                                src={formData.avatar_url}
                                                alt="Profile"
                                                width={96}
                                                height={96}
                                                unoptimized
                                                className={`w-full h-full object-cover transition-opacity ${uploading ? 'opacity-30' : 'opacity-100'}`}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-3xl font-light text-stone-700">
                                                {formData.username?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                        {uploading && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center cursor-pointer hover:bg-stone-200 transition-colors shadow-lg border-2 border-black">
                                        <Camera className="w-4 h-4" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                    </label>
                                </div>
                                <div className="text-center">
                                    <p className="text-stone-200 font-bold tracking-tight">Profile Picture</p>
                                    <p className="text-[10px] text-stone-600 uppercase tracking-widest mt-1">PNG, JPG up to 2MB</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-mono uppercase tracking-[0.2em] text-stone-600">Username Handle</label>
                                <Input
                                    value={formData.username}
                                    readOnly
                                    className="bg-stone-900 border-stone-800 text-stone-500 h-12 rounded-xl cursor-not-allowed"
                                    placeholder="yourhandle"
                                />
                                <p className="text-[10px] text-stone-600 font-mono">This is your unique link identifier and cannot be changed.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-mono uppercase tracking-[0.2em] text-stone-600">Display Name</label>
                                <Input
                                    value={formData.display_name}
                                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    className="bg-stone-950 border-stone-800 focus:border-stone-600 h-12 rounded-xl"
                                    placeholder="Your Name"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-mono uppercase tracking-[0.2em] text-stone-600">Public Bio</label>
                                <Textarea
                                    value={formData.bio}
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                    className="bg-stone-950 border-stone-800 focus:border-stone-600 min-h-[120px] rounded-xl resize-none font-serif"
                                    placeholder="Tell people what kind of messages you're looking for..."
                                />
                            </div>

                            <Button
                                disabled={saving}
                                onClick={handleSave}
                                className="w-full bg-stone-100 text-black hover:bg-white h-12 rounded-xl font-bold shadow-xl shadow-white/5"
                            >
                                {saving ? 'Saving changes...' : 'Save Profile'}
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Danger Zone */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <Card className="bg-stone-900/30 border-red-900/20 shadow-2xl shadow-red-900/5">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-red-500 mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-red-500/80">Danger Zone</span>
                            </div>
                            <CardTitle className="text-red-500">Delete Account</CardTitle>
                            <CardDescription className="text-red-900/60 uppercase text-[9px] font-mono tracking-widest mt-1">Irreversible Action</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        disabled={deleting}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white border-none h-12 rounded-xl font-bold transition-all shadow-xl shadow-red-900/20"
                                    >
                                        Permanently Delete Account
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-stone-950 border-stone-800 text-white max-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-red-500 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5" />
                                            Critical Action
                                        </DialogTitle>
                                        <DialogDescription className="text-stone-400 pt-2">
                                            This will permanently delete your account, your profile, and all received messages. This action **cannot be undone**.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter className="mt-4 gap-2">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setIsDeleteDialogOpen(false)}
                                            className="text-stone-400 hover:text-white hover:bg-white/5"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={handleDeleteAccount}
                                            disabled={deleting}
                                            className="bg-red-600 hover:bg-red-700 text-white font-bold"
                                        >
                                            {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </motion.div>

                <footer className="text-center pt-12 pb-20">
                    <div className="flex items-center justify-center gap-2 text-stone-700">
                        <Shield className="w-4 h-4" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">End-to-end Encrypted Messaging</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
