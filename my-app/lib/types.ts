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
export interface EventItem {
    id: string;
    title: string;
    code: string;
    category: 'Technical' | 'Cultural' | 'Sports' | 'Symposium' | 'Workshop' | 'Gaming' | 'General';
    description: string;
    venue: string;
    date: string;
    time?: string;
    status: 'active' | 'upcoming' | 'completed' | 'draft';
    maxCapacity?: number;
    colorTheme?: string;
    createdAt?: string;
    bannerUrl?: string;
    participantsTable?: string;
    checkInTable?: string;
    tablesCreated?: boolean;
}
