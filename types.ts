
export enum UserRole {
  PATIENT = 'PATIENT',
  ATTENDER = 'ATTENDER'
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phoneNumber: string;
}

export interface MedicalRecord {
  id: string;
  title: string;
  description: string;
  fileUrl?: string;
  fileName?: string;
  uploadedAt: string;
  uploadedBy: UserRole;
  isPermanent: boolean;
  expiresAt?: string;
}

export interface InsurancePolicy {
  provider: string;
  policyNumber: string;
  coverageLimit: number;
  maturityDate: string;
  monthlyPremium: number;
  details: string;
}

export interface PatientData {
  id: string;
  name: string;
  age: number;
  gender: string;
  phoneNumber: string;
  illness: string;
  hospital: string;
  address: string;
  uniqueCode: string;
  location?: {
    lat: number;
    lng: number;
    accuracy: number;
    lastUpdated: string;
  };
  emergencyContacts: EmergencyContact[];
  records: MedicalRecord[];
  insurance?: InsurancePolicy;
}

export interface AttenderData {
  id: string;
  name: string;
  age: number;
  gender: string;
  phoneNumber: string;
  relationshipWithPatient: string;
  address: string;
  patientId: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorName: string;
  hospitalName: string;
  type: string;
  date: string;
  time: string;
  status: 'CONFIRMED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'REQUESTED';
}

export interface AppointmentRequest {
  id: string;
  patientId: string;
  requestType: string;
  preferredDate?: string;
  preferredTime?: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}
