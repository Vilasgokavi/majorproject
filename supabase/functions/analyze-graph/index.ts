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

Lab Results:
${nodes.filter((n: any) => n.type === 'lab_result' || n.type === 'lab').map((n: any) => 
  `- ${n.label}: ${JSON.stringify(n.data || {})}`
).join('\n')}

Key Relationships:
${edges.map((e: any) => {
  const source = nodes.find((n: any) => n.id === e.source);
  const target = nodes.find((n: any) => n.id === e.target);
  return `- ${source?.label} ${e.label || '→'} ${target?.label}`;
}).join('\n')}
`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert medical AI assistant specializing in healthcare analytics and ICD-10 coding. Always provide accurate ICD-10 codes for medical conditions.' 
          },
          { 
            role: 'user', 
            content: `Analyze this healthcare knowledge graph and provide clinical insights:\n\n${graphSummary}` 
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_clinical_analysis",
              description: "Provide a comprehensive clinical analysis of the patient's health data",
              parameters: {
                type: "object",
                properties: {
                  patientSummary: {
                    type: "string",
                    description: "Brief overview of the patient including demographics and primary health status"
                  },
                  keyInsights: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 key clinical insights about the patient's health"
                  },
                  treatmentRecommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "string", enum: ["High", "Medium", "Low"] }
                      },
                      required: ["title", "description", "priority"]
                    },
                    description: "Treatment recommendations with priority levels"
                  },
                  riskFactors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        severity: { type: "string", enum: ["High", "Medium", "Low"] }
                      },
                      required: ["title", "description", "severity"]
                    },
                    description: "Risk factors and potential complications"
                  },
                  suggestedTests: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        reason: { type: "string" },
                        urgency: { type: "string", enum: ["Urgent", "Routine", "Follow-up"] }
                      },
                      required: ["name", "reason", "urgency"]
                    },
                    description: "Recommended diagnostic tests"
                  },
                  icd10Codes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        code: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["code", "description"]
                    },
                    description: "Applicable ICD-10 codes with descriptions"
                  },
                  diagnosisSummary: {
                    type: "string",
                    description: "Summary of all diagnoses and their relationships"
                  },
                  medicationAnalysis: {
                    type: "string",
                    description: "Analysis of current medications, interactions, and effectiveness"
                  }
                },
                required: ["patientSummary", "keyInsights", "treatmentRecommendations", "riskFactors", "suggestedTests", "icd10Codes", "diagnosisSummary", "medicationAnalysis"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_clinical_analysis" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI Response received');

    // Extract tool call arguments
    let structuredAnalysis;
    
    if (data.choices[0].message.tool_calls && data.choices[0].message.tool_calls.length > 0) {
      const toolCall = data.choices[0].message.tool_calls[0];
      structuredAnalysis = JSON.parse(toolCall.function.arguments);
      console.log('Structured analysis extracted from tool call');
    } else {
      // Fallback: create basic structure from content
      const content = data.choices[0].message.content || '';
      structuredAnalysis = {
        patientSummary: content.substring(0, 200),
        keyInsights: [content],
        treatmentRecommendations: [],
        riskFactors: [],
        suggestedTests: [],
        icd10Codes: [],
        diagnosisSummary: content,
        medicationAnalysis: ''
      };
      console.log('Fallback: used content as analysis');
    }

    console.log('Graph analysis completed');

    return new Response(
      JSON.stringify({ 
        analysis: JSON.stringify(structuredAnalysis),
        structured: structuredAnalysis 
      }),
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
