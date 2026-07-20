// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const allowedOrigins = ['https://shitwise-payroll.vercel.app', 'http://localhost:3000'];

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'https://shitwise-payroll.vercel.app';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('Missing Gemini API Key');
    }

    const { companyPayrollData, auditPeriod, forecastPeriodMonths } = await req.json()

    const prompt = `
You are an expert Payroll and Attendance Auditor for a factory in India.
Review the following payroll data for the period ${auditPeriod?.startDate} to ${auditPeriod?.endDate}.
Analyze shift patterns (9-hour and 12-hour shifts) and clock-in/out times.

Return a JSON object with the following structure:
{
  "summary": "Brief executive summary...",
  "unusualShiftPatterns": [
    { "employeeId": "...", "employeeName": "...", "patternDescription": "...", "exampleDates": ["YYYY-MM-DD"] }
  ],
  "potentialPayrollDiscrepancies": [
    { "employeeId": "...", "employeeName": "...", "date": "...", "discrepancyType": "...", "details": "...", "suggestedAction": "..." }
  ],
  "costForecast": {
    "period": "Next ${forecastPeriodMonths || 3} months",
    "totalEstimatedLaborCost": 0,
    "monthlyBreakdown": [ { "month": "YYYY-MM", "estimatedCost": 0 } ],
    "notes": "..."
  }
}

Data: ${JSON.stringify(companyPayrollData)}
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error calling Gemini API');
    }

    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      throw new Error('Invalid response from Gemini API');
    }

    return new Response(textResult, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
