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
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      imageBase64 = `data:${file.type};base64,${base64}`;
      content = "Extract all medical entities and relationships from this medical image.";
    } else {
      // For text/CSV files, read content
      content = await file.text();
    }

    // First, validate if the content is medical-related
    console.log("Validating if content is medical-related...");
    
    const validationMessages: any[] = [];
    if (imageBase64) {
      validationMessages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this image and determine if it contains medical information such as: patient data, medical records, prescriptions, diagnoses, symptoms, treatments, lab results, medical imaging, or healthcare-related content. Respond with 'yes' if it's medical-related, or 'no' if it's not."
          },
          {
            type: "image_url",
            image_url: { url: imageBase64 }
          }
        ]
      });
    } else {
      validationMessages.push({
        role: "user",
        content: `Analyze this text and determine if it contains medical information such as: patient data, medical records, prescriptions, diagnoses, symptoms, treatments, lab results, or healthcare-related content. Respond with 'yes' if it's medical-related, or 'no' if it's not.\n\nContent:\n${content}`
      });
    }

    const validationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: validationMessages,
      }),
    });

    if (!validationResponse.ok) {
      throw new Error(`Validation failed: ${validationResponse.status}`);
    }

    const validationData = await validationResponse.json();
    const validationResult = validationData.choices?.[0]?.message?.content?.toLowerCase() || "";
    
    console.log("Validation result:", validationResult);
    
    if (!validationResult.includes("yes")) {
      return new Response(
        JSON.stringify({ 
          error: "Non-medical data detected. Please upload medical records, patient data, prescriptions, lab results, or other healthcare-related information.",
          isMedical: false
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare messages for AI knowledge extraction
    const messages: any[] = [];
    
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "You are a medical knowledge extraction AI. Extract entities (patients, conditions, medications, procedures, symptoms) and their relationships from this medical image.\n\nCRITICAL: Assign UNIQUE x,y coordinates to each node:\n- x: 100-700\n- y: 100-500\n- Space nodes apart, no overlaps\n- Group related items logically\n\nReturn JSON with 'nodes' (id, label, type, x, y, connections, data) and 'edges' (source, target, label, strength)."
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

CRITICAL: You must assign UNIQUE x and y coordinates to each node for proper 2D layout:
- Use x values between 100 and 700
- Use y values between 100 and 500
- Make sure nodes don't overlap - space them out logically
- Group related nodes closer together
- Keep the central entity (like patient or main condition) near center (400, 300)

Return a JSON object with 'nodes' and 'edges' arrays. Each node MUST have:
- id: unique identifier (lowercase, underscore separated)
- label: display name
- type: one of (patient, condition, medication, procedure, symptom)
- x: number between 100-700 (REQUIRED, must be unique per node)
- y: number between 100-500 (REQUIRED, must be unique per node)
- connections: array of connected node ids
- data: object with additional information

Each edge MUST have:
- source: node id
- target: node id
- label: relationship description
- strength: number between 0-1

Make the layout visually appealing and well-distributed.`
      });
    }

    console.log("Calling Lovable AI Gateway for knowledge extraction...");

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
                      id: { type: "string", description: "Unique lowercase identifier with underscores" },
                      label: { type: "string", description: "Display name" },
                      type: { type: "string", enum: ["patient", "condition", "medication", "procedure", "symptom"] },
                      x: { type: "number", minimum: 100, maximum: 700, description: "Horizontal position - must be unique" },
                      y: { type: "number", minimum: 100, maximum: 500, description: "Vertical position - must be unique" },
                      connections: { type: "array", items: { type: "string" } },
                      data: { type: "object", additionalProperties: true }
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
    
    // Ensure all nodes have valid x,y coordinates
    if (knowledgeGraph.nodes) {
      knowledgeGraph.nodes = knowledgeGraph.nodes.map((node: any, index: number) => {
        // If x or y are 0 or missing, generate positions in a circular layout
        if (!node.x || node.x === 0 || !node.y || node.y === 0) {
          const angle = (index / knowledgeGraph.nodes.length) * 2 * Math.PI;
          const radius = 200;
          const centerX = 400;
          const centerY = 300;
          return {
            ...node,
            x: Math.round(centerX + radius * Math.cos(angle)),
            y: Math.round(centerY + radius * Math.sin(angle))
          };
        }
        return node;
      });
    }
    
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