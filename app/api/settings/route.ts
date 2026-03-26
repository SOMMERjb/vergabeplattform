import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_KEYWORDS, FRAME_LIGHTING_CPV_CODES } from '@/lib/types';

// In production, these would be stored in a database
// For simplicity, using in-memory defaults
let userSettings = {
  keywords: DEFAULT_KEYWORDS,
  cpv_codes: FRAME_LIGHTING_CPV_CODES.map((c) => c.code),
  bundeslaender: [] as string[],
  min_value: null as number | null,
  max_value: null as number | null,
  company_name: 'Mein Unternehmen',
  industry: 'Rahmen & Beleuchtung',
};

export async function GET() {
  return NextResponse.json(userSettings);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  userSettings = { ...userSettings, ...body };
  return NextResponse.json(userSettings);
}
