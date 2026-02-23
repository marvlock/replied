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
import { User, Shield, Share2, ArrowLeft, Copy, Check, QrCode, Lock, Ghost, X } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasCopied, setHasCopied] = useState(false);

    const [formData, setFormData] = useState({
        display_name: '',
        bio: '',
        username: '',
        avatar_url: '',
        is_paused: false,
        blocked_phrases: [] as string[]
    });

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user?.id)
            .single();

        if (data) {
            setFormData({
                display_name: data.display_name || '',
                bio: data.bio || '',
                username: data.username || '',
                avatar_url: data.avatar_url || '',
                is_paused: data.is_paused || false,
                blocked_phrases: data.blocked_phrases || []
            });
        }
        setLoading(false);
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
        } catch (error) {
            toast.error('Connection error');
        } finally {
            setSaving(false);
        }
    };

    const copyLink = () => {
        const link = `${window.location.origin}/${formData.username}`;
        navigator.clipboard.writeText(link);
        setHasCopied(true);
        toast.success('Public link copied to clipboard!');
        setTimeout(() => setHasCopied(false), 2000);
    };

    if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-black text-stone-200 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-12">
                <header className="flex items-center justify-between">
                    <Link href="/inbox" className="group flex items-center gap-2 text-stone-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Inbox
                    </Link>
                    <h1 className="text-xl font-bold tracking-tighter">Settings</h1>
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
                                    {typeof window !== 'undefined' ? `${window.location.host}/${formData.username}` : ''}
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
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.host}/${formData.username}` : '')}`}
                                                    alt="QR Code"
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
                                    onCheckedChange={(checked: boolean) => setFormData({ ...formData, is_paused: checked })}
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
                                                    setFormData({ ...formData, blocked_phrases: [...formData.blocked_phrases, val] });
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
                                                onClick={() => setFormData({ ...formData, blocked_phrases: formData.blocked_phrases.filter(p => p !== phrase) })}
                                                className="hover:text-white"
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
                                    className="bg-stone-950 border-stone-800 focus:border-stone-600 min-h-[120px] rounded-xl resize-none"
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
