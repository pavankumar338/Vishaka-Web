import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch ALL records from check_in_logs
    const { data: checkInRows, error: ciError } = await supabase
        .from('check_in_logs')
        .select('*')
        .order('recorded_at', { ascending: false });

    // Fetch ALL records from check_out_logs
    const { data: checkOutRows, error: coError } = await supabase
        .from('check_out_logs')
        .select('*')
        .order('recorded_at', { ascending: false });

    // Fetch participants
    const { data: participants } = await supabase
        .from('participants')
        .select('id, name, status');

    return NextResponse.json({
        check_in_logs: {
            total: checkInRows?.length ?? 0,
            error: ciError ? ciError.message : null,
            rows: checkInRows ?? []
        },
        check_out_logs: {
            total: checkOutRows?.length ?? 0,
            error: coError ? coError.message : null,
            rows: checkOutRows ?? []
        },
        participants: {
            total: participants?.length ?? 0,
            rows: participants ?? []
        }
    }, { status: 200 });
}
