
import React, { useState } from 'react';
import { CHENNAI_HOSPITALS } from '../constants';
import { AttenderData, PatientData, EmergencyContact } from '../types';

interface RegisterAttenderProps {
  onComplete: (attender: AttenderData, patient: PatientData) => Promise<{ ok: boolean; error?: string }>;
  onBack: () => void;
  onLogin: () => void;
}

const RegisterAttender: React.FC<RegisterAttenderProps> = ({ onComplete, onBack, onLogin }) => {
  const [step, setStep] = useState(1);
  const [uniqueCode, setUniqueCode] = useState('');
  const [sameAddress, setSameAddress] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [attender, setAttender] = useState<Partial<AttenderData>>({
    name: '',
    age: undefined,
    gender: 'Other',
    phoneNumber: '',
    relationshipWithPatient: '',
    address: ''
  });
  
  const [patient, setPatient] = useState<Partial<PatientData>>({
    name: '',
    age: undefined,
    phoneNumber: '',
    gender: 'Other',
    hospital: CHENNAI_HOSPITALS[0],
    illness: '',
    address: '',
    emergencyContacts: []
  });

  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: '1', name: '', relationship: '', phoneNumber: '' },
    { id: '2', name: '', relationship: '', phoneNumber: '' }
  ]);

  const generateCode = () => {
    const code = 'PAT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setUniqueCode(code);
    return code;
  };

  const handleFinishStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleFinishStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3);
  };

  const handleAddContact = () => {
    if (contacts.length < 5) {
      setContacts([...contacts, { id: Math.random().toString(), name: '', relationship: '', phoneNumber: '' }]);
    }
  };

  const toggleSameAddress = () => {
    const newValue = !sameAddress;
    setSameAddress(newValue);
    if (newValue) {
      setPatient({ ...patient, address: attender.address });
    }
  };

  const handleCompleteRegistration = async () => {
    setSubmitError('');
    setIsSubmitting(true);
    const code = generateCode();
    const patientId = 'patient_' + Date.now();
    const attenderId = 'attender_' + Date.now();
    
    const finalPatient: PatientData = {
      ...patient as PatientData,
      id: patientId,
      uniqueCode: code,
      emergencyContacts: contacts.filter(c => c.name),
      records: [],
    };

    const finalAttender: AttenderData = {
      ...attender as AttenderData,
      id: attenderId,
      patientId: patientId
    };

    const result = await onComplete(finalAttender, finalPatient);
    if (result.ok) {
      setStep(4);
    } else {
      setSubmitError(result.error || 'Registration failed. Please try again.');
    }
    setIsSubmitting(false);
  };

  if (step === 4) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-black">
        <div className="border-2 border-black p-10 max-w-lg w-full text-center brutalist-card bg-white">
          <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
            <i className="fas fa-check"></i>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Success</h2>
          <p className="font-bold mb-8 uppercase text-sm opacity-60">
            Profile created. Link accounts using this code:
          </p>
          <div className="border-2 border-black p-6 bg-zinc-50 mb-8">
            <span className="text-4xl font-black tracking-widest">{uniqueCode}</span>
          </div>
          <div className="border-2 border-black bg-zinc-100 p-4 text-xs font-black uppercase mb-10 flex items-start text-left gap-3">
            <i className="fas fa-triangle-exclamation mt-0.5"></i>
            <p>Save this code. The patient requires it for system access.</p>
          </div>
          <button 
            onClick={onLogin}
            className="w-full bg-black text-white py-5 font-black text-xl brutalist-button uppercase tracking-tighter"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8 text-black">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-10">
          <button onClick={onBack} className="w-10 h-10 border-2 border-black flex items-center justify-center mr-4 brutalist-button">
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Registration</h1>
          <div className="ml-auto text-xs font-black uppercase tracking-widest opacity-40">Step {step} / 3</div>
        </div>

        <div className="border-2 border-black bg-white brutalist-card">
          <div className="p-8">
            {step === 1 && (
              <form onSubmit={handleFinishStep1} className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-2 mb-6">Attender Identification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Full Name</label>
                    <input required className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={attender.name} onChange={e => setAttender({...attender, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Age</label>
                    <input required type="number" className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={attender.age || ''} onChange={e => setAttender({...attender, age: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Gender</label>
                    <select className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={attender.gender} onChange={e => setAttender({...attender, gender: e.target.value})}>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Phone Number</label>
                    <input required type="tel" className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={attender.phoneNumber} onChange={e => setAttender({...attender, phoneNumber: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Relationship</label>
                    <input required placeholder="E.G. SON" className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={attender.relationshipWithPatient} onChange={e => setAttender({...attender, relationshipWithPatient: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Current Address</label>
                    <textarea required placeholder="FULL PHYSICAL ADDRESS" className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" rows={3} value={attender.address} onChange={e => setAttender({...attender, address: e.target.value})}></textarea>
                  </div>
                </div>
                <button type="submit" className="w-full bg-black text-white py-5 font-black text-xl brutalist-button uppercase tracking-tighter mt-8">
                  Next: Patient Specs
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleFinishStep2} className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-2 mb-6">Patient Identification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Patient Name</label>
                    <input required className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={patient.name} onChange={e => setPatient({...patient, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Age</label>
                    <input required type="number" className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={patient.age || ''} onChange={e => setPatient({...patient, age: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Phone</label>
                    <input required type="tel" className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={patient.phoneNumber} onChange={e => setPatient({...patient, phoneNumber: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Hospital (Chennai)</label>
                    <select className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" value={patient.hospital} onChange={e => setPatient({...patient, hospital: e.target.value})}>
                      {CHENNAI_HOSPITALS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase mb-1 opacity-60">Diagnosis</label>
                    <textarea required className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold uppercase" rows={2} value={patient.illness} onChange={e => setPatient({...patient, illness: e.target.value})}></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex justify-between items-end mb-1">
                      <label className="block text-[10px] font-black uppercase opacity-60">Existing Address</label>
                      <button 
                        type="button" 
                        onClick={toggleSameAddress}
                        className={`text-[9px] font-black uppercase border-2 border-black px-2 py-1 flex items-center gap-2 brutalist-button ${sameAddress ? 'bg-black text-white' : 'bg-white text-black'}`}
                      >
                        <i className={`fas ${sameAddress ? 'fa-check-square' : 'fa-square'}`}></i> Same as Attender
                      </button>
                    </div>
                    <textarea 
                      required 
                      disabled={sameAddress}
                      placeholder="PATIENT'S FULL ADDRESS" 
                      className={`w-full p-4 border-2 border-black focus:outline-none font-bold uppercase ${sameAddress ? 'bg-zinc-100 opacity-50' : 'focus:bg-zinc-50'}`} 
                      rows={3} 
                      value={patient.address} 
                      onChange={e => setPatient({...patient, address: e.target.value})}
                    ></textarea>
                  </div>
                </div>
                <button type="submit" className="w-full bg-black text-white py-5 font-black text-xl brutalist-button uppercase tracking-tighter mt-8">
                  Next: Contact Grid
                </button>
              </form>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-2 mb-6">Emergency Contact Grid</h3>
                {submitError && (
                  <div className="border-2 border-black bg-zinc-100 p-4 text-xs font-black uppercase">
                    {submitError}
                  </div>
                )}
                
                <div className="p-4 border-2 border-black bg-zinc-50 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase">Primary Contact</span>
                    <span className="text-[9px] font-black border border-black px-1 uppercase">Locked</span>
                  </div>
                  <div className="text-xs font-bold uppercase">
                    <p>{attender.name} ({attender.relationshipWithPatient})</p>
                    <p>{attender.phoneNumber}</p>
                  </div>
                </div>

                {contacts.map((contact, idx) => (
                  <div key={contact.id} className="p-4 border-2 border-black bg-white space-y-4 brutalist-card">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-black uppercase">Contact {idx + 1}</h4>
                      {idx >= 2 && (
                        <button onClick={() => setContacts(contacts.filter(c => c.id !== contact.id))} className="text-black hover:text-red-600 transition-colors">
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input 
                        placeholder="NAME" 
                        required 
                        className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" 
                        value={contact.name} 
                        onChange={e => {
                          const newContacts = [...contacts];
                          newContacts[idx].name = e.target.value.toUpperCase();
                          setContacts(newContacts);
                        }} 
                      />
                      <input 
                        placeholder="RELATION" 
                        required 
                        className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" 
                        value={contact.relationship} 
                        onChange={e => {
                          const newContacts = [...contacts];
                          newContacts[idx].relationship = e.target.value.toUpperCase();
                          setContacts(newContacts);
                        }} 
                      />
                      <input 
                        placeholder="PHONE" 
                        required 
                        type="tel" 
                        className="w-full p-3 border-2 border-black font-bold uppercase text-xs focus:outline-none focus:bg-zinc-50" 
                        value={contact.phoneNumber} 
                        onChange={e => {
                          const newContacts = [...contacts];
                          newContacts[idx].phoneNumber = e.target.value;
                          setContacts(newContacts);
                        }} 
                      />
                    </div>
                  </div>
                ))}

                {contacts.length < 5 && (
                  <button onClick={handleAddContact} className="w-full py-4 border-2 border-dashed border-black font-black uppercase text-[10px] tracking-widest hover:bg-zinc-50 transition-all">
                    <i className="fas fa-plus mr-2"></i> Add Contact (Max 5)
                  </button>
                )}

                <button 
                  onClick={handleCompleteRegistration}
                  disabled={isSubmitting || contacts.slice(0, 2).some(c => !c.name || !c.phoneNumber)}
                  className="w-full bg-black text-white py-5 font-black text-xl brutalist-button uppercase tracking-tighter mt-8 disabled:opacity-30 disabled:pointer-events-none"
                >
                  {isSubmitting ? 'Saving...' : 'Finalize Registration'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterAttender;
