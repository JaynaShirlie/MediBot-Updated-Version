import React, { useState, useEffect, useRef } from 'react';
import { PatientData, MedicalRecord, UserRole } from '../types';
import { therapistChat } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { encryptData, decryptData } from '../services/cryptoService';
import VideoCall from '../components/VideoCall';
import ScheduleView from '../components/ScheduleView';

interface PatientDashboardProps {
  user: PatientData;
  patients: PatientData[];
  setPatients: React.Dispatch<React.SetStateAction<PatientData[]>>;
  onLogout: () => void;
}

const PatientDashboard: React.FC<PatientDashboardProps> = ({ user, patients, setPatients, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'emergency' | 'ai-therapist' | 'hospital' | 'records'>('emergency');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'MEDIBOT-SENSEI ONLINE. HOW CAN I ASSIST?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sosActive, setSosActive] = useState(false);
  const [decryptedRecords, setDecryptedRecords] = useState<Record<string, { title: string, description: string, fileUrl?: string }>>({});
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const patient = patients.find(p => p.id === user.id) || user;
  const locationIntervalRef = useRef<number | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const lastLocationSyncRef = useRef<number>(0);

  // Decrypt patient-only records
  useEffect(() => {
    const decryptAll = async () => {
      const patientOnly = patient.records.filter(r => r.uploadedBy === UserRole.PATIENT);
      const newDecrypted: any = {};
      for (const r of patientOnly) {
        newDecrypted[r.id] = {
          title: await decryptData(r.title),
          description: await decryptData(r.description),
          fileUrl: r.fileUrl ? await decryptData(r.fileUrl) : undefined
        };
      }
      setDecryptedRecords(newDecrypted);
    };
    decryptAll();
  }, [patient.records]);

  // Background Location Tracking
  useEffect(() => {
    const syncLocation = async (latitude: number, longitude: number) => {
      setCurrentCoords({ lat: latitude, lng: longitude });
      const now = Date.now();
      if (now - lastLocationSyncRef.current < 5000) return;
      lastLocationSyncRef.current = now;
      try {
        await supabase.from('patients').update({
          current_lat: latitude,
          current_lng: longitude,
          location_last_updated: new Date().toISOString()
        }).eq('id', patient.id);
        await supabase.from('locations').insert([{
          patient_id: patient.id,
          lat: latitude,
          lng: longitude
        }]);
      } catch (err) {
        console.error("Failed to sync location:", err);
      }
    };

    const updateLocation = () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            syncLocation(latitude, longitude);
          },
          (err) => {
            console.warn("Geolocation access denied or failed:", err);
          },
          { enableHighAccuracy: true, maximumAge: 0 }
        );
      }
    };

    updateLocation();
    locationIntervalRef.current = window.setInterval(updateLocation, 300000);

    if ("geolocation" in navigator) {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          syncLocation(latitude, longitude);
        },
        (err) => {
          console.warn("Geolocation watch failed:", err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }

    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (locationWatchRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, [patient.id]);

  const handleSOS = () => {
    setSosActive(true);
    setTimeout(() => {
      alert(`SYSTEM ALERT: SOS BROADCAST SENT TO ${patient.hospital.toUpperCase()}`);
      setSosActive(false);
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const userMsg = inputValue;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg.toUpperCase() }]);
    setInputValue('');
    const botResponse = await therapistChat(userMsg, "mental support");
    setChatMessages(prev => [...prev, { role: 'bot', text: botResponse.toUpperCase() }]);
  };

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const handleAddRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const currentForm = e.currentTarget;
    const formData = new FormData(currentForm);
    let fileUrl = '';
    if (uploadFile) {
      try {
        fileUrl = await toBase64(uploadFile);
      } catch (err) { console.error(err); }
    }

    try {
      const encryptedTitle = await encryptData((formData.get('title') as string) || "PATIENT UPLOAD");
      const encryptedDesc = await encryptData((formData.get('description') as string) || "Manual upload by patient.");
      const encryptedFile = await encryptData(fileUrl);

      const { data, error } = await supabase.from('medical_records').insert([{
        patient_id: patient.id,
        title: encryptedTitle,
        description: encryptedDesc,
        file_url: encryptedFile || undefined,
        uploaded_by: UserRole.PATIENT,
        is_permanent: true
      }]).select().single();

      if (error) throw error;

      const newRecord: MedicalRecord = {
        id: data.id,
        title: data.title,
        description: data.description,
        fileUrl: data.file_url,
        uploadedAt: new Date(data.uploaded_at).toLocaleString(),
        uploadedBy: UserRole.PATIENT,
        isPermanent: data.is_permanent
      };

      setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, records: [newRecord, ...p.records] } : p));
      setUploadFile(null);
      if (currentForm) {
        currentForm.reset();
      }
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const handleViewFile = (id: string) => {
    const r = decryptedRecords[id];
    if (r?.fileUrl) {
      const win = window.open();
      if (win) {
        win.document.write(`
          <html>
            <body style="margin:0; background: #000; display:flex; justify-content:center; align-items:center;">
              <iframe src="${r.fileUrl}" frameborder="0" style="border:0; width:100%; height:100vh;" allowfullscreen></iframe>
            </body>
          </html>
        `);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white text-black pb-24 font-['Space_Grotesk']">
      <header className="px-6 py-6 border-b-2 border-black sticky top-0 bg-white z-20 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter">Medibot</h1>
          <p className="text-[10px] font-bold opacity-60">PATIENT INTERFACE • STABLE</p>
        </div>
        <button onClick={onLogout} className="w-10 h-10 border-2 border-black flex items-center justify-center">
          <i className="fas fa-power-off"></i>
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {activeTab === 'emergency' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-12">
            <div className="text-center">
              <h2 className="text-5xl font-black uppercase tracking-tighter mb-2">Emergency</h2>
              <p className="text-sm font-bold opacity-40 uppercase tracking-widest">Secure Link to Hospital</p>
            </div>
            <button onClick={handleSOS} className={`w-72 h-72 rounded-full border-4 border-black flex items-center justify-center transition-all ${sosActive ? 'bg-zinc-200' : 'bg-black text-white hover:scale-105 active:scale-95'}`}>
              <div className="flex flex-col items-center">
                <i className={`fas ${sosActive ? 'fa-spinner fa-spin' : 'fa-triangle-exclamation'} text-7xl mb-4`}></i>
                <span className="text-4xl font-black tracking-tighter">SOS</span>
              </div>
            </button>

            <div className="w-full max-w-2xl space-y-4">
              <div className="p-5 border-2 border-black bg-white brutalist-card">
                <h3 className="text-[10px] font-black uppercase opacity-60 mb-2">Emergency Contacts</h3>
                {!patient.emergencyContacts || patient.emergencyContacts.length === 0 ? (
                  <p className="text-[10px] font-bold opacity-40 uppercase">No emergency contacts registered.</p>
                ) : (
                  <div className="space-y-2">
                    {patient.emergencyContacts.map((c, i) => (
                      <div key={i} className="p-3 border-2 border-black flex justify-between items-center bg-zinc-50">
                        <div>
                          <p className="font-black text-xs uppercase">{c.name}</p>
                          <p className="text-[10px] font-bold opacity-60">{c.relationship} • {c.phoneNumber}</p>
                        </div>
                        <button className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center" onClick={() => window.location.href = `tel:${c.phoneNumber}`}>
                          <i className="fas fa-phone text-[10px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border-2 border-black bg-zinc-50">
                  <h4 className="text-[10px] font-black uppercase opacity-60 mb-1">Current Location</h4>
                  <p className="text-[11px] font-black">{currentCoords ? `${currentCoords.lat}` : '---'}</p>
                  <p className="text-[11px] font-black">{currentCoords ? `${currentCoords.lng}` : '---'}</p>
                </div>
                <div className="p-4 border-2 border-black bg-green-50">
                  <h4 className="text-[10px] font-black uppercase opacity-60 mb-1">Status</h4>
                  <p className="text-[11px] font-black">Location sharing active - attender can track</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai-therapist' && (
          <div className="space-y-6 flex flex-col h-[70vh]">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Sensei AI</h2>
            <div className="flex-1 overflow-y-auto border-2 border-black p-4 space-y-4 bg-zinc-50 font-bold uppercase text-xs">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 border-2 border-black ${msg.role === 'user' ? 'bg-black text-white' : 'bg-white'}`}>{msg.text}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="TRANSMIT MESSAGE..." className="flex-1 p-4 border-2 border-black font-black uppercase focus:outline-none" />
              <button onClick={handleSendMessage} className="w-16 bg-black text-white flex items-center justify-center border-2 border-black"><i className="fas fa-paper-plane"></i></button>
            </div>
          </div>
        )}

        {activeTab === 'hospital' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Appointments</h2>
            <div className="p-6 border-2 border-black bg-zinc-50 brutalist-card">
              <h3 className="text-[10px] font-black uppercase opacity-60 mb-2">Hospital Console</h3>
              <p className="font-black text-xl mb-6">{patient.hospital.toUpperCase()}</p>
              <button onClick={() => setIsCallActive(true)} className="w-full bg-black text-white py-4 font-black uppercase mb-4 brutalist-button">Request Call</button>
              <button onClick={() => setIsScheduleOpen(true)} className="w-full bg-white text-black border-2 border-black py-4 font-black uppercase brutalist-button">View Schedule</button>
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Your Vault</h2>

            <div className="p-6 border-2 border-black brutalist-card bg-white mb-8">
              <form onSubmit={handleAddRecord} className="space-y-4">
                <input name="title" required placeholder="RECORD TITLE" className="w-full p-4 border-2 border-black font-black uppercase focus:outline-none text-xs" />
                <textarea name="description" placeholder="DESCRIPTION" className="w-full p-4 border-2 border-black font-black uppercase focus:outline-none text-xs" rows={2} />
                <div onClick={() => fileInputRef.current?.click()} className="p-8 border-2 border-dashed border-black bg-zinc-50 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 transition-colors">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  <i className="fas fa-cloud-upload-alt text-2xl mb-2"></i>
                  <p className="text-xs font-black uppercase tracking-tighter">{uploadFile ? uploadFile.name : "UPLOAD FILE"}</p>
                </div>
                <button type="submit" className="w-full bg-black text-white py-4 font-black uppercase brutalist-button text-xs"><i className="fas fa-plus mr-2"></i> Add Record</button>
              </form>
            </div>

            <div className="space-y-4">
              {patient.records.filter(r => r.uploadedBy === UserRole.PATIENT).length === 0 ? (
                <div className="p-12 border-2 border-black border-dashed text-center opacity-40 font-black uppercase text-xs">No records stored in your vault.</div>
              ) : (
                patient.records.filter(r => r.uploadedBy === UserRole.PATIENT).map(r => {
                  const decrypted = decryptedRecords[r.id] || { title: 'DECRYPTING...', description: '...' };
                  return (
                    <div key={r.id} className="p-6 border-2 border-black brutalist-card bg-white">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h4 className="font-black uppercase text-sm leading-none">{decrypted.title}</h4>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 border-2 border-black uppercase ${r.isPermanent ? 'bg-zinc-100' : 'bg-white italic'}`}>
                              {r.isPermanent ? 'PERMANENT' : 'TEMPORARY'}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold opacity-70 uppercase leading-tight mb-2">{decrypted.description}</p>
                          <p className="text-[9px] font-black uppercase opacity-40">Uploaded: {r.uploadedAt}</p>
                        </div>
                      </div>
                      {r.fileUrl && (
                        <div className="flex justify-end pt-3 border-t-2 border-zinc-50">
                          <button onClick={() => handleViewFile(r.id)} className="text-[10px] font-black uppercase flex items-center gap-1 hover:underline">
                            <i className="far fa-eye"></i> View File
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black h-20 px-4 flex justify-around items-center z-30">
        <button onClick={() => setActiveTab('emergency')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'emergency' ? 'text-black scale-110' : 'text-zinc-300'}`}>
          <i className="fas fa-bell text-xl"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Alert</span>
        </button>
        <button onClick={() => setActiveTab('ai-therapist')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'ai-therapist' ? 'text-black scale-110' : 'text-zinc-300'}`}>
          <i className="fas fa-comment-dots text-xl"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Sensei</span>
        </button>
        <button onClick={() => setActiveTab('hospital')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'hospital' ? 'text-black scale-110' : 'text-zinc-300'}`}>
          <i className="fas fa-calendar-check text-xl"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Doctor</span>
        </button>
        <button onClick={() => setActiveTab('records')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'records' ? 'text-black scale-110' : 'text-zinc-300'}`}>
          <i className="fas fa-box-archive text-xl"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Vault</span>
        </button>
      </nav>
      {isCallActive && (
        <VideoCall
          onEndCall={() => setIsCallActive(false)}
          hospitalName={patient.hospital}
        />
      )}
      {isScheduleOpen && (
        <ScheduleView
          onClose={() => setIsScheduleOpen(false)}
          hospitalName={patient.hospital}
          patientId={patient.id}
        />
      )}
    </div>
  );
};

export default PatientDashboard;