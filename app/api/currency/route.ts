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

function getClientIP(request: NextRequest): string {
  // Netlify-specific header (most reliable)
  const nfIP = request.headers.get('x-nf-client-connection-ip');
  if (nfIP) return nfIP.trim();

  // Vercel-specific
  const vercelIP = request.headers.get('x-vercel-forwarded-for');
  if (vercelIP) return vercelIP.split(',')[0].trim();

  // Standard headers
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return '';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    // Debug endpoint: add ?debug=1 to see headers
    if (request.nextUrl.searchParams.get('debug') === '1') {
      return NextResponse.json({
        detected_ip: ip,
        headers: {
          'x-nf-client-connection-ip': request.headers.get('x-nf-client-connection-ip'),
          'x-forwarded-for': request.headers.get('x-forwarded-for'),
          'x-real-ip': request.headers.get('x-real-ip'),
        },
      }, { headers: corsHeaders });
    }

    if (!ip) {
      return NextResponse.json(
        { currency: 'USD', country_code: '', ip: '' },
        { headers: corsHeaders }
      );
    }

    const apiKey = process.env.IPFLARE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { currency: 'USD', country_code: '', error: 'no_api_key' },
        { headers: corsHeaders }
      );
    }

    const ipflare = new IPFlare({ apiKey });
    const result = await ipflare.lookup(ip);

    if (!result.ok) {
      return NextResponse.json(
        { currency: 'USD', country_code: '', ip, error: result.error },
        { headers: corsHeaders }
      );
    }

    const countryCode = (result.data.country_code || '').toUpperCase();
    const currency = mapCountryToCurrency(countryCode);

    return NextResponse.json(
      { currency, country_code: countryCode, ip },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    return NextResponse.json(
      { currency: 'USD', country_code: '', error: error.message },
      { headers: corsHeaders }
    );
  }
}
