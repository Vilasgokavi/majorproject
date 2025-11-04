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
    const { node, allNodes, allEdges } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing node:', node.label);

    // Build context from connected nodes
    const connectedNodes = allNodes.filter((n: any) => 
      node.connections.includes(n.id)
    );

    const relatedEdges = allEdges.filter((e: any) => 
      e.source === node.id || e.target === node.id
    );

    const context = `
Node: ${node.label}
Type: ${node.type}
Data: ${JSON.stringify(node.data || {})}

Connected to:
${connectedNodes.map((n: any) => `- ${n.label} (${n.type})`).join('\n')}

Relationships:
${relatedEdges.map((e: any) => `- ${e.label || 'connected to'}`).join('\n')}
`;

    const prompt = `You are a medical AI assistant analyzing a healthcare knowledge graph node.

${context}

Provide a comprehensive analysis including:
1. Summary of this node and its significance
2. Clinical implications
3. Relationships with connected entities
4. Risk factors or considerations
5. Relevant ICD-10 codes (if applicable for medical conditions)

Be specific, clinical, and actionable. If this is a condition, include the ICD-10 code.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert medical AI assistant specializing in healthcare knowledge graphs and ICD-10 coding.' },
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

    console.log('Node analysis completed');

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-node function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
