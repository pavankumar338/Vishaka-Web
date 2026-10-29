import { NextResponse } from 'next/server';
import { provisionEventTables, getEventTableNames, generateEventTablesSQL } from '@/lib/eventTables';

export async function POST(request: Request) {
  try {
    const { eventName } = await request.json();

    if (!eventName || typeof eventName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'eventName is required.' },
        { status: 400 }
      );
    }

    const result = await provisionEventTables(eventName);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process table creation request.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventName = searchParams.get('eventName');

  if (!eventName) {
    return NextResponse.json(
      { success: false, error: 'eventName query parameter is required.' },
      { status: 400 }
    );
  }

  const tableNames = getEventTableNames(eventName);
  const sql = generateEventTablesSQL(eventName);

  return NextResponse.json({
    success: true,
    ...tableNames,
    sql,
  });
}
