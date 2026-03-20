import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Wallet, Edit2, Check, User as UserIcon } from 'lucide-react';

export default function ProfileView() {
  const { profile, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio || '');
  const [wallet, setWallet] = useState(profile?.walletAddress || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        bio,
        walletAddress: wallet
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-black text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Profile</h1>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 mb-8">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-6">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-24 h-24 rounded-full border-4 border-zinc-800" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
                  <UserIcon className="w-10 h-10 text-zinc-500" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold">{profile?.displayName}</h2>
                <p className="text-zinc-400">{user?.email}</p>
              </div>
            </div>
            
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
            ) : (
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 rounded-lg transition-colors font-medium"
              >
                <Check className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Bio</label>
              {isEditing ? (
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 resize-none"
                  rows={3}
                />
              ) : (
                <p className="text-zinc-200 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                  {profile?.bio || 'No bio provided.'}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Web3 Wallet Address</label>
              {isEditing ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Wallet className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={wallet}
                      onChange={(e) => setWallet(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                  <Wallet className="w-5 h-5 text-indigo-400" />
                  <span className="font-mono text-zinc-200">
                    {profile?.walletAddress || 'No wallet connected.'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
