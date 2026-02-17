
import React, { useState, useEffect } from 'react';
import { UserRole, PatientData, AttenderData, MedicalRecord } from './types';
import Landing from './views/Landing';
import RegisterAttender from './views/RegisterAttender';
import AttenderDashboard from './views/AttenderDashboard';
import PatientDashboard from './views/PatientDashboard';
import Login from './views/Login';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'register-attender' | 'login' | 'attender-dashboard' | 'patient-dashboard'>('landing');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [attenders, setAttenders] = useState<AttenderData[]>([]);

  // Initial load from Supabase
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const { data: pData, error: pError } = await supabase.from('patients').select('*, medical_records(*)');
        const { data: aData, error: aError } = await supabase.from('attenders').select('*');
        
        if (pError || aError) throw pError || aError;

        if (pData) {
          const formattedPatients = pData.map(p => ({
            ...p,
            phoneNumber: p.phone_number,
            uniqueCode: p.unique_code,
            records: p.medical_records || [],
            emergencyContacts: p.emergency_contacts || [] // Use column from database
          }));
          setPatients(formattedPatients);
        }
        
        if (aData) {
          const formattedAttenders = aData.map(a => ({
            ...a,
            phoneNumber: a.phone_number,
            relationshipWithPatient: a.relationship_with_patient,
            patientId: a.patient_id
          }));
          setAttenders(formattedAttenders);
        }
      } catch (err) {
        console.error("Database fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const handleRegisterAttender = async (attender: AttenderData, patient: PatientData): Promise<{ ok: boolean; error?: string }> => {
    try {
      // 1. Insert Patient including emergency_contacts
      const { data: pData, error: pError } = await supabase.from('patients').insert([{
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone_number: patient.phoneNumber,
        illness: patient.illness,
        hospital: patient.hospital,
        address: patient.address,
        unique_code: patient.uniqueCode,
        emergency_contacts: patient.emergencyContacts // Include the grid contacts
      }]).select().single();

      if (pError) throw pError;

      // 2. Insert Attender with Patient ID
      const { data: aData, error: aError } = await supabase.from('attenders').insert([{
        name: attender.name,
        age: attender.age,
        gender: attender.gender,
        phone_number: attender.phoneNumber,
        relationship_with_patient: attender.relationshipWithPatient,
        address: attender.address,
        patient_id: pData.id
      }]).select().single();

      if (aError) throw aError;

      // Update local state with consistent naming
      const newPatient: PatientData = { ...patient, id: pData.id };
      const newAttender: AttenderData = { ...attender, id: aData.id, patientId: pData.id };
      
      setPatients(prev => [...prev, newPatient]);
      setAttenders(prev => [...prev, newAttender]);
      return { ok: true };
    } catch (err) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : 'Registration failed.';
      console.error("Registration error:", err);
      return { ok: false, error: message };
    }
  };

  const handleLogin = (user: any, userRole: UserRole) => {
    setCurrentUser(user);
    setRole(userRole);
    setCurrentView(userRole === UserRole.ATTENDER ? 'attender-dashboard' : 'patient-dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setRole(null);
    setCurrentView('landing');
  };

  if (isLoading && currentView === 'landing') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-black uppercase">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl mb-4"></i>
          <p>Syncing Medibot Core...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {currentView === 'landing' && (
        <Landing 
          onNavigate={(view) => setCurrentView(view as any)} 
        />
      )}

      {currentView === 'register-attender' && (
        <RegisterAttender 
          onComplete={handleRegisterAttender}
          onBack={() => setCurrentView('landing')}
          onLogin={() => setCurrentView('login')}
        />
      )}

      {currentView === 'login' && (
        <Login 
          patients={patients}
          attenders={attenders}
          onLogin={handleLogin}
          onBack={() => setCurrentView('landing')}
        />
      )}

      {currentView === 'attender-dashboard' && currentUser && (
        <AttenderDashboard 
          user={currentUser} 
          patients={patients}
          setPatients={setPatients}
          onLogout={handleLogout} 
        />
      )}

      {currentView === 'patient-dashboard' && currentUser && (
        <PatientDashboard 
          user={currentUser} 
          patients={patients}
          setPatients={setPatients}
          onLogout={handleLogout} 
        />
      )}
    </div>
  );
};

export default App;
