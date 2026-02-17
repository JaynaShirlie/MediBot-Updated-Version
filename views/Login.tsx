
import React, { useState } from 'react';
import { UserRole, PatientData, AttenderData } from '../types';

interface LoginProps {
  patients: PatientData[];
  attenders: AttenderData[];
  onLogin: (user: any, role: UserRole) => void;
  onBack: () => void;
}

const Login: React.FC<LoginProps> = ({ patients, attenders, onLogin, onBack }) => {
  const [role, setRole] = useState<UserRole>(UserRole.ATTENDER);
  const [formData, setFormData] = useState({ name: '', phone: '', patientCode: '' });
  const [error, setError] = useState('');

  const normalizeName = (value: string) => value.trim().toLowerCase();
  const normalizePhone = (value: string) => value.replace(/\D/g, '');
  const normalizeCode = (value: string) => value.trim().toUpperCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === UserRole.ATTENDER) {
      const nameInput = normalizeName(formData.name);
      const phoneInput = normalizePhone(formData.phone);
      const found = attenders.find(a => normalizeName(a.name) === nameInput && normalizePhone(a.phoneNumber) === phoneInput);
      if (found) onLogin(found, UserRole.ATTENDER);
      else setError('User not found.');
    } else {
      const nameInput = normalizeName(formData.name);
      const codeInput = normalizeCode(formData.patientCode);
      const found = patients.find(p => normalizeCode(p.uniqueCode) === codeInput && normalizeName(p.name) === nameInput);
      if (found) onLogin(found, UserRole.PATIENT);
      else setError('Invalid credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-black">
      <div className="w-full max-w-sm">
        <div className="flex items-center mb-10">
          <button onClick={onBack} className="w-10 h-10 border-2 border-black flex items-center justify-center mr-4">
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Login</h1>
        </div>

        <div className="flex border-2 border-black mb-8">
          <button 
            onClick={() => setRole(UserRole.ATTENDER)}
            className={`flex-1 py-3 font-black text-xs uppercase tracking-widest transition-all ${role === UserRole.ATTENDER ? 'bg-black text-white' : 'bg-white text-black'}`}
          >
            Attender
          </button>
          <button 
            onClick={() => setRole(UserRole.PATIENT)}
            className={`flex-1 py-3 font-black text-xs uppercase tracking-widest transition-all ${role === UserRole.PATIENT ? 'bg-black text-white' : 'bg-white text-black'}`}
          >
            Patient
          </button>
        </div>

        {error && <div className="mb-6 p-4 border-2 border-black bg-zinc-100 font-bold text-xs uppercase">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {role === UserRole.PATIENT && (
            <div>
              <label className="block text-[10px] font-black uppercase mb-1">Patient Code</label>
              <input required className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold" value={formData.patientCode} onChange={e => setFormData({...formData, patientCode: e.target.value})} />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black uppercase mb-1">Full Name</label>
            <input required className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase mb-1">Phone Number</label>
            <input required type="tel" className="w-full p-4 border-2 border-black focus:outline-none focus:bg-zinc-50 font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          
          <button type="submit" className="w-full bg-black text-white py-5 font-black text-xl brutalist-button uppercase tracking-tighter">
            Enter System
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
