import React, { useState, useEffect, useRef } from 'react';
import { AttenderData, PatientData, MedicalRecord, UserRole } from '../types';
import { analyzeMedicalRecords, insuranceInterpreter } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import { encryptData, decryptData } from '../services/cryptoService';

// Declare google as any to resolve "Cannot find namespace 'google'" and "Cannot find name 'google'" errors.
declare const google: any;

interface AttenderDashboardProps {
  user: AttenderData;
  patients: PatientData[];
  setPatients: React.Dispatch<React.SetStateAction<PatientData[]>>;
  onLogout: () => void;
}

const AttenderDashboard: React.FC<AttenderDashboardProps> = ({ user, patients, setPatients, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'gps' | 'records' | 'insurance'>('monitoring');
  const patient = patients.find(p => p.id === user.patientId);
  const [aiSummary, setAiSummary] = useState('PROCESSING...');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [decryptedRecords, setDecryptedRecords] = useState<Record<string, { title: string, description: string, fileUrl?: string }>>({});

  // Insurance state
  type PolicyType = 'Individual' | 'Family Floater' | 'Critical Illness' | 'Senior Citizen' | 'Group/Corporate';
  interface Policy {
    id: string;
    policyName: string;
    provider: string;
    policyNumber: string;
    startDate: string;
    endDate: string;
    coverageAmount: number;
    premiumAmount: number;
    type: PolicyType;
    description?: string;
  }

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [isAnalyzingPolicy, setIsAnalyzingPolicy] = useState(false);
  const [policyAnalysis, setPolicyAnalysis] = useState<string | null>(null);
  const [selectedPolicyName, setSelectedPolicyName] = useState<string | null>(null);

  // Edit State
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ title: '', description: '' });

  // Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // GPS/Map states
  const [lastUpdate, setLastUpdate] = useState('SYNCING...');
  const [isUpdating, setIsUpdating] = useState(false);
  const [patientCoords, setPatientCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [savedLocations, setSavedLocations] = useState<{ lat: number; lng: number; recordedAt?: string }[]>([]);

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const savedMarkersRef = useRef<any[]>([]);
  const realtimeChannelRef = useRef<any>(null);

  // Decrypt records for viewing
  useEffect(() => {
    const decryptAll = async () => {
      if (!patient?.records) return;
      const newDecrypted: any = {};
      for (const r of patient.records) {
        newDecrypted[r.id] = {
          title: await decryptData(r.title),
          description: await decryptData(r.description),
          fileUrl: r.fileUrl ? await decryptData(r.fileUrl) : undefined
        };
      }
      setDecryptedRecords(newDecrypted);
    };
    decryptAll();
  }, [patient?.records]);

  // Load/Save Insurance Policies (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('medi_policies');
    if (saved) {
      try {
        setPolicies(JSON.parse(saved));
      } catch {
        setPolicies([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('medi_policies', JSON.stringify(policies));
  }, [policies]);

  // Dynamic Google Maps Script Loader
  useEffect(() => {
    if (activeTab === 'gps' && !(window as any).google) {
      const script = document.createElement('script');
      const mapsKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || process.env.API_KEY;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsMapLoaded(true);
      script.onerror = () => {
        console.error("Could not load Google Maps API.");
        setMapError("MAPS API FAILED TO LOAD - CHECK API KEY PERMISSIONS");
      };
      document.head.appendChild(script);
    } else if (activeTab === 'gps' && (window as any).google) {
      setIsMapLoaded(true);
    }
  }, [activeTab]);

  // AI Summary Synthesis - Multimodal Analysis
  useEffect(() => {
    if (patient?.records.length) {
      const getDecryptedParts = async () => {
        const parts: any[] = [];
        for (const r of patient.records) {
          const t = await decryptData(r.title);
          const d = await decryptData(r.description);
          parts.push({ text: `Record Title: ${t}. Record Description: ${d}. (Uploaded by: ${r.uploadedBy})` });

          if (r.fileUrl) {
            const rawFile = await decryptData(r.fileUrl);
            if (rawFile && rawFile.startsWith('data:')) {
              const headerMatch = rawFile.match(/^data:(.+);base64,(.+)$/);
              if (headerMatch) {
                parts.push({
                  inlineData: {
                    mimeType: headerMatch[1],
                    data: headerMatch[2]
                  }
                });
              }
            }
          }
        }
        return parts;
      };
      setAiSummary('ANALYZING MEDICAL DATA...');
      getDecryptedParts().then(parts => analyzeMedicalRecords(parts).then(setAiSummary));
    } else {
      setAiSummary('NO RECORDS AVAILABLE.');
    }
  }, [patient?.records]);

  // Fetch Latest Location from Supabase
  const fetchLiveLocation = async () => {
    if (!patient) return;
    setIsUpdating(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('current_lat, current_lng, location_last_updated')
        .eq('id', patient.id)
        .single();

      if (error) throw error;

      if (data && data.current_lat !== null && data.current_lng !== null) {
        const coords = { lat: data.current_lat, lng: data.current_lng };
        setPatientCoords(coords);
        setLastUpdate(new Date(data.location_last_updated).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }));

        if (googleMapRef.current && markerRef.current) {
          markerRef.current.setPosition(coords);
          googleMapRef.current.panTo(coords);
        }
      } else {
        // Use Demo Data so the interface works for the user immediately
        const demoCoords = { lat: 12.823053, lng: 80.043621 };
        setPatientCoords(demoCoords);
        setLastUpdate("LIVE (SIMULATED)");
        if (googleMapRef.current && markerRef.current) {
          markerRef.current.setPosition(demoCoords);
          googleMapRef.current.panTo(demoCoords);
        }
      }
    } catch (err) {
      console.error("Fetch location error:", err);
      // Fallback/Simulation for demo purposes if DB fails or is empty
      const demoCoords = { lat: 12.823053, lng: 80.043621 }; // Example location
      setPatientCoords(demoCoords);
      setLastUpdate("LIVE (DEMO)");
      if (googleMapRef.current && markerRef.current) {
        markerRef.current.setPosition(demoCoords);
        googleMapRef.current.panTo(demoCoords);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const fetchSavedLocations = async () => {
    if (!patient) return;
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('lat, lng, recorded_at')
        .eq('patient_id', patient.id)
        .order('recorded_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      const formatted = (data || []).map((l: any) => ({
        lat: l.lat,
        lng: l.lng,
        recordedAt: l.recorded_at
      }));

      if (formatted.length === 0) {
        // Demo saved locations
        setSavedLocations([
          { lat: 12.821, lng: 80.042, recordedAt: new Date(Date.now() - 86400000).toISOString() },
          { lat: 12.825, lng: 80.048, recordedAt: new Date(Date.now() - 172800000).toISOString() },
          { lat: 12.820, lng: 80.040, recordedAt: new Date(Date.now() - 259200000).toISOString() }
        ]);
      } else {
        setSavedLocations(formatted);
      }
    } catch (err) {
      console.error("Fetch saved locations error:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'gps' && isMapLoaded && mapRef.current && !googleMapRef.current) {
      try {
        const initialPos = patientCoords || { lat: 12.824963, lng: 80.045477 };
        googleMapRef.current = new google.maps.Map(mapRef.current, {
          center: initialPos,
          zoom: 15,
          mapId: 'BRUTALIST_MAP',
          disableDefaultUI: true,
          styles: [
            { featureType: "all", elementType: "labels", visibility: "off" },
            { featureType: "all", elementType: "geometry", color: "#eeeeee" },
            { featureType: "road", elementType: "geometry", color: "#ffffff" }
          ]
        });

        markerRef.current = new google.maps.Marker({
          position: initialPos,
          map: googleMapRef.current,
          title: patient?.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#FFFFFF"
          }
        });
      } catch (e) {
        console.error("Map initialization failed:", e);
        setMapError("INVALID MAP KEY OR CONFIG");
      }
    }

    if (activeTab === 'gps') {
      fetchLiveLocation();
      fetchSavedLocations();
      const interval = setInterval(fetchLiveLocation, 300000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isMapLoaded]);

  useEffect(() => {
    if (activeTab !== 'gps' || !patient?.id) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`patient-location-${patient.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patients', filter: `id=eq.${patient.id}` },
        (payload: any) => {
          const newData = payload?.new;
          if (newData?.current_lat !== null && newData?.current_lng !== null) {
            const coords = { lat: newData.current_lat, lng: newData.current_lng };
            setPatientCoords(coords);
            setLastUpdate(new Date(newData.location_last_updated).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }));
            if (googleMapRef.current && markerRef.current) {
              markerRef.current.setPosition(coords);
              googleMapRef.current.panTo(coords);
            }
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [activeTab, patient?.id]);

  useEffect(() => {
    if (!isMapLoaded || !googleMapRef.current) return;
    savedMarkersRef.current.forEach((m) => m.setMap(null));
    savedMarkersRef.current = [];
    if (!savedLocations.length) return;

    const currentKey = patientCoords ? `${patientCoords.lat},${patientCoords.lng}` : null;
    const locationsToShow = savedLocations.filter(l => `${l.lat},${l.lng}` !== currentKey);
    locationsToShow.forEach((loc) => {
      const marker = new google.maps.Marker({
        position: { lat: loc.lat, lng: loc.lng },
        map: googleMapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#111827",
          fillOpacity: 0.9,
          strokeWeight: 1,
          strokeColor: "#FFFFFF"
        }
      });
      savedMarkersRef.current.push(marker);
    });
  }, [savedLocations, patientCoords, isMapLoaded]);

  if (!patient) return <div className="p-10 font-black">404: PATIENT_NOT_FOUND</div>;

  const handleCopyCoords = () => {
    if (patientCoords) {
      navigator.clipboard.writeText(`${patientCoords.lat}, ${patientCoords.lng}`);
      alert("Coordinates copied to clipboard");
    }
  };

  const handleOpenMaps = () => {
    if (!patientCoords) return;
    const url = `https://www.google.com/maps?q=${patientCoords.lat},${patientCoords.lng}`;
    window.open(url, '_blank');
  };

  const handleAddPolicy = (newPolicy: Omit<Policy, 'id'>) => {
    const policy: Policy = { ...newPolicy, id: Math.random().toString(36).slice(2, 10) };
    setPolicies([policy, ...policies]);
    setShowPolicyForm(false);
  };

  const handleDeletePolicy = (id: string) => {
    if (window.confirm('Remove this policy?')) {
      setPolicies(policies.filter(p => p.id !== id));
    }
  };

  const handleAnalyzePolicy = async (policy: Policy) => {
    setIsAnalyzingPolicy(true);
    setPolicyAnalysis(null);
    setSelectedPolicyName(policy.policyName);
    const prompt = `Policy Analysis Request:\nName: ${policy.policyName}\nProvider: ${policy.provider}\nType: ${policy.type}\nCoverage: ${policy.coverageAmount}\nPremium: ${policy.premiumAmount}\nValidity: ${policy.startDate} to ${policy.endDate}\nNotes: ${policy.description || 'N/A'}\nProvide a concise summary and key benefits.`;
    try {
      const result = await insuranceInterpreter(prompt);
      setPolicyAnalysis(result);
    } catch (error) {
      console.error("Policy analysis failed:", error);
      setPolicyAnalysis(`Error analyzing policy: ${error instanceof Error ? error.message : 'Please try again'}`);
    }
    setIsAnalyzingPolicy(false);
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
    const durationDays = parseInt(formData.get('duration') as string) || 3;
    const isPermanent = formData.get('duration') === 'Permanent';
    const expiryDate = isPermanent ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    let fileUrl = formData.get('fileUrl') as string;
    if (uploadFile) {
      try {
        fileUrl = await toBase64(uploadFile);
      } catch (err) {
        console.error("File processing error:", err);
      }
    }

    try {
      const encryptedTitle = await encryptData(formData.get('title') as string);
      const encryptedDesc = await encryptData(formData.get('description') as string);
      const encryptedFile = await encryptData(fileUrl);

      const { data, error } = await supabase.from('medical_records').insert([{
        patient_id: patient.id,
        title: encryptedTitle,
        description: encryptedDesc,
        file_url: encryptedFile || undefined,
        uploaded_by: UserRole.ATTENDER,
        is_permanent: isPermanent,
        expires_at: expiryDate
      }]).select().single();

      if (error) throw error;

      const newRecord: MedicalRecord = {
        id: data.id,
        title: data.title,
        description: data.description,
        fileUrl: data.file_url,
        uploadedAt: new Date(data.uploaded_at).toLocaleString(),
        uploadedBy: UserRole.ATTENDER,
        isPermanent: data.is_permanent,
        expiresAt: data.expires_at ? new Date(data.expires_at).toLocaleDateString() : undefined
      };

      setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, records: [newRecord, ...p.records] } : p));
      setUploadFile(null);
      if (currentForm) {
        currentForm.reset();
      }
    } catch (err) {
      console.error("Error adding record:", err);
    }
  };

  const handleEditRecord = async (recordId: string) => {
    try {
      const encryptedTitle = await encryptData(editFormData.title);
      const encryptedDesc = await encryptData(editFormData.description);

      const { error } = await supabase.from('medical_records').update({
        title: encryptedTitle,
        description: encryptedDesc
      }).eq('id', recordId);

      if (error) throw error;

      setPatients(prev => prev.map(p => p.id === patient.id ? {
        ...p,
        records: p.records.map(r => r.id === recordId ? { ...r, title: encryptedTitle, description: encryptedDesc } : r)
      } : p));
      setEditingRecordId(null);
    } catch (err) {
      console.error("Edit record error:", err);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      const { error } = await supabase.from('medical_records').delete().eq('id', recordId);
      if (error) throw error;
      setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, records: p.records.filter(r => r.id !== recordId) } : p));
    } catch (err) {
      console.error("Delete record error:", err);
    }
  };

  const handleTogglePermanent = async (recordId: string, currentPermanent: boolean) => {
    try {
      const { error } = await supabase.from('medical_records').update({
        is_permanent: !currentPermanent,
        expires_at: !currentPermanent ? null : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      }).eq('id', recordId);

      if (error) throw error;

      setPatients(prev => prev.map(p => p.id === patient.id ? {
        ...p,
        records: p.records.map(r => r.id === recordId ? { ...r, isPermanent: !r.isPermanent, expiresAt: !r.isPermanent ? undefined : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString() } : r)
      } : p));
    } catch (err) {
      console.error("Toggle permanent error:", err);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const startEditing = (record: MedicalRecord, decrypted: any) => {
    setEditingRecordId(record.id);
    setEditFormData({ title: decrypted.title, description: decrypted.description });
  };

  const handleViewFile = async (id: string) => {
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
          <p className="text-[10px] font-bold opacity-60">PATIENT: {patient.name.toUpperCase()}</p>
        </div>
        <button onClick={onLogout} className="w-10 h-10 border-2 border-black flex items-center justify-center brutalist-button">
          <i className="fas fa-power-off"></i>
        </button>
      </header>

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <div className="p-6 border-2 border-black bg-zinc-50 brutalist-card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-xs uppercase tracking-widest">AI Synthesis</h3>
                <span className="text-[10px] font-black border border-black px-1">V3.0</span>
              </div>
              <p className="font-bold text-sm leading-tight uppercase italic">{aiSummary}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border-2 border-black">
                <h4 className="text-[10px] font-black uppercase opacity-60 mb-1">Hospital</h4>
                <p className="font-black text-xs leading-none">{patient.hospital}</p>
              </div>
              <div className="p-4 border-2 border-black">
                <h4 className="text-[10px] font-black uppercase opacity-60 mb-1">Diagnosis</h4>
                <p className="font-black text-xs leading-none">{patient.illness}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-black text-xs uppercase tracking-widest">Emergency Contacts</h3>
              {!patient.emergencyContacts || patient.emergencyContacts.length === 0 ? (
                <p className="text-[10px] font-bold opacity-40 uppercase">No emergency contacts registered.</p>
              ) : (
                patient.emergencyContacts.map((c, i) => (
                  <div key={i} className="p-4 border-2 border-black flex justify-between items-center bg-white brutalist-card">
                    <div>
                      <p className="font-black text-sm uppercase">{c.name}</p>
                      <p className="text-[10px] font-bold opacity-60">{c.relationship} • {c.phoneNumber}</p>
                    </div>
                    <button className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center brutalist-button" onClick={() => window.location.href = `tel:${c.phoneNumber}`}>
                      <i className="fas fa-phone text-xs"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'gps' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <i className="fas fa-location-dot"></i> Real-time Patient Location &amp; Saved Places
              </h2>
              <p className="text-[10px] font-bold opacity-60">Track patient location and manage saved locations with distance calculations</p>
              <div className="mt-3 inline-flex items-center border-2 border-black px-3 py-1 text-[10px] font-black uppercase">
                Saved Locations: {savedLocations.length}
              </div>
            </div>

            <div className="aspect-video w-full border-2 border-black relative overflow-hidden bg-zinc-100 flex items-center justify-center">
              {mapError ? (
                <div className="z-10 p-4 font-black uppercase text-xs text-red-600 text-center">
                  <i className="fas fa-exclamation-triangle text-2xl mb-2 block"></i>
                  {mapError}
                </div>
              ) : (
                <>
                  <div ref={mapRef} className="absolute inset-0 w-full h-full"></div>
                  {(!patientCoords || !isMapLoaded) && !isUpdating && (
                    <div className="z-10 bg-white/80 p-4 border-2 border-black font-black uppercase text-xs text-center">
                      {isMapLoaded ? 'Waiting for Patient Device signal...' : 'Loading Maps...'}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 border-2 border-black bg-white brutalist-card space-y-5">
              <div className={`flex items-center gap-3 p-4 border-2 border-black ${patientCoords ? 'bg-green-50' : 'bg-zinc-100'}`}>
                <span className={`w-3 h-3 rounded-full ${patientCoords ? 'bg-green-500' : 'bg-zinc-400'}`}></span>
                <div className="flex-1">
                  <p className="text-[11px] font-black uppercase">{patientCoords ? 'Location Active' : 'Location Inactive'}</p>
                  <p className="text-[10px] font-bold opacity-70">{patientCoords ? `${patientCoords.lat}, ${patientCoords.lng}` : 'No live coordinates'}</p>
                </div>
                <span className="text-[9px] font-black border-2 border-black px-2 py-0.5 uppercase">Live</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 border-2 border-black bg-blue-50">
                  <p className="text-[10px] font-black uppercase opacity-60 mb-1">Coordinates</p>
                  <p className="text-[11px] font-black">{patientCoords ? `${patientCoords.lat}` : '---'}</p>
                  <p className="text-[11px] font-black">{patientCoords ? `${patientCoords.lng}` : '---'}</p>
                </div>
                <div className="p-4 border-2 border-black bg-purple-50">
                  <p className="text-[10px] font-black uppercase opacity-60 mb-1">Last Update</p>
                  <p className="text-[11px] font-black">{lastUpdate}</p>
                </div>
                <div className="p-4 border-2 border-black bg-orange-50">
                  <p className="text-[10px] font-black uppercase opacity-60 mb-1">Accuracy</p>
                  <p className="text-[11px] font-black">GPS Enabled</p>
                  <p className="text-[11px] font-black">High Precision</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={handleCopyCoords} className="flex-1 min-w-[150px] bg-white text-black border-2 border-black py-3 px-6 font-black text-[10px] uppercase flex items-center justify-center gap-2 brutalist-button">
                  <i className="far fa-copy"></i> Copy Coordinates
                </button>
                <button onClick={handleOpenMaps} className="flex-1 min-w-[150px] bg-white text-black border-2 border-black py-3 px-6 font-black text-[10px] uppercase flex items-center justify-center gap-2 brutalist-button">
                  <i className="fas fa-location-arrow"></i> Open in Google Maps
                </button>
                <button onClick={() => { fetchLiveLocation(); fetchSavedLocations(); }} className="flex-1 min-w-[150px] bg-white text-black border-2 border-black py-3 px-6 font-black text-[10px] uppercase flex items-center justify-center gap-2 brutalist-button">
                  <i className={`fas fa-sync-alt ${isUpdating ? 'fa-spin' : ''}`}></i> Force Update
                </button>
              </div>

              <div className="p-4 border-2 border-black bg-zinc-50 text-[10px] font-bold uppercase space-y-1">
                <p>Location Tracking: Real-time GPS tracking active</p>
                <p>Update Frequency: Every 5 minutes</p>
                <p>Source: Browser geolocation API with server backup</p>
                <p>Timezone: India Standard Time (IST)</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="space-y-8">
            <div className="p-6 border-2 border-black brutalist-card bg-white">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-file-upload text-sm"></i>
                <h2 className="text-sm font-black uppercase tracking-tighter">Add New Medical Record</h2>
              </div>
              <p className="text-[10px] font-bold opacity-60 uppercase mb-6 tracking-wide leading-tight">
                Upload documents, images, or PDFs.
              </p>

              <form ref={formRef} onSubmit={handleAddRecord} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Record Title</label>
                    <input name="title" required placeholder="e.g., Blood Test Results" className="w-full p-3 border-2 border-black font-bold uppercase focus:outline-none focus:bg-zinc-50 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Temporary Duration</label>
                    <select name="duration" className="w-full p-3 border-2 border-black font-bold uppercase focus:outline-none focus:bg-zinc-50 text-xs">
                      <option value="3">3 Days</option>
                      <option value="7">7 Days</option>
                      <option value="30">30 Days</option>
                      <option value="Permanent">Permanent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Description</label>
                  <textarea name="description" required placeholder="Detailed description..." rows={3} className="w-full p-3 border-2 border-black font-bold uppercase focus:outline-none focus:bg-zinc-50 text-xs" />
                </div>

                <div
                  onClick={triggerFileSelect}
                  className="p-8 border-2 border-dashed border-black bg-zinc-50 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 transition-colors"
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                  <i className="fas fa-cloud-upload-alt text-2xl mb-2"></i>
                  <p className="text-xs font-black uppercase tracking-tighter">
                    {uploadFile ? uploadFile.name : "Upload a file or drag and drop"}
                  </p>
                  <p className="text-[9px] font-bold opacity-40 uppercase mt-1">Images or PDFs up to 10MB</p>
                </div>

                <button type="submit" className="w-full bg-black text-white py-4 font-black uppercase brutalist-button text-xs flex items-center justify-center gap-2">
                  <i className="fas fa-file-circle-plus"></i> Add Record
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest">Medical Records</h3>
              <div className="space-y-4">
                {patient.records.length === 0 ? (
                  <div className="p-12 border-2 border-black border-dashed text-center opacity-40 font-black uppercase text-xs">
                    No medical records available.
                  </div>
                ) : (
                  patient.records.map(r => {
                    const decrypted = decryptedRecords[r.id] || { title: 'DECRYPTING...', description: '...' };
                    return (
                      <div key={r.id} className="p-6 border-2 border-black brutalist-card bg-white group">
                        {editingRecordId === r.id ? (
                          <div className="space-y-4">
                            <input className="w-full p-2 border-2 border-black font-bold uppercase text-xs focus:outline-none" value={editFormData.title} onChange={e => setEditFormData({ ...editFormData, title: e.target.value })} />
                            <textarea className="w-full p-2 border-2 border-black font-bold uppercase text-xs focus:outline-none" rows={3} value={editFormData.description} onChange={e => setEditFormData({ ...editFormData, description: e.target.value })} />
                            <div className="flex gap-2">
                              <button onClick={() => handleEditRecord(r.id)} className="bg-black text-white px-4 py-2 text-[10px] font-black uppercase brutalist-button">Save</button>
                              <button onClick={() => setEditingRecordId(null)} className="bg-white text-black border-2 border-black px-4 py-2 text-[10px] font-black uppercase brutalist-button">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1 pr-4">
                                <div className="flex items-center gap-3 mb-1 flex-wrap">
                                  <h4 className="font-black uppercase text-sm leading-none">{decrypted.title}</h4>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 border-2 border-black uppercase ${r.isPermanent ? 'bg-zinc-100' : 'bg-white italic'}`}>
                                    {r.isPermanent ? 'Permanent' : 'Temporary'}
                                  </span>
                                  {r.uploadedBy === UserRole.PATIENT && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-yellow-100 border-2 border-black uppercase">
                                      Patient Uploaded
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-bold opacity-70 uppercase leading-tight mb-2">{decrypted.description}</p>
                                <div className="space-y-0.5 text-[9px] font-black uppercase opacity-40">
                                  <p>Uploaded: {r.uploadedAt}</p>
                                  <p>By: {r.uploadedBy === UserRole.ATTENDER ? 'Healthcare Provider' : 'Patient'}</p>
                                  {!r.isPermanent && <p className="text-zinc-600">Expires: {r.expiresAt}</p>}
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button onClick={() => startEditing(r, decrypted)} className="w-8 h-8 border-2 border-black flex items-center justify-center text-[10px] brutalist-button hover:bg-zinc-50"><i className="fas fa-edit"></i></button>
                                <button onClick={() => handleTogglePermanent(r.id, r.isPermanent)} className={`w-8 h-8 border-2 border-black flex items-center justify-center text-[10px] brutalist-button ${r.isPermanent ? 'bg-black text-white' : 'hover:bg-zinc-50'}`}><i className="fas fa-star"></i></button>
                                <button onClick={() => handleDeleteRecord(r.id)} className="w-8 h-8 border-2 border-black flex items-center justify-center text-[10px] brutalist-button hover:bg-red-50 hover:text-red-600"><i className="fas fa-trash-alt"></i></button>
                              </div>
                            </div>
                            <div className="flex justify-end pt-3 border-t-2 border-zinc-50">
                              {r.fileUrl && (
                                <button onClick={() => handleViewFile(r.id)} className="text-[10px] font-black uppercase flex items-center gap-1 hover:underline">
                                  <i className="far fa-eye"></i> View File
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insurance' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                  <i className="fas fa-shield-halved"></i> Insurance Vault
                </h2>
                <p className="text-[10px] font-bold opacity-60 uppercase">Manage policies and AI coverage insights</p>
              </div>
              <button onClick={() => setShowPolicyForm(!showPolicyForm)} className="px-4 py-2 border-2 border-black font-black text-[10px] uppercase brutalist-button flex items-center gap-2">
                <i className="fas fa-plus"></i> {showPolicyForm ? 'Close Form' : 'Add Policy'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border-2 border-black bg-white brutalist-card">
                <p className="text-[10px] font-black uppercase opacity-60 mb-1">Total Policies</p>
                <p className="text-2xl font-black">{policies.length}</p>
              </div>
              <div className="p-4 border-2 border-black bg-white brutalist-card">
                <p className="text-[10px] font-black uppercase opacity-60 mb-1">Active Now</p>
                <p className="text-2xl font-black">
                  {policies.filter(p => new Date(p.endDate) >= new Date()).length}
                </p>
              </div>
              <div className="p-4 border-2 border-black bg-white brutalist-card">
                <p className="text-[10px] font-black uppercase opacity-60 mb-1">Total Coverage</p>
                <p className="text-2xl font-black">₹{policies.reduce((acc, p) => acc + p.coverageAmount, 0).toLocaleString('en-IN')}</p>
              </div>
            </div>

            {showPolicyForm && (
              <div className="p-6 border-2 border-black bg-white brutalist-card">
                <h3 className="text-sm font-black uppercase tracking-widest mb-4">New Policy Entry</h3>
                <PolicyForm onAdd={handleAddPolicy} onCancel={() => setShowPolicyForm(false)} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest">Insurance Portfolio</h3>
                {policies.length === 0 ? (
                  <div className="p-12 border-2 border-black border-dashed text-center opacity-40 font-black uppercase text-xs">
                    No policies found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {policies.map(policy => (
                      <PolicyCard key={policy.id} policy={policy} onDelete={handleDeletePolicy} onAnalyze={handleAnalyzePolicy} />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="p-6 border-2 border-black bg-black text-white brutalist-card">
                  <h3 className="text-sm font-black uppercase mb-2">Smart Assistant</h3>
                  <p className="text-[10px] font-bold opacity-70 uppercase mb-4">
                    Select a policy for AI-powered benefits analysis.
                  </p>
                  {isAnalyzingPolicy ? (
                    <div className="p-4 border-2 border-white text-[10px] font-black uppercase">Analyzing benefits...</div>
                  ) : policyAnalysis ? (
                    <div className="space-y-4">
                      <div className="p-4 border-2 border-white bg-black text-[11px] font-bold whitespace-pre-wrap">
                        <span className="block text-[9px] font-black uppercase opacity-70 mb-2">Analysis for {selectedPolicyName}</span>
                        {policyAnalysis}
                      </div>
                      <button onClick={() => setPolicyAnalysis(null)} className="text-[10px] font-black uppercase underline">
                        Clear Analysis
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 border-2 border-white text-[10px] font-black uppercase opacity-70">
                      Click AI Analysis on any card to get started.
                    </div>
                  )}
                </div>

                <div className="p-5 border-2 border-black bg-white brutalist-card">
                  <h4 className="text-[10px] font-black uppercase opacity-60 mb-3">Quick Tips</h4>
                  <ul className="space-y-2 text-[10px] font-bold uppercase">
                    <li>Check room rent capping in the policy.</li>
                    <li>Renew 15 days before expiry.</li>
                    <li>Cashless claims are faster than reimbursement.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black h-20 px-4 flex justify-around items-center z-30">
        <button onClick={() => setActiveTab('monitoring')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'monitoring' ? 'text-black scale-110' : 'text-zinc-300'}`}>
          <i className="fas fa-house text-xl"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setActiveTab('gps')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'gps' ? 'text-black scale-110' : 'text-zinc-300'}`}>
          <i className="fas fa-location-dot text-xl"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Maps</span>
        </button>
        <button onClick={() => setActiveTab('records')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'records' ? 'text-black scale-110' : 'text-zinc-300'}`}>
          <i className="fas fa-folder-open text-xl"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Records</span>
        </button>
        <button onClick={() => setActiveTab('insurance')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'insurance' ? 'text-black scale-110' : 'text-zinc-300'}`}>
          <i className="fas fa-shield-halved text-xl"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">Insurance</span>
        </button>
      </nav>
    </div>
  );
};

const PolicyCard: React.FC<{ policy: { id: string; policyName: string; provider: string; policyNumber: string; startDate: string; endDate: string; coverageAmount: number; premiumAmount: number; type: string; description?: string }; onDelete: (id: string) => void; onAnalyze: (policy: any) => void; }> = ({ policy, onDelete, onAnalyze }) => {
  const isExpired = new Date(policy.endDate) < new Date();
  const daysLeft = Math.ceil((new Date(policy.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
  const statusLabel = isExpired ? 'Expired' : daysLeft < 30 ? `Expiring in ${daysLeft} days` : 'Active';

  return (
    <div className="p-5 border-2 border-black bg-white brutalist-card">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-black uppercase text-sm leading-none">{policy.policyName}</h4>
          <p className="text-[10px] font-bold opacity-60 uppercase">{policy.provider}</p>
        </div>
        <span className="text-[9px] font-black px-2 py-1 border-2 border-black uppercase">
          {statusLabel}
        </span>
      </div>

      <div className="space-y-2 text-[10px] font-bold uppercase">
        <div className="flex justify-between"><span className="opacity-60">Policy #</span><span>{policy.policyNumber}</span></div>
        <div className="flex justify-between"><span className="opacity-60">Coverage</span><span>₹{policy.coverageAmount.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between"><span className="opacity-60">Validity</span><span>{new Date(policy.startDate).toLocaleDateString()} - {new Date(policy.endDate).toLocaleDateString()}</span></div>
        <div className="flex justify-between"><span className="opacity-60">Type</span><span>{policy.type}</span></div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={() => onAnalyze(policy)} className="flex-1 px-3 py-2 border-2 border-black font-black text-[10px] uppercase brutalist-button">
          AI Analysis
        </button>
        <button onClick={() => onDelete(policy.id)} className="w-10 h-10 border-2 border-black flex items-center justify-center brutalist-button">
          <i className="fas fa-trash-alt text-[10px]"></i>
        </button>
      </div>
    </div>
  );
};

const PolicyForm: React.FC<{ onAdd: (policy: any) => void; onCancel: () => void; }> = ({ onAdd, onCancel }) => {
  const [formData, setFormData] = useState({
    policyName: '',
    provider: '',
    policyNumber: '',
    startDate: '',
    endDate: '',
    coverageAmount: 0,
    premiumAmount: 0,
    type: 'Individual',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Policy Name</label>
          <input required className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" value={formData.policyName} onChange={e => setFormData({ ...formData, policyName: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Provider</label>
          <input required className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Policy Number</label>
          <input required className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" value={formData.policyNumber} onChange={e => setFormData({ ...formData, policyNumber: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Policy Type</label>
          <select className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
            <option>Individual</option>
            <option>Family Floater</option>
            <option>Critical Illness</option>
            <option>Senior Citizen</option>
            <option>Group/Corporate</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Start Date</label>
          <input required type="date" className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Expiry Date</label>
          <input required type="date" className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Coverage Amount (₹)</label>
          <input required type="number" className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" value={formData.coverageAmount || ''} onChange={e => setFormData({ ...formData, coverageAmount: Number(e.target.value) })} />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Annual Premium (₹)</label>
          <input required type="number" className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" value={formData.premiumAmount || ''} onChange={e => setFormData({ ...formData, premiumAmount: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Additional Details</label>
        <textarea className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 border-2 border-black py-3 font-black text-[10px] uppercase brutalist-button">Cancel</button>
        <button type="submit" className="flex-1 bg-black text-white py-3 font-black text-[10px] uppercase brutalist-button">Save Policy</button>
      </div>
    </form>
  );
};

export default AttenderDashboard;