export interface Participant {
    id: string;
    participant_id?: string;
    name: string;
    participant_name?: string;
    registerNumber: string;
    year: string;
    department: string;
    section: string;
    game: string;
    email: string;
    mobile?: string;
    category?: string;
    culturalInterest?: string;
    status: 'registered' | 'checked-in' | 'checked-out' | 'cancelled';
    event: string;
    registrationDate: string;
    qrValue: string;
}

