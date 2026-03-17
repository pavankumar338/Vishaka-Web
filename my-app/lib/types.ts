export interface Participant {
    id: string;
    name: string;
    registerNumber: string;
    year: string;
    department: string;
    section: string;
    game: string;
    email: string;
    status: 'registered' | 'checked-in' | 'checked-out' | 'cancelled';
    event: string;
    registrationDate: string;
    qrValue: string;
}
