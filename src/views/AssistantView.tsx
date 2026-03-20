import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel, Modality, LiveServerMessage } from '@google/genai';
import { Mic, Image as ImageIcon, Video, Sparkles, Send, Volume2, BrainCircuit, Globe, Search, Zap, MicOff } from 'lucide-react';
import Markdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function AssistantView() {
  const [activeTab, setActiveTab] = useState<'chat' | 'image' | 'voice' | 'analyze' | 'live'>('chat');
  
  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatMode, setChatMode] = useState<'pro' | 'fast' | 'search' | 'maps'>('pro');
  const [useDeepThink, setUseDeepThink] = useState(false);
  
  // Image Gen State
  const [imagePrompt, setImagePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Analysis State
  const [file, setFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Voice State
  const [transcript, setTranscript] = useState('');
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);

  // Live API State
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveSession, setLiveSession] = useState<any>(null);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);
    
    try {
      const config: any = {};
      let model = 'gemini-3.1-pro-preview';

      if (chatMode === 'fast') {
        model = 'gemini-3.1-flash-lite-preview';
      } else if (chatMode === 'search') {
        model = 'gemini-3-flash-preview';
        config.tools = [{ googleSearch: {} }];
      } else if (chatMode === 'maps') {
        model = 'gemini-2.5-flash';
        config.tools = [{ googleMaps: {} }];
      } else if (chatMode === 'pro' && useDeepThink) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }
      
      const response = await ai.models.generateContent({
        model,
        contents: userMsg,
        config
      });
      
      setChatHistory(prev => [...prev, { role: 'model', text: response.text || '' }]);
    } catch (error) {
      console.error("Chat error", error);
      setChatHistory(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGenerating(true);
    try {
      const currentAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await currentAi.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: imagePrompt,
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: "1K"
          }
        }
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error) {
      console.error("Image generation error", error);
      alert("Error generating image. Ensure you have selected a valid API key for image generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: "Analyze this media in detail." }
          ]
        }
      });
      
      setAnalysisResult(response.text || '');
    } catch (error) {
      console.error("Analysis error", error);
      setAnalysisResult("Error analyzing media.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTTS = async (text: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });
      
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setTtsAudio(`data:audio/pcm;rate=24000;base64,${base64Audio}`);
      }
    } catch (error) {
      console.error("TTS error", error);
    }
  };

  const startLiveVoice = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        callbacks: {
          onopen: () => {
            setIsLiveConnected(true);
            setLiveTranscript(prev => [...prev, "Connected to Live Voice API..."]);
            
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }
              
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
            
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const audioData = atob(base64Audio);
              const arrayBuffer = new ArrayBuffer(audioData.length);
              const view = new Uint8Array(arrayBuffer);
              for (let i = 0; i < audioData.length; i++) {
                view[i] = audioData.charCodeAt(i);
              }
              
              audioContextRef.current?.decodeAudioData(arrayBuffer, (buffer) => {
                const source = audioContextRef.current!.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContextRef.current!.destination);
                source.start();
              });
            }
          },
          onclose: () => {
            setIsLiveConnected(false);
            setLiveTranscript(prev => [...prev, "Disconnected."]);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a helpful AI assistant for GeoMint, a 3D globe social network.",
        },
      });
      
      setLiveSession(sessionPromise);
    } catch (error) {
      console.error("Live Voice error", error);
    }
  };

  const stopLiveVoice = () => {
    if (liveSession) {
      liveSession.then((session: any) => session.close());
      setLiveSession(null);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsLiveConnected(false);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <div className="p-6 border-b border-zinc-800 flex gap-4 overflow-x-auto">
        <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${activeTab === 'chat' ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
          <Sparkles className="w-4 h-4 inline mr-2" /> Chatbot
        </button>
        <button onClick={() => setActiveTab('live')} className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${activeTab === 'live' ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
          <Mic className="w-4 h-4 inline mr-2" /> Live Voice
        </button>
        <button onClick={() => setActiveTab('image')} className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${activeTab === 'image' ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
          <ImageIcon className="w-4 h-4 inline mr-2" /> Generate Image
        </button>
        <button onClick={() => setActiveTab('analyze')} className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${activeTab === 'analyze' ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
          <Video className="w-4 h-4 inline mr-2" /> Analyze Media
        </button>
        <button onClick={() => setActiveTab('voice')} className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${activeTab === 'voice' ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
          <Volume2 className="w-4 h-4 inline mr-2" /> TTS
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'chat' && (
          <div className="max-w-3xl mx-auto flex flex-col h-full">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <button onClick={() => setChatMode('pro')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${chatMode === 'pro' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
                <BrainCircuit className="w-4 h-4 inline mr-1" /> Pro
              </button>
              <button onClick={() => setChatMode('fast')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${chatMode === 'fast' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
                <Zap className="w-4 h-4 inline mr-1" /> Fast (Flash-Lite)
              </button>
              <button onClick={() => setChatMode('search')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${chatMode === 'search' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
                <Search className="w-4 h-4 inline mr-1" /> Web Search
              </button>
              <button onClick={() => setChatMode('maps')} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${chatMode === 'maps' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
                <Globe className="w-4 h-4 inline mr-1" /> Maps Data
              </button>
            </div>
            
            <div className="flex-1 space-y-6 mb-6">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-zinc-900 border border-zinc-800'}`}>
                    {msg.role === 'model' ? (
                      <div className="markdown-body prose prose-invert max-w-none">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-2 items-center text-zinc-400">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
            </div>
            
            <form onSubmit={handleChat} className="flex flex-col gap-3">
              {chatMode === 'pro' && (
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer w-fit">
                  <input type="checkbox" checked={useDeepThink} onChange={e => setUseDeepThink(e.target.checked)} className="rounded bg-zinc-900 border-zinc-700 text-indigo-500 focus:ring-indigo-500" />
                  <BrainCircuit className="w-4 h-4" /> Use Deep Thinking (High Level)
                </label>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={`Ask Gemini anything... (${chatMode} mode)`}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
                <button type="submit" disabled={!chatInput.trim() || isThinking} className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        )}
        
        {activeTab === 'live' && (
          <div className="max-w-2xl mx-auto space-y-8 text-center flex flex-col items-center justify-center h-full">
            <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center mb-8 relative">
              {isLiveConnected && (
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-ping opacity-20" />
              )}
              <Mic className={`w-12 h-12 ${isLiveConnected ? 'text-indigo-400' : 'text-zinc-500'}`} />
            </div>
            
            <h2 className="text-3xl font-bold">Live Voice Conversation</h2>
            <p className="text-zinc-400 max-w-md">
              Have a real-time conversation with Gemini. Ask about places on the globe, NFTs, or anything else!
            </p>
            
            {!isLiveConnected ? (
              <button onClick={startLiveVoice} className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-transform hover:scale-105">
                <Mic className="w-6 h-6" /> Start Conversation
              </button>
            ) : (
              <button onClick={stopLiveVoice} className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-3 transition-transform hover:scale-105">
                <MicOff className="w-6 h-6" /> End Conversation
              </button>
            )}
            
            <div className="mt-8 space-y-2 text-sm text-zinc-500">
              {liveTranscript.map((t, i) => <p key={i}>{t}</p>)}
            </div>
          </div>
        )}
        
        {activeTab === 'image' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Generate Images</h2>
            <div className="flex gap-4">
              <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                <option value="1:1">1:1 Square</option>
                <option value="4:3">4:3 Landscape</option>
                <option value="16:9">16:9 Widescreen</option>
                <option value="9:16">9:16 Portrait</option>
                <option value="3:4">3:4 Portrait</option>
                <option value="2:3">2:3 Portrait</option>
                <option value="3:2">3:2 Landscape</option>
                <option value="21:9">21:9 Ultrawide</option>
              </select>
              <input
                type="text"
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                placeholder="Describe an image..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
              <button onClick={handleGenerateImage} disabled={!imagePrompt.trim() || isGenerating} className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
            
            {generatedImage && (
              <div className="mt-8 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
                <img src={generatedImage} alt="Generated" className="w-full h-auto" />
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'analyze' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Analyze Media</h2>
            <p className="text-zinc-400">Upload an image or video to analyze it with Gemini Pro.</p>
            
            <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer relative">
              <input type="file" accept="image/*,video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="flex flex-col items-center gap-4">
                <ImageIcon className="w-12 h-12 text-zinc-500" />
                <p className="font-medium">{file ? file.name : 'Click or drag to upload media'}</p>
              </div>
            </div>
            
            <button onClick={handleAnalyze} disabled={!file || isAnalyzing} className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white py-3 rounded-xl font-medium transition-colors">
              {isAnalyzing ? 'Analyzing...' : 'Analyze Media'}
            </button>
            
            {analysisResult && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mt-8">
                <h3 className="text-lg font-bold mb-4">Analysis Result</h3>
                <div className="markdown-body prose prose-invert max-w-none">
                  <Markdown>{analysisResult}</Markdown>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'voice' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">Text to Speech</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder="Type something to say..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
                <button onClick={() => handleTTS(transcript)} disabled={!transcript.trim()} className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2">
                  <Volume2 className="w-5 h-5" /> Speak
                </button>
              </div>
              {ttsAudio && (
                <audio controls src={ttsAudio} className="mt-4 w-full" autoPlay />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
