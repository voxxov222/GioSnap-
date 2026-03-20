import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Send, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ChatView() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { user, profile } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
    return () => unsubscribe();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !profile) return;
    
    const text = newMessage;
    setNewMessage('');
    
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        senderName: profile.displayName,
        senderPhoto: profile.photoURL,
        text: text,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message", error);
    }
  };

  const handleMessage = async (postAuthorId: string, postAuthorName: string, postAuthorPhoto: string) => {
    if (!user || user.uid === postAuthorId) return;

    try {
      // Check if chat already exists
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(q);
      
      let existingChatId = null;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(postAuthorId)) {
          existingChatId = doc.id;
        }
      });

      if (existingChatId) {
        navigate(`/messages?chatId=${existingChatId}`);
      } else {
        // Create new chat
        const newChatRef = await addDoc(collection(db, 'chats'), {
          participants: [user.uid, postAuthorId],
          participantDetails: {
            [user.uid]: { name: profile?.displayName || 'User', photo: profile?.photoURL || '' },
            [postAuthorId]: { name: postAuthorName, photo: postAuthorPhoto }
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: ''
        });
        navigate(`/messages?chatId=${newChatRef.id}`);
      }
    } catch (error) {
      console.error("Error initiating chat", error);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold tracking-tight">Global Chat</h1>
        <p className="text-zinc-400 text-sm">Connect with explorers around the world.</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === user?.uid;
          const showAvatar = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
          
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              {showAvatar ? (
                <div className="relative group mt-1">
                  <img src={msg.senderPhoto} alt={msg.senderName} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  {!isMe && (
                    <button 
                      onClick={() => handleMessage(msg.senderId, msg.senderName, msg.senderPhoto)}
                      className="absolute -top-2 -right-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      title="Direct Message"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-8" />
              )}
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {showAvatar && (
                  <div className="flex items-baseline gap-2 mb-1 mx-1">
                    <span className="text-xs text-zinc-500">{msg.senderName}</span>
                    <span className="text-[10px] text-zinc-600">{formatTime(msg.createdAt)}</span>
                  </div>
                )}
                <div className={`px-4 py-2 rounded-2xl max-w-md ${
                  isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
                {!showAvatar && (
                  <span className="text-[10px] text-zinc-600 mt-1 mx-1">{formatTime(msg.createdAt)}</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-zinc-800 bg-zinc-950">
        <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto">
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
    </div>
  );
}
