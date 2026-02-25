'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserMinus, Check, X, Search, Users, Activity, Clock, MessageSquare, ArrowLeft } from 'lucide-react';
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
        if (searchQuery.length < 2) return;
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
        <div className="min-h-screen bg-black text-stone-200 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-stone-800 pb-8">
                    <div className="space-y-4">
                        <Link href="/inbox" className="group flex items-center gap-2 text-stone-500 hover:text-white transition-colors text-sm w-fit">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Inbox
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Friends</h1>
                            <p className="text-stone-500 text-sm mt-1">Connect and follow your friends' activities.</p>
                        </div>
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
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Search by username..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="h-12 bg-stone-900 border-stone-800 rounded-xl"
                                    />
                                    <Button
                                        onClick={handleSearch}
                                        disabled={searching}
                                        className="h-12 px-6 rounded-xl bg-white text-black font-bold"
                                    >
                                        {searching ? '...' : 'Search'}
                                    </Button>
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
            </div>
        </div>
    );
}
