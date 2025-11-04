import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nodes, edges } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing full knowledge graph:', nodes.length, 'nodes');

    // Build comprehensive graph context
    const graphSummary = `
Total Nodes: ${nodes.length}
Total Relationships: ${edges.length}

Nodes by Type:
${Object.entries(
  nodes.reduce((acc: any, n: any) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {})
).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

Patient Information:
${nodes.filter((n: any) => n.type === 'patient').map((n: any) => 
  `- ${n.label}: ${JSON.stringify(n.data || {})}`
).join('\n')}

Conditions:
${nodes.filter((n: any) => n.type === 'condition').map((n: any) => 
  `- ${n.label}: ${JSON.stringify(n.data || {})}`
).join('\n')}

Medications:
${nodes.filter((n: any) => n.type === 'medication').map((n: any) => 
  `- ${n.label}: ${JSON.stringify(n.data || {})}`
).join('\n')}

Symptoms:
${nodes.filter((n: any) => n.type === 'symptom').map((n: any) => 
  `- ${n.label}`
).join('\n')}

Procedures:
${nodes.filter((n: any) => n.type === 'procedure').map((n: any) => 
  `- ${n.label}: ${JSON.stringify(n.data || {})}`
).join('\n')}

Key Relationships:
${edges.map((e: any) => {
  const source = nodes.find((n: any) => n.id === e.source);
  const target = nodes.find((n: any) => n.id === e.target);
  return `- ${source?.label} ${e.label || '→'} ${target?.label}`;
}).join('\n')}
`;

    const prompt = `You are an expert medical AI assistant analyzing a complete healthcare knowledge graph.

${graphSummary}

Provide a comprehensive clinical analysis including:

1. **Patient Overview**: Summarize the patient(s) and their key characteristics
2. **Diagnosis Summary**: List all conditions with their ICD-10 codes (CRITICAL: provide accurate ICD-10 codes for each condition)
3. **Treatment Analysis**: Evaluate current medications and procedures
4. **Risk Assessment**: Identify comorbidities and potential complications
5. **Clinical Recommendations**: Suggest additional tests, treatments, or monitoring
6. **ICD-10 Code Summary**: List all applicable ICD-10 codes in a clear format

Format the ICD-10 codes as:
- Condition Name: ICD-10 Code (X00.X) - Description

Be thorough, evidence-based, and ensure all ICD-10 codes are accurate and up-to-date.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert medical AI assistant specializing in healthcare analytics and ICD-10 coding. Always provide accurate ICD-10 codes for medical conditions.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('Graph analysis completed');

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-graph function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
