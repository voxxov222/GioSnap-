import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Send, User as UserIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function DirectMessagesView() {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get('chatId');
    if (chatId) {
      setActiveChatId(chatId);
    }
  }, [location]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(chatsData);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeChatId || !user) return;
    const q = query(collection(db, `chats/${activeChatId}/messages`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    return () => unsubscribe();
  }, [activeChatId, user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeChatId) return;
    
    const text = newMessage;
    setNewMessage('');
    
    try {
      await addDoc(collection(db, `chats/${activeChatId}/messages`), {
        senderId: user.uid,
        text: text,
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: text,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message", error);
    }
  };

  const getOtherUser = (chat: any) => {
    const otherUid = chat.participants.find((id: string) => id !== user?.uid);
    return chat.participantDetails?.[otherUid] || { name: 'Unknown', photo: '' };
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full bg-black text-white">
      {/* Sidebar */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-6 text-zinc-500 text-center">No messages yet.</div>
          ) : (
            chats.map(chat => {
              const otherUser = getOtherUser(chat);
              const isActive = chat.id === activeChatId;
              return (
                <button
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    navigate(`/messages?chatId=${chat.id}`);
                  }}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-zinc-900 transition-colors border-b border-zinc-800/50 ${isActive ? 'bg-zinc-900' : ''}`}
                >
                  {otherUser.photo ? (
                    <img src={otherUser.photo} alt={otherUser.name} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-zinc-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-medium truncate">{otherUser.name}</h3>
                      <span className="text-xs text-zinc-500">{formatTime(chat.updatedAt)}</span>
                    </div>
                    <p className="text-sm text-zinc-400 truncate">{chat.lastMessage || 'Started a chat'}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeChatId ? (
          <>
            <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
              {(() => {
                const activeChat = chats.find(c => c.id === activeChatId);
                if (!activeChat) return <div className="font-medium">Loading...</div>;
                const otherUser = getOtherUser(activeChat);
                return (
                  <>
                    {otherUser.photo ? (
                      <img src={otherUser.photo} alt={otherUser.name} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-zinc-500" />
                      </div>
                    )}
                    <h2 className="font-bold text-lg">{otherUser.name}</h2>
                  </>
                );
              })()}
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl max-w-md ${
                      isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-xs text-zinc-500 mt-1 mx-1">{formatTime(msg.createdAt)}</span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-6 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-12 h-12 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <Send className="w-5 h-5 ml-1" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}