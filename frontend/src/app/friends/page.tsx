'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserMinus, Check, X, Search, Users, Activity, Clock, MessageSquare, ArrowLeft, Inbox as InboxIcon, History, Bookmark, Heart, User } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingScreen } from '@/components/loading-screen';
import Link from 'next/link';

export default function FriendsPage() {
    const [activeTab, setActiveTab] = useState<'list' | 'requests' | 'search'>('list');
    const [loading, setLoading] = useState(true);
    const [friendsList, setFriendsList] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (activeTab === 'list') fetchFriendsList();
        if (activeTab === 'requests') fetchRequests();
    }, [activeTab]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'search') {
                handleSearch();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, activeTab]);

    const fetchFriendsList = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/friends/list`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (resp.ok) setFriendsList(await resp.json());
        } catch (err) {
            toast.error('Failed to load friends');
        } finally {
            setLoading(false);
        }
    };

    const fetchRequests = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/friends/requests`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (resp.ok) setRequests(await resp.json());
        } catch (err) {
            toast.error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/users/search?q=${searchQuery}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (resp.ok) setSearchResults(await resp.json());
        } catch (err) {
            toast.error('Search failed');
        } finally {
            setSearching(false);
        }
    };

    const sendRequest = async (userId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/friends/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ receiver_id: userId })
            });
            if (resp.ok) toast.success('Request sent!');
            else {
                const err = await resp.json();
                toast.error(err.error || 'Failed to send request');
            }
        } catch (err) {
            toast.error('Connection error');
        }
    };

    const acceptRequest = async (requestId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/friends/accept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ request_id: requestId })
            });
            if (resp.ok) {
                toast.success('Accepted!');
                fetchRequests();
            }
        } catch (err) {
            toast.error('Failed to accept');
        }
    };

    const unfriend = async (friendshipId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/friends/${friendshipId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (resp.ok) {
                toast.success('Unfriended');
                fetchFriendsList();
            }
        } catch (err) {
            toast.error('Failed to unfriend');
        }
    };

    return (
        <div className="min-h-screen bg-black text-stone-200 p-4 md:p-8 pb-32 md:pb-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex items-center gap-4 md:gap-6 border-b border-stone-800 pb-8 mb-8 mt-2">
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
                        <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white uppercase italic leading-none">Friends</h1>
                        <p className="text-stone-500 text-[10px] md:text-sm font-mono md:font-sans uppercase md:normal-case tracking-[0.2em] md:tracking-normal mt-2">
                            Connections & Network
                        </p>
                    </div>
                </header>

                {/* Navigation Tabs */}
                <div className="flex gap-2 p-1 bg-stone-900/50 rounded-2xl w-fit border border-stone-800">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white text-black shadow-xl' : 'text-stone-500 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Friend List
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all relative ${activeTab === 'requests' ? 'bg-white text-black shadow-xl' : 'text-stone-500 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Requests
                            {requests.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black" />}
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white text-black shadow-xl' : 'text-stone-500 hover:text-white'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            Find Users
                        </div>
                    </button>
                </div>

                <main className="min-h-[400px]">
                    <AnimatePresence mode="wait">
                        {activeTab === 'list' && (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                            >
                                {loading ? (
                                    <div className="col-span-full h-64 flex items-center justify-center">
                                        <LoadingScreen />
                                    </div>
                                ) : friendsList.length > 0 ? (
                                    friendsList.map((friend: any) => (
                                        <Card key={friend.username} className="bg-stone-900/30 border-stone-800 hover:border-stone-700 transition-all group overflow-hidden">
                                            <CardHeader className="flex flex-row items-center gap-4 pb-4">
                                                <div className="w-12 h-12 rounded-full overflow-hidden bg-stone-800 border border-stone-700">
                                                    {friend.avatar_url ? (
                                                        <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-sm font-bold text-stone-500 uppercase">
                                                            {friend.username?.[0]}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <Link href={`/${friend.username}`} className="text-white font-bold hover:underline truncate block">
                                                        @{friend.username}
                                                    </Link>
                                                    <p className="text-xs text-stone-500 truncate">{friend.display_name || friend.username}</p>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => unfriend(friend.friendship_id)}
                                                    className="w-full text-stone-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl font-bold flex items-center gap-2"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                    Unfriend
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="col-span-full py-20 text-center space-y-4 bg-stone-900/20 rounded-3xl border border-dashed border-stone-800">
                                        <Users className="w-12 h-12 text-stone-800 mx-auto" />
                                        <div>
                                            <p className="text-stone-500 font-bold">You haven't added anyone yet.</p>
                                            <p className="text-stone-700 text-sm">Find users to build your circle.</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => setActiveTab('search')}
                                            className="bg-transparent border-stone-800 rounded-xl"
                                        >
                                            Find People
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'requests' && (
                            <motion.div
                                key="requests"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="max-w-md mx-auto space-y-4"
                            >
                                {requests.length > 0 ? (
                                    requests.map((req: any) => (
                                        <div key={req.id} className="flex items-center gap-4 p-4 rounded-2xl bg-stone-900 border border-stone-800">
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-stone-800">
                                                {req.profiles?.avatar_url ? (
                                                    <img src={req.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-bold text-stone-500">
                                                        {req.profiles?.username?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white font-bold">@{req.profiles?.username}</p>
                                                <p className="text-xs text-stone-500 truncate">{req.profiles?.display_name}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="icon"
                                                    onClick={() => acceptRequest(req.id)}
                                                    className="rounded-full bg-white text-black hover:bg-stone-200"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 text-stone-600 italic">No pending requests</div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'search' && (
                            <motion.div
                                key="search"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="max-w-md mx-auto space-y-6"
                            >
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 group-focus-within:text-white transition-colors">
                                        {searching ? (
                                            <div className="w-4 h-4 border-2 border-stone-500 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Search className="w-4 h-4" />
                                        )}
                                    </div>
                                    <Input
                                        placeholder="Search by username..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-14 pl-12 pr-12 bg-stone-900 border-stone-800 rounded-2xl focus:ring-2 focus:ring-white/10 transition-all font-medium placeholder:text-stone-600"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white transition-colors p-1"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {searchResults.map((user: any) => (
                                        <div key={user.id} className="flex items-center gap-4 p-4 rounded-2xl bg-stone-900/50 border border-stone-800/50 hover:bg-stone-900 transition-colors">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-stone-800">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-bold text-stone-500">
                                                        {user.username?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white text-sm font-bold">@{user.username}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => sendRequest(user.id)}
                                                className="border-stone-800 rounded-xl hover:bg-white hover:text-black transition-all"
                                            >
                                                Add Friend
                                            </Button>
                                        </div>
                                    ))}
                                    {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                                        <p className="text-center text-stone-600 text-sm italic">No users found.</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>
                {/* Mobile Navigation (Bottom Bar - iOS style) */}
                <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe-area-inset-bottom">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl border-t border-white/5" />
                    <nav className="relative flex items-center justify-around px-2 py-3">
                        {[
                            { id: 'inbox', label: 'Inbox', icon: <InboxIcon className="w-5 h-5" />, href: '/inbox?tab=inbox' },
                            { id: 'ledger', label: 'Ledger', icon: <History className="w-5 h-5" />, href: '/inbox?tab=history' },
                            { id: 'feed', label: 'Feed', icon: <Activity className="w-5 h-5" />, href: '/inbox?tab=feed' },
                            { id: 'saved', label: 'Saved', icon: <Bookmark className="w-5 h-5" />, href: '/inbox?tab=bookmarks' },
                            { id: 'liked', label: 'Liked', icon: <Heart className="w-5 h-5" />, href: '/inbox?tab=likes' },
                            { id: 'account', label: 'Account', icon: <User className="w-5 h-5" />, href: '/inbox?tab=account' },
                        ].map((tab) => (
                            <Link
                                key={tab.id}
                                href={tab.href}
                                className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${tab.id === 'account' ? 'text-white' : 'text-stone-500'}`}
                            >
                                <div className={`p-1 rounded-lg transition-all ${tab.id === 'account' ? 'scale-110' : 'scale-100'}`}>
                                    {tab.icon}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wider transition-all ${tab.id === 'account' ? 'opacity-100' : 'opacity-60'}`}>
                                    {tab.label}
                                </span>
                                {tab.id === 'account' && (
                                    <motion.div
                                        layoutId="mobile-indicator"
                                        className="w-1 h-1 rounded-full bg-white absolute -bottom-1"
                                    />
                                )}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </div>
    );
}
