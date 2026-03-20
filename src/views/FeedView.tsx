import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { Heart, MapPin, Share2, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function FeedView() {
  const [posts, setPosts] = useState<any[]>([]);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    });
    return () => unsubscribe();
  }, []);

  const handleLike = async (postId: string) => {
    if (!user) return;
    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        likesCount: increment(1)
      });
    } catch (error) {
      console.error("Error liking post", error);
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

  return (
    <div className="h-full overflow-y-auto bg-black text-white p-6">
      <div className="max-w-2xl mx-auto space-y-8 pb-20">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Global Feed</h1>
        
        {posts.length === 0 ? (
          <div className="text-center text-zinc-500 py-20">
            <p>No NFTs minted yet. Be the first!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={post.authorPhoto} alt={post.authorName} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                  <div>
                    <h3 className="font-medium">{post.authorName}</h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {post.lat?.toFixed(4)}, {post.lng?.toFixed(4)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user && user.uid !== post.authorUid && (
                    <button 
                      onClick={() => handleMessage(post.authorUid, post.authorName, post.authorPhoto)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded-full transition-colors"
                      title="Message Author"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                  <div className="bg-indigo-500/10 text-indigo-400 text-xs px-3 py-1 rounded-full font-mono">
                    {post.tokenId}
                  </div>
                </div>
              </div>
              
              {post.mediaUrl && (
                <div className="aspect-square w-full bg-black">
                  <img src={post.mediaUrl} alt="NFT" className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <button onClick={() => handleLike(post.id)} className="flex items-center gap-2 text-zinc-400 hover:text-pink-500 transition-colors">
                    <Heart className="w-6 h-6" />
                    <span className="font-medium">{post.likesCount || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                    <Share2 className="w-6 h-6" />
                  </button>
                </div>
                
                <p className="text-zinc-300">
                  <span className="font-medium text-white mr-2">{post.authorName}</span>
                  {post.description}
                </p>
                
                {post.createdAt && (
                  <p className="text-xs text-zinc-500 mt-2 uppercase tracking-wider">
                    {new Date(post.createdAt.toDate()).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
