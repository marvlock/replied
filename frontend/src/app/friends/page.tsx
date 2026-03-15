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
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setCurrentUserId(session?.user.id || null);
            fetchFriendsList();
            fetchRequests();
        };
        init();
    }, []);

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
        <div className="min-h-screen bg-white text-black selection:bg-[#D4FF00] selection:text-black font-sans pb-32 md:pb-24">
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#1C7BFF] border-b-4 border-black flex items-center gap-4">
                <Link href="/inbox" className="shrink-0">
                    <button className="w-10 h-10 md:w-12 md:h-12 bg-white border-4 border-black flex items-center justify-center hover:bg-black hover:text-[#1C7BFF] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                </Link>
                <div className="text-2xl font-black uppercase tracking-tighter text-black">
                    Connections
                </div>
            </nav>

            <main className="pt-32 max-w-4xl mx-auto px-6 space-y-12">
                {/* Navigation Tabs */}
                <div className="flex flex-wrap gap-4 border-b-4 border-black pb-8">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex-1 min-w-[140px] px-4 py-4 border-4 border-black font-black uppercase tracking-widest text-sm md:text-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-[#D4FF00] text-black translate-y-[4px] shadow-none' : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white'}`}
                    >
                        <Users className="w-5 h-5 flex-shrink-0" /> Directory
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`flex-1 min-w-[140px] px-4 py-4 border-4 border-black font-black uppercase tracking-widest text-sm md:text-lg transition-all flex items-center justify-center gap-2 relative ${activeTab === 'requests' ? 'bg-[#D4FF00] text-black translate-y-[4px] shadow-none' : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white'}`}
                    >
                        <UserPlus className="w-5 h-5 flex-shrink-0" /> Requests
                        {requests.length > 0 && <span className="absolute -top-3 -right-3 w-6 h-6 bg-red-600 rounded-full border-4 border-black flex items-center justify-center text-[10px] text-white animate-pulse" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`flex-1 min-w-[140px] px-4 py-4 border-4 border-black font-black uppercase tracking-widest text-sm md:text-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'search' ? 'bg-[#D4FF00] text-black translate-y-[4px] shadow-none' : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white'}`}
                    >
                        <Search className="w-5 h-5 flex-shrink-0" /> Add
                    </button>
                </div>

                <div className="min-h-[400px]">
                    <AnimatePresence mode="wait">
                        {activeTab === 'list' && (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                            >
                                {loading ? (
                                    <div className="col-span-full h-64 flex items-center justify-center">
                                        <LoadingScreen />
                                    </div>
                                ) : friendsList.length > 0 ? (
                                    friendsList.map((friend: any) => (
                                        <div key={friend.username} className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-6 group hover:-translate-y-2 transition-transform duration-200">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-black bg-[#D4FF00] flex-shrink-0">
                                                    {friend.avatar_url ? (
                                                        <img src={friend.avatar_url} alt="" className="w-full h-full object-cover grayscale" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-black">
                                                            {friend.username?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 overflow-hidden">
                                                    <Link href={`/${friend.username}`} className="text-xl font-black uppercase truncate block hover:text-[#1C7BFF] transition-colors">
                                                        @{friend.username}
                                                    </Link>
                                                    <p className="text-sm font-bold uppercase truncate text-black/60">{friend.display_name || friend.username}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => unfriend(friend.friendship_id)}
                                                className="w-full bg-black text-white hover:bg-[#FF4040] hover:text-black border-4 border-black py-3 font-black uppercase text-sm flex items-center justify-center gap-2 transition-colors mt-auto"
                                            >
                                                <UserMinus className="w-4 h-4" /> Drop
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-20 text-center space-y-6 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] px-6">
                                        <Users className="w-20 h-20 fill-black mx-auto" />
                                        <div>
                                            <p className="text-4xl font-black uppercase tracking-tighter mb-2">Empty Squad</p>
                                            <p className="text-xl font-bold uppercase">Time to recruit some homies.</p>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('search')}
                                            className="bg-[#D4FF00] hover:bg-black text-black hover:text-[#D4FF00] border-4 border-black px-8 py-4 font-black uppercase transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] inline-block mt-4"
                                        >
                                            Find People
                                        </button>
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
                                className="max-w-2xl mx-auto space-y-6"
                            >
                                {requests.length > 0 ? (
                                    requests.map((req: any) => (
                                        <div key={req.id} className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
                                            <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                                                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-black bg-[#1C7BFF] shrink-0">
                                                    {req.profiles?.avatar_url ? (
                                                        <img src={req.profiles.avatar_url} alt="" className="w-full h-full object-cover grayscale" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-3xl font-black text-black">
                                                            {req.profiles?.username?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 pr-4">
                                                    <p className="text-2xl font-black uppercase truncate">@{req.profiles?.username}</p>
                                                    <p className="text-sm font-bold uppercase text-black/60 truncate">{req.profiles?.display_name}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 w-full sm:w-auto">
                                                <button
                                                    onClick={() => acceptRequest(req.id)}
                                                    className="flex-1 sm:flex-none border-4 border-black bg-[#D4FF00] hover:bg-black hover:text-[#D4FF00] p-4 flex justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors group"
                                                >
                                                    <Check className="w-6 h-6 stroke-[3px]" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                        <p className="text-3xl font-black uppercase tracking-widest">No pending requests</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'search' && (
                            <motion.div
                                key="search"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="max-w-2xl mx-auto space-y-8"
                            >
                                <div className="relative">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                        {searching ? (
                                            <div className="w-6 h-6 border-4 border-black border-t-[#1C7BFF] rounded-full animate-spin" />
                                        ) : (
                                            <Search className="w-6 h-6 fill-black stroke-black opacity-50" />
                                        )}
                                    </div>
                                    <Input
                                        placeholder="SEARCH USERNAME..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-20 pl-16 pr-16 bg-white border-4 border-black rounded-none focus-visible:ring-0 text-2xl font-black uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] placeholder:text-black/30 text-black"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-6 top-1/2 -translate-y-1/2 bg-black text-white hover:bg-[#FF4040] hover:text-black border-4 border-black p-2 transition-colors"
                                        >
                                            <X className="w-4 h-4 stroke-[3px]" />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    {searchResults.map((user: any) => {
                                        const isMe = user.id === currentUserId;
                                        const isFriend = friendsList.some(f => f.id === user.id);

                                        return (
                                            <div key={user.id} className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
                                                <Link href={`/${user.username}`} className="flex items-center gap-4 flex-1 w-full relative">
                                                    <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-black bg-[#D4FF00] shrink-0">
                                                        {user.avatar_url ? (
                                                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover grayscale" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-3xl font-black text-black">
                                                                {user.username?.[0]?.toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <p className="text-2xl font-black uppercase truncate group-hover:underline">@{user.username}</p>
                                                        <p className="text-sm font-bold uppercase truncate text-black/60">{user.display_name || 'View Profile'}</p>
                                                    </div>
                                                </Link>

                                                <div className="w-full sm:w-auto shrink-0 mt-4 sm:mt-0">
                                                    {isMe ? (
                                                        <span className="w-full sm:w-32 bg-black text-[#D4FF00] block text-center py-4 font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0px_0px_rgba(212,255,0,1)]">
                                                            ME
                                                        </span>
                                                    ) : isFriend ? (
                                                        <span className="w-full sm:w-32 flex items-center justify-center gap-2 bg-[#D4FF00] text-black py-4 font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                            <Check className="w-5 h-5 stroke-[3px]" /> ADDED
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                sendRequest(user.id);
                                                            }}
                                                            className="w-full sm:w-32 bg-white hover:bg-black hover:text-[#D4FF00] text-black py-4 font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors text-xs"
                                                        >
                                                            Add Friend
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                                        <div className="p-8 bg-black text-white border-4 border-black text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                            <p className="text-2xl font-black uppercase">Nobody found ¯\_(ツ)_/¯</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
