import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      throw new Error("No file provided");
    }

    console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    let content = "";
    let imageBase64: string | null = null;

    // Handle different file types
    if (file.type.startsWith("image/")) {
      // For images, convert to base64
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      imageBase64 = `data:${file.type};base64,${base64}`;
      content = "Extract all medical entities and relationships from this medical image.";
    } else {
      // For text/CSV files, read content
      content = await file.text();
    }

    // Prepare messages for AI
    const messages: any[] = [];
    
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "You are a medical knowledge extraction AI. Extract entities (patients, conditions, medications, procedures, symptoms) and their relationships from this medical data. Return a JSON object with 'nodes' and 'edges' arrays. Each node should have: id, label, type (patient/condition/medication/procedure/symptom), data (additional info). Each edge should have: source, target, label, strength (0-1)."
          },
          {
            type: "image_url",
            image_url: {
              url: imageBase64
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `You are a medical knowledge extraction AI. Extract entities (patients, conditions, medications, procedures, symptoms) and their relationships from this medical data:

${content}

Return a JSON object with 'nodes' and 'edges' arrays. Each node should have:
- id: unique identifier
- label: display name
- type: one of (patient, condition, medication, procedure, symptom)
- x: number (200-700 for layout)
- y: number (100-500 for layout)
- connections: array of connected node ids
- data: object with additional information

Each edge should have:
- source: node id
- target: node id
- label: relationship description
- strength: number between 0-1

Make sure the layout is well-distributed and logical.`
      });
    }

    console.log("Calling Lovable AI Gateway...");

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
        tools: [{
          type: "function",
          function: {
            name: "extract_knowledge_graph",
            description: "Extract medical entities and relationships into a knowledge graph structure",
            parameters: {
              type: "object",
              properties: {
                nodes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      type: { type: "string", enum: ["patient", "condition", "medication", "procedure", "symptom"] },
                      x: { type: "number" },
                      y: { type: "number" },
                      connections: { type: "array", items: { type: "string" } },
                      data: { type: "object" }
                    },
                    required: ["id", "label", "type", "x", "y", "connections"]
                  }
                },
                edges: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source: { type: "string" },
                      target: { type: "string" },
                      label: { type: "string" },
                      strength: { type: "number", minimum: 0, maximum: 1 }
                    },
                    required: ["source", "target", "strength"]
                  }
                }
              },
              required: ["nodes", "edges"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_knowledge_graph" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI Response received");

    // Extract the structured output from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("No tool call response from AI");
    }

    const knowledgeGraph = JSON.parse(toolCall.function.arguments);
    console.log(`Extracted ${knowledgeGraph.nodes?.length || 0} nodes and ${knowledgeGraph.edges?.length || 0} edges`);

    return new Response(
      JSON.stringify(knowledgeGraph),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-knowledge function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});