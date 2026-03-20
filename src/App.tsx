import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { signInWithGoogle, logout } from './firebase';
import { Globe, MessageSquare, User as UserIcon, Sparkles, LogOut, Image as ImageIcon, Hash } from 'lucide-react';
import { clsx } from 'clsx';

// Views
import GlobeView from './views/GlobeView';
import FeedView from './views/FeedView';
import ChatView from './views/ChatView';
import ProfileView from './views/ProfileView';
import AssistantView from './views/AssistantView';
import DirectMessagesView from './views/DirectMessagesView';

const Sidebar = () => {
  const location = useLocation();
  const { profile } = useAuth();
  
  const navItems = [
    { path: '/', icon: Globe, label: 'Globe' },
    { path: '/feed', icon: ImageIcon, label: 'Feed' },
    { path: '/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/chat', icon: Hash, label: 'Global Chat' },
    { path: '/ai', icon: Sparkles, label: 'AI Assistant' },
    { path: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full text-white">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">GeoMint</h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={clsx(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
              location.pathname === item.path 
                ? "bg-indigo-500/10 text-indigo-400" 
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
      
      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-3">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-zinc-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{profile?.displayName}</p>
          </div>
          <button onClick={logout} className="p-2 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6">
          <Globe className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Welcome to GeoMint</h1>
        <p className="text-zinc-400 mb-8 text-center max-w-md">
          A 3D globe social network to mint location-based NFTs, chat, and explore the world with AI.
        </p>
        <button 
          onClick={signInWithGoogle}
          className="bg-white text-black px-6 py-3 rounded-full font-medium flex items-center gap-2 hover:bg-zinc-200 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden h-full">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ProtectedRoute><GlobeView /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><FeedView /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><DirectMessagesView /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatView /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfileView /></ProtectedRoute>} />
          <Route path="/ai" element={<ProtectedRoute><AssistantView /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
