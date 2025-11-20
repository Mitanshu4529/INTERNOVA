import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { resumeText } = await req.json()

    // 1. Call OpenAI API
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Changed to 3.5-turbo to ensure access
        messages: [
          {
            role: 'system',
            content: 'Extract skills (array of strings) from this resume. Return valid JSON: {"skills": []}'
          },
          { role: 'user', content: resumeText }
        ],
        temperature: 0.1,
      }),
    })

    const aiData = await openAiResponse.json()

    // 2. SAFETY CHECK: If OpenAI returns an error, send it to the frontend
    if (!aiData.choices || !aiData.choices.length) {
      console.error("OpenAI Error:", aiData);
      return new Response(JSON.stringify({ 
        error: "OpenAI Request Failed", 
        details: aiData // This will show us the REAL reason (Quota, Key, etc.)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3. Parse Success
    const content = aiData.choices[0].message.content
    const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanContent)

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})