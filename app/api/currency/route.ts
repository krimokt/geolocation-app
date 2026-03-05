import { NextRequest, NextResponse } from 'next/server';
import { IPFlare } from 'ipflare';

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

function mapCountryToCurrency(countryCode: string): string {
  if (countryCode === 'MA') return 'MAD';
  if (countryCode === 'HK') return 'HKD';
  if (EU_COUNTRIES.has(countryCode)) return 'EUR';
  return 'USD';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=3600',
};

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';

    if (!ip) {
      return NextResponse.json(
        { currency: 'USD', country_code: '' },
        { headers: corsHeaders }
      );
    }

    const apiKey = process.env.IPFLARE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { currency: 'USD', country_code: '' },
        { headers: corsHeaders }
      );
    }

    const ipflare = new IPFlare({ apiKey });
    const result = await ipflare.lookup(ip);

    if (!result.ok) {
      console.error('IPFlare error:', result.error);
      return NextResponse.json(
        { currency: 'USD', country_code: '' },
        { headers: corsHeaders }
      );
    }

    const countryCode = (result.data.country_code || '').toUpperCase();
    const currency = mapCountryToCurrency(countryCode);

    return NextResponse.json(
      { currency, country_code: countryCode },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Geolocation error:', error);
    return NextResponse.json(
      { currency: 'USD', country_code: '' },
      { headers: corsHeaders }
    );
  }
}
