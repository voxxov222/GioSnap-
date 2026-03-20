import React, { useState, useEffect, useRef, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import Webcam from 'react-webcam';
import { Camera, X, Upload, MapPin, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GlobeView() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    if (dimensions.width > 0 && globeRef.current && !userLocation) {
      // Set starting view (Canada)
      globeRef.current.pointOfView({ lat: 56, lng: -106, altitude: 2 });
    }
  }, [dimensions.width, userLocation]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(loc);
          if (globeRef.current) {
            globeRef.current.pointOfView({ lat: loc.lat, lng: loc.lng, altitude: 2 }, 1000);
          }
        },
        (error) => console.error("Error getting location", error)
      );
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(postsData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
    }
  }, [webcamRef]);

  const handleMint = async () => {
    if (!user || !profile || !capturedImage || !userLocation) return;
    setIsMinting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newPost = {
        authorId: user.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        lat: userLocation.lat,
        lng: userLocation.lng,
        mediaUrl: capturedImage,
        mediaType: 'image',
        description: description,
        tokenId: `0x${Math.random().toString(16).slice(2, 10)}...`,
        likesCount: 0,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'posts'), newPost);
      
      setShowCamera(false);
      setCapturedImage(null);
      setDescription('');
    } catch (error) {
      console.error("Error minting NFT", error);
    } finally {
      setIsMinting(false);
    }
  };

  const handleMessage = async (e: Event, postAuthorId: string, postAuthorName: string, postAuthorPhoto: string) => {
    e.stopPropagation();
    if (!user || user.uid === postAuthorId) return;

    try {
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

  const createMarkerElement = useCallback((post: any) => {
    const el = document.createElement('div');
    el.className = 'relative group cursor-pointer';
    el.style.pointerEvents = 'auto';
    el.innerHTML = `
      <div class="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-zinc-800">
        ${post.mediaUrl ? `<img src="${post.mediaUrl}" alt="Post" class="w-full h-full object-cover" referrerpolicy="no-referrer" />` : ''}
      </div>
      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-zinc-900 rounded-xl p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <img src="${post.authorPhoto}" alt="" class="w-6 h-6 rounded-full" referrerpolicy="no-referrer" />
            <span class="text-sm font-medium text-white truncate">${post.authorName}</span>
          </div>
          ${user && user.uid !== post.authorId ? `
            <button class="message-btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-1.5 rounded-full transition-colors pointer-events-auto" title="Message Author">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </button>
          ` : ''}
        </div>
        <p class="text-xs text-zinc-300 line-clamp-2">${post.description}</p>
      </div>
    `;

    const msgBtn = el.querySelector('.message-btn');
    if (msgBtn) {
      msgBtn.addEventListener('click', (e) => {
        handleMessage(e, post.authorId, post.authorName, post.authorPhoto);
      });
    }

    return el;
  }, [user]);

  return (
    <div className="relative w-full h-full bg-black" ref={containerRef}>
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          htmlElementsData={posts.filter(p => p.lat && p.lng)}
          htmlElement={createMarkerElement}
          htmlAltitude={0.05}
          pointsData={userLocation ? [{ lat: userLocation.lat, lng: userLocation.lng, size: 0.5, color: '#3b82f6' }] : []}
          pointAltitude="size"
          pointColor="color"
        />
      )}

      {/* Floating Action Button */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-4 z-10">
        <button 
          onClick={() => setShowCamera(true)}
          className="w-14 h-14 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        >
          <Camera className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                Mint Location NFT
              </h2>
              <button onClick={() => { setShowCamera(false); setCapturedImage(null); }} className="text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-4">
              {!capturedImage ? (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "environment" }}
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <button onClick={capture} className="w-16 h-16 bg-white rounded-full border-4 border-zinc-300 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white rounded-full border border-zinc-200" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                    <button onClick={() => setCapturedImage(null)} className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full backdrop-blur-md">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this location..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white placeholder-zinc-400 resize-none focus:outline-none focus:border-indigo-500"
                    rows={3}
                  />
                  
                  <button 
                    onClick={handleMint}
                    disabled={isMinting || !userLocation}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    {isMinting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Mint to Blockchain
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
