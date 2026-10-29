import { supabase } from './supabase';
import { EventItem } from './types';

export const DEFAULT_EVENTS: EventItem[] = [
  {
    id: "vishaka-2026",
    title: "Vishaka 2K26 Main Symposium",
    code: "VISHAKA-2026",
    category: "Symposium",
    description: "The premier annual national-level technical and cultural symposium. Keynotes, project expos, and flagship competitive tracks.",
    venue: "Main Auditorium & Central Plaza",
    date: "2026-03-15",
    time: "09:00 AM - 05:00 PM",
    status: "active",
    maxCapacity: 500,
    colorTheme: "#f59e0b",
    createdAt: new Date().toISOString(),
  },
  {
    id: "codesprint-26",
    title: "CodeSprint Hackathon",
    code: "CODESPRINT-26",
    category: "Technical",
    description: "24-hour intense hackathon solving real-world AI, Web3, and IoT industry challenges. High-stakes developer battle.",
    venue: "Computing Hub Labs 4 & 5",
    date: "2026-03-15",
    time: "10:00 AM - Next Day",
    status: "active",
    maxCapacity: 150,
    colorTheme: "#3b82f6",
    createdAt: new Date().toISOString(),
  },
  {
    id: "robowars-26",
    title: "RoboWars: Arena Combat",
    code: "ROBOWARS-26",
    category: "Technical",
    description: "Wired and wireless heavyweight combat robotics fighting to the wire in an armored enclosed battle arena.",
    venue: "SAC Open Arena",
    date: "2026-03-16",
    time: "11:30 AM - 04:30 PM",
    status: "upcoming",
    maxCapacity: 120,
    colorTheme: "#ef4444",
    createdAt: new Date().toISOString(),
  },
  {
    id: "nritya-culturals",
    title: "Nritya: Mega Cultural Night",
    code: "NRITYA-CULT",
    category: "Cultural",
    description: "Electrifying dance battles, battle of the bands, classical rhythm, and celebrity musical extravaganza.",
    venue: "Open Air Amphitheatre",
    date: "2026-03-16",
    time: "05:30 PM - 10:00 PM",
    status: "upcoming",
    maxCapacity: 600,
    colorTheme: "#ec4899",
    createdAt: new Date().toISOString(),
  },
  {
    id: "valo-esports",
    title: "Valorant & BGMI Esports Arena",
    code: "VALO-ARENA",
    category: "Gaming",
    description: "High-octane LAN gaming tournament featuring top collegiate squads competing on 240Hz tournament rigs.",
    venue: "Multimedia High-Tech Lab",
    date: "2026-03-15",
    time: "01:00 PM - 07:00 PM",
    status: "active",
    maxCapacity: 100,
    colorTheme: "#10b981",
    createdAt: new Date().toISOString(),
  }
];

const STORAGE_KEY = "vishaka_events_data";

function getLocalEvents(): EventItem[] {
  if (typeof window === "undefined") return DEFAULT_EVENTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EVENTS));
      return DEFAULT_EVENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EVENTS));
      return DEFAULT_EVENTS;
    }
    return parsed;
  } catch {
    return DEFAULT_EVENTS;
  }
}

function saveLocalEvents(events: EventItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    console.error("Failed to save events to local storage:", e);
  }
}

export async function getEvents(): Promise<EventItem[]> {
  try {
    // Attempt Supabase fetch
    const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      const mapped: EventItem[] = data.map(item => ({
        id: item.id || item.event_id,
        title: item.title || item.name,
        code: item.code || item.slug || (item.title || "").toUpperCase().replace(/\s+/g, '-'),
        category: item.category || 'Technical',
        description: item.description || '',
        venue: item.venue || '',
        date: item.date || item.event_date || '',
        time: item.time || '',
        status: item.status || 'active',
        maxCapacity: item.max_capacity || item.capacity || 200,
        colorTheme: item.color_theme || '#f59e0b',
        createdAt: item.created_at || new Date().toISOString(),
        bannerUrl: item.banner_url || '',
        participantsTable: item.participants_table || item.participantsTable,
        checkInTable: item.check_in_table || item.checkInTable,
        tablesCreated: item.tables_created ?? item.tablesCreated ?? false,
      }));
      saveLocalEvents(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase events fetch skipped/failed, using local persistent storage:", err);
  }

  // Fallback to local storage with defaults
  return getLocalEvents();
}

export async function getEventById(id: string): Promise<EventItem | null> {
  const events = await getEvents();
  const lower = id.toLowerCase();
  const match = events.find(e => 
    e.id.toLowerCase() === lower || 
    e.code.toLowerCase() === lower ||
    e.title.toLowerCase().includes(lower)
  );
  return match || null;
}

export async function createEvent(newEvent: Omit<EventItem, 'id' | 'createdAt'>): Promise<EventItem> {
  const slug = newEvent.code 
    ? newEvent.code.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
    : newEvent.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  const id = `${slug}-${Date.now().toString(36)}`;
  const item: EventItem = {
    ...newEvent,
    id,
    createdAt: new Date().toISOString(),
  };

  // Try saving to Supabase
  try {
    await supabase.from('events').insert([{
      id: item.id,
      title: item.title,
      code: item.code,
      category: item.category,
      description: item.description,
      venue: item.venue,
      date: item.date,
      time: item.time,
      status: item.status,
      max_capacity: item.maxCapacity,
      color_theme: item.colorTheme,
      participants_table: item.participantsTable,
      check_in_table: item.checkInTable,
      tables_created: item.tablesCreated,
      created_at: item.createdAt,
    }]);
  } catch (err) {
    console.warn("Could not insert event into Supabase table:", err);
  }

  // Update local storage
  const current = getLocalEvents();
  const updated = [item, ...current];
  saveLocalEvents(updated);
  return item;
}

export async function updateEvent(id: string, updates: Partial<EventItem>): Promise<EventItem> {
  const current = getLocalEvents();
  const index = current.findIndex(e => e.id === id || e.code === id);
  
  if (index === -1) {
    throw new Error("Event not found");
  }

  const updatedItem: EventItem = {
    ...current[index],
    ...updates,
  };

  current[index] = updatedItem;
  saveLocalEvents(current);

  // Try updating Supabase
  try {
    await supabase.from('events').update({
      title: updatedItem.title,
      code: updatedItem.code,
      category: updatedItem.category,
      description: updatedItem.description,
      venue: updatedItem.venue,
      date: updatedItem.date,
      time: updatedItem.time,
      status: updatedItem.status,
      max_capacity: updatedItem.maxCapacity,
      color_theme: updatedItem.colorTheme,
      participants_table: updatedItem.participantsTable,
      check_in_table: updatedItem.checkInTable,
      tables_created: updatedItem.tablesCreated,
    }).or(`id.eq.${id},code.eq.${id}`);
  } catch (err) {
    console.warn("Could not update event in Supabase:", err);
  }

  return updatedItem;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const current = getLocalEvents();
  const filtered = current.filter(e => e.id !== id && e.code !== id);
  saveLocalEvents(filtered);

  // Try deleting from Supabase
  try {
    await supabase.from('events').delete().or(`id.eq.${id},code.eq.${id}`);
  } catch (err) {
    console.warn("Could not delete event from Supabase:", err);
  }

  return true;
}
