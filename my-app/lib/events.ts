import { getEventTableNames } from './eventTables';
import { supabase } from './supabase';
import { EventItem } from './types';

export const DEFAULT_EVENTS: EventItem[] = [
  {
    id: "ignite2k26-mvi537sm",
    title: "Ignite2k26",
    code: "IGNITE2K26",
    category: "Cultural",
    description: "Annual flagship cultural festival and competition arena.",
    venue: "KrishnanAuditorium",
    date: "2026-10-31",
    time: "10:00 AM - 04:00 PM",
    status: "active",
    maxCapacity: 1000,
    colorTheme: "#10b981",
    participantsTable: "participants_ignite2k26",
    checkInTable: "check_in_logs_ignite2k26",
    tablesCreated: true,
    createdAt: "2026-10-21T13:20:01.846+00:00",
  }
];

const STORAGE_KEY = "vishaka_events_data";
const MOCK_EVENT_IDS = new Set(['vishaka-2026', 'codesprint-26', 'robowars-26', 'nritya-culturals', 'valo-esports']);

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
    // Filter out mock events if any were previously cached in localStorage
    const clean = parsed.filter(e => e && e.id && !MOCK_EVENT_IDS.has(e.id));
    if (clean.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean.length > 0 ? clean : DEFAULT_EVENTS));
    }
    return clean.length > 0 ? clean : DEFAULT_EVENTS;
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
      const mapped: EventItem[] = data.map(item => {
        const title = item.title || item.name || '';
        const { participantsTable, checkInTable } = getEventTableNames(title);
        return {
          id: item.id || item.event_id,
          title: title,
          code: item.code || item.slug || title.toUpperCase().replace(/\s+/g, '-'),
          category: item.category || 'Cultural',
          description: item.description || '',
          venue: item.venue || 'Campus Auditorium',
          date: item.date || item.event_date || '2026-10-31',
          time: item.time || '10:00 AM - 04:00 PM',
          status: item.status || 'active',
          maxCapacity: item.max_capacity || item.capacity || 1000,
          colorTheme: item.color_theme || '#10b981',
          createdAt: item.created_at || new Date().toISOString(),
          bannerUrl: item.banner_url || '',
          participantsTable: item.participants_table || item.participantsTable || participantsTable,
          checkInTable: item.check_in_table || item.checkInTable || checkInTable,
          tablesCreated: true,
        };
      });

      // Filter out any mock event IDs if present
      const cleanMapped = mapped.filter(m => !MOCK_EVENT_IDS.has(m.id));

      saveLocalEvents(cleanMapped);
      return cleanMapped.length > 0 ? cleanMapped : mapped;
    }
  } catch (err) {
    console.warn("Supabase events fetch skipped/failed, using local persistent storage:", err);
  }

  // Fallback to clean local storage or DEFAULT_EVENTS
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
