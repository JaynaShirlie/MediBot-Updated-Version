
import React from 'react';

interface LandingProps {
  onNavigate: (view: string) => void;
}

const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-black">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center text-white text-5xl">
            <i className="fas fa-robot"></i>
          </div>
        </div>
        
        <h1 className="text-6xl font-black text-center mb-4 tracking-tighter uppercase">Medibot</h1>
        <p className="text-lg text-center font-medium mb-12 px-4 leading-tight opacity-80">
          Intelligent Healthcare Companion. <br/>Minimalist. Powerful. Secure.
        </p>
        
        <div className="space-y-4">
          <button 
            onClick={() => onNavigate('register-attender')}
            className="w-full bg-black text-white px-8 py-5 rounded-none font-black text-xl brutalist-button hover:bg-zinc-800 transition-colors"
          >
            REGISTER AS ATTENDER
          </button>
          
          <button 
            onClick={() => onNavigate('login')}
            className="w-full bg-white text-black border-2 border-black px-8 py-5 rounded-none font-black text-xl brutalist-button hover:bg-zinc-100 transition-colors"
          >
            EXISTING USER LOGIN
          </button>
        </div>

        <div className="mt-16 text-center text-xs font-bold uppercase tracking-widest opacity-40">
          Standard Issue Medical Interface v2.5
        </div>
      </div>
    </div>
  );
};

export default Landing;
