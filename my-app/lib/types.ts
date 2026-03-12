export interface Participant {
    id: string; // Format: EVENT2026-PART-XXXX
    name: string;
    email: string;
    college: string;
    team: string;
    status: 'registered' | 'checked-in' | 'cancelled';
    event: string;
    registrationDate: string;
    qrValue: string;
}
