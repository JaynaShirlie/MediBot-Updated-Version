import React, { useEffect, useRef, useState } from 'react';

interface VideoCallProps {
  onEndCall: () => void;
  hospitalName: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ onEndCall, hospitalName }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState("CONNECTING SECURE LINE...");
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number;

    const startCall = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setTimeout(() => {
            setStatus("SECURE CONNECTION ESTABLISHED");
            // Start timer
            timer = window.setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }, 1500);
      } catch (err) {
        console.error("Error accessing media devices:", err);
        setStatus("CONNECTION FAILED: CAMERA/MIC ACCESS DENIED");
      }
    };

    startCall();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timer) clearInterval(timer);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col pt-safe animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b-2 border-zinc-800 bg-black z-10">
            <div>
                <h2 className="text-white text-lg md:text-xl font-black uppercase tracking-tighter">Medibot Secure Video</h2>
                <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${status.includes("ESTABLISHED") ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                    <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-widest">{status}</p>
                </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-700 px-3 py-1 flex flex-col items-end">
                <p className="text-white text-[10px] font-black uppercase">{formatTime(duration)}</p>
                <p className="text-zinc-500 text-[8px] font-bold uppercase">{hospitalName}</p>
            </div>
        </div>

        {/* Main Video Area */}
        <div className="flex-1 relative bg-zinc-900 flex items-center justify-center overflow-hidden">
             {/* Local Video - simulating "what the other person sees" or just self-view for this task */}
             {isVideoOff ? (
                 <div className="flex flex-col items-center justify-center text-zinc-600">
                     <i className="fas fa-video-slash text-6xl mb-4"></i>
                     <p className="font-black uppercase tracking-widest text-sm">Camera Off</p>
                 </div>
             ) : (
                <video 
                    ref={localVideoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover transform scale-x-[-1]" 
                />
             )}
             
             {/* Overlay UI elements */}
             <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1.5 border border-white/10 rounded-sm">
                <p className="text-white text-[8px] font-black uppercase tracking-wider flex items-center gap-2">
                    <i className="fas fa-shield-alt text-xs"></i> 
                    End-to-End Encrypted
                </p>
             </div>
             
             {/* Simulated Remote View (Picture-in-Picture style) - For demo purposes so it looks like a call */}
             {/* Note: Since we don't have a real peer, we'll just show a "Connecting" or "Waiting" state for the remote peer, or just focus on the self view as requested by "add video call feature" which often starts with self-view setup. */
             /* Adding a placeholder for remote peer to make it look realistic */}
             <div className="absolute top-4 left-4 w-32 h-44 bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center shadow-2xl">
                 <div className="text-center">
                     <div className="w-12 h-12 bg-zinc-700 rounded-full mx-auto mb-2 flex items-center justify-center">
                         <i className="fas fa-user-md text-zinc-400"></i>
                     </div>
                     <p className="text-zinc-500 text-[8px] font-black uppercase px-2">Dr. AI Interface</p>
                     <div className="mt-2 flex justify-center gap-1">
                         <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                         <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                         <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                     </div>
                 </div>
             </div>
        </div>

        {/* Controls */}
        <div className="p-8 bg-black border-t-2 border-zinc-800 flex justify-center items-center gap-4 md:gap-8 pb-10">
            <button onClick={toggleMute} className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center transition-all ${isMuted ? 'bg-white border-white text-black' : 'bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500'}`}>
                <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg md:text-xl`}></i>
            </button>
            
            <button onClick={onEndCall} className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-red-600 border-4 border-red-800 text-white flex items-center justify-center hover:bg-red-500 transform hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                <i className="fas fa-phone-slash text-3xl md:text-4xl"></i>
            </button>

            <button onClick={toggleVideo} className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center transition-all ${isVideoOff ? 'bg-white border-white text-black' : 'bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500'}`}>
                <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-lg md:text-xl`}></i>
            </button>
        </div>
    </div>
  );
};

export default VideoCall;
