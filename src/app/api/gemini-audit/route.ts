import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Missing Gemini API Key' }, { status: 400 });
    }

    const { companyPayrollData, auditPeriod, forecastPeriodMonths } = await req.json();

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
      return NextResponse.json({ error: data.error?.message || 'Error calling Gemini API' }, { status: 400 });
    }

    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      return NextResponse.json({ error: 'Invalid response from Gemini API' }, { status: 400 });
    }

    // Since textResult is a JSON string from Gemini, parse it before sending
    let parsedResult;
    try {
      parsedResult = JSON.parse(textResult);
    } catch (e) {
      // If Gemini returned a code block like \`\`\`json ... \`\`\`, strip it
      const cleaned = textResult.replace(/^```json/i, '').replace(/```$/i, '').trim();
      parsedResult = JSON.parse(cleaned);
    }

    return NextResponse.json(parsedResult, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
