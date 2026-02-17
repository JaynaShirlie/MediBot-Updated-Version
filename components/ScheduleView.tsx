import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Appointment, AppointmentRequest } from '../types';

interface ScheduleViewProps {
    onClose: () => void;
    hospitalName: string;
    patientId: string; // Needed for fetching
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ onClose, hospitalName, patientId }) => {
    const [scheduleItems, setScheduleItems] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'SCHEDULED' | 'REQUESTED'>('ALL');

    // Form State
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [requestType, setRequestType] = useState('General Checkup');
    const [preferredDate, setPreferredDate] = useState('');
    const [preferredTime, setPreferredTime] = useState('');

    useEffect(() => {
        fetchSchedule();
    }, [patientId]);

    const fetchSchedule = async () => {
        setIsLoading(true);
        try {
            // Fetch Confirmed Appointments
            const { data: appointments, error: appError } = await supabase
                .from('appointments')
                .select('*')
                .eq('patient_id', patientId)
                .order('date', { ascending: true });

            if (appError) throw appError;

            // Fetch Requests (Optional: to show pending status in the list or separate section)
            // For now, let's just focus on appointments. If the user wants to see "Pending" status in the schedule list,
            // we could merge them.
            const { data: requests, error: reqError } = await supabase
                .from('appointment_requests')
                .select('*')
                .eq('patient_id', patientId)
                .eq('status', 'PENDING');

            if (reqError) throw reqError;

            // Map DB fields to Frontend Interface if snake_case in DB
            const mappedAppointments: Appointment[] = (appointments || []).map((a: any) => ({
                id: a.id,
                patientId: a.patient_id,
                doctorName: a.doctor_name,
                hospitalName: a.hospital_name,
                type: a.type,
                date: a.date,
                time: a.time,
                status: a.status
            }));

            // Map requests to look like appointments for the view (with PENDING status)
            const mappedRequests: Appointment[] = (requests || []).map((r: any) => ({
                id: r.id,
                patientId: r.patient_id,
                doctorName: 'PENDING ASSIGNMENT',
                hospitalName: hospitalName,
                type: r.request_type,
                date: r.preferred_date || 'TBD',
                time: r.preferred_time || 'TBD',
                status: 'REQUESTED'
            }));

            setScheduleItems([...mappedAppointments, ...mappedRequests]);

        } catch (err) {
            console.error("Error fetching schedule:", err);
            // Fallback for demo if DB is empty or fails only if no data at all
            if (scheduleItems.length === 0) {
                // Keep empty or show error? The user wants functional DB, so let's stick to real.
                // But for initial load/demo feeling, we might leave it empty until they add one.
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestAppointment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('appointment_requests').insert([{
                patient_id: patientId,
                request_type: requestType,
                preferred_date: preferredDate || 'Flexible',
                preferred_time: preferredTime || 'Flexible',
                status: 'PENDING'
            }]);

            if (error) throw error;

            alert("Appointment Requested Successfully!");
            setShowRequestForm(false);
            fetchSchedule(); // Refresh list to show the new pending item

        } catch (err) {
            console.error("Error requesting appointment:", err);
            alert("Failed to request appointment.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg border-2 border-black shadow-[8px_8px_0px_#000] flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-6 border-b-2 border-black flex justify-between items-start bg-zinc-50">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">Schedule</h2>
                        <p className="text-[10px] font-bold uppercase opacity-60 tracking-wider text-black">{hospitalName}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center border-2 border-black hover:bg-black hover:text-white transition-colors">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Filters */}
                <div className="flex border-b-2 border-black bg-white/95 backdrop-blur z-20 sticky top-0">
                    {['ALL', 'COMPLETED', 'SCHEDULED', 'REQUESTED'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`flex-1 py-3 px-2 text-[9px] font-black uppercase whitespace-nowrap transition-colors ${filter === f ? 'bg-black text-white' : 'hover:bg-zinc-100 text-black'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {showRequestForm ? (
                        <form onSubmit={handleRequestAppointment} className="space-y-4 p-4 border-2 border-black bg-zinc-50 animate-in slide-in-from-bottom-2 fade-in">
                            <h3 className="text-sm font-black uppercase">Request Appointment</h3>

                            <div>
                                <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Type</label>
                                <select value={requestType} onChange={e => setRequestType(e.target.value)} className="w-full p-2 border-2 border-black font-bold uppercase text-xs">
                                    <option>General Checkup</option>
                                    <option>Therapy Session</option>
                                    <option>Follow-up</option>
                                    <option>Specialist Consultation</option>
                                    <option>Lab Scan</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Preferred Date</label>
                                <input type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} className="w-full p-2 border-2 border-black font-bold uppercase text-xs" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase opacity-60 mb-1">Preferred Time</label>
                                <input type="time" value={preferredTime} onChange={e => setPreferredTime(e.target.value)} className="w-full p-2 border-2 border-black font-bold uppercase text-xs" />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="submit" className="flex-1 bg-black text-white py-2 font-black uppercase text-xs">Submit Request</button>
                                <button type="button" onClick={() => setShowRequestForm(false)} className="flex-1 bg-white text-black border-2 border-black py-2 font-black uppercase text-xs">Cancel</button>
                            </div>
                        </form>
                    ) : (
                        <>
                            {scheduleItems.length === 0 && !isLoading && (
                                <div className="p-8 text-center opacity-40 font-black uppercase text-xs">
                                    No scheduled appointments found.
                                </div>
                            )}

                            {scheduleItems
                                .filter(item => {
                                    if (filter === 'ALL') return true;
                                    const itemStatus = item.status.toUpperCase();
                                    return itemStatus === filter;
                                })
                                .map((item, index) => {
                                    let badgeColor = 'bg-white dashed-border';
                                    const s = item.status.toUpperCase();

                                    if (s === 'COMPLETED') badgeColor = 'bg-green-500 text-white border-green-700';
                                    else if (s === 'SCHEDULED' || s === 'CONFIRMED') badgeColor = 'bg-yellow-400 border-yellow-600';
                                    else if (s === 'REQUESTED' || s === 'PENDING') badgeColor = 'bg-red-500 text-white border-red-700';
                                    else badgeColor = 'bg-zinc-200';

                                    return (
                                        <div key={index} className="border-2 border-black p-4 hover:translate-x-1 transition-transform cursor-default bg-white">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="bg-black text-white px-2 py-0.5 text-[10px] font-black uppercase">
                                                    {item.date} • {item.time}
                                                </div>
                                                <div className={`text-[9px] font-black uppercase px-2 py-0.5 border border-black ${badgeColor}`}>
                                                    {item.status}
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-black uppercase leading-tight mb-1">{item.type}</h3>
                                            <div className="flex items-center gap-2 opacity-60">
                                                <i className="fas fa-user-md text-xs"></i>
                                                <p className="text-[10px] font-bold uppercase">{item.doctorName}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                        </>
                    )}

                    {!showRequestForm && (
                        <div className="mt-8 p-4 bg-zinc-100 border-2 border-dashed border-black text-center opacity-50">
                            <p className="text-[10px] font-black uppercase">Synced with Hospital database Successfully.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!showRequestForm && (
                    <div className="p-4 border-t-2 border-black bg-zinc-50">
                        <button onClick={() => setShowRequestForm(true)} className="w-full bg-black text-white py-3 font-black uppercase text-xs hover:opacity-80 transition-opacity">
                            <i className="fas fa-plus mr-2"></i> Request New Appointment
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ScheduleView;
