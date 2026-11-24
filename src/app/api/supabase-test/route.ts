
import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        success: false,
        message: "Supabase configuration unavailable.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/health`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );

    return NextResponse.json(
      {
        success: response.ok,
        message: response.ok
          ? "Supabase connection successful."
          : "Supabase health check failed.",
      },
      {
        status: response.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Unable to reach Supabase server.",
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
