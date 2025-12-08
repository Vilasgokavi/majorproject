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
    let fileBase64: string | null = null;
    let mimeType = file.type;

    // Handle different file types
    if (file.type.startsWith("image/")) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fileBase64 = `data:${file.type};base64,${btoa(binary)}`;
    } else if (file.type === "application/pdf" || file.type.includes("word") || file.type.includes("document") || file.name.endsWith('.pdf') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      
      if (file.name.endsWith('.pdf') || file.type === "application/pdf") {
        mimeType = "application/pdf";
      } else if (file.name.endsWith('.docx')) {
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (file.name.endsWith('.doc')) {
        mimeType = "application/msword";
      }
      
      fileBase64 = `data:${mimeType};base64,${btoa(binary)}`;
    } else {
      content = await file.text();
    }

    // Single combined call: classify AND extract in one request
    console.log("Classifying and extracting knowledge in single call...");

    const messages: any[] = [];
    
    if (fileBase64) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this file. If it's NOT medical content (selfies, food, landscapes, memes, non-health docs), return is_medical=false. If it IS medical (patient records, prescriptions, lab results, X-rays, CT, MRI, diagnoses, clinical notes), extract entities and relationships."
          },
          {
            type: "image_url",
            image_url: { url: fileBase64 }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `Analyze this content. If NOT medical, return is_medical=false. If medical, extract entities:\n\n${content.substring(0, 4000)}`
      });
    }

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
            name: "classify_and_extract",
            description: "Classify content as medical/non-medical and extract knowledge graph if medical",
            parameters: {
              type: "object",
              properties: {
                is_medical: { 
                  type: "boolean", 
                  description: "true if medical content (patient records, prescriptions, lab results, imaging, clinical notes), false otherwise" 
                },
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
                    required: ["id", "label", "type"]
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
                      strength: { type: "number" }
                    },
                    required: ["source", "target"]
                  }
                }
              },
              required: ["is_medical"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "classify_and_extract" } }
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
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    // Check if content is medical
    if (!result.is_medical) {
      console.log("Content classified as non-medical");
      return new Response(
        JSON.stringify({ 
          error: "Non-medical data detected. Please upload medical records, patient data, prescriptions, lab results, or healthcare information.",
          isMedical: false
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Medical content verified, processing graph...");
    
    const nodes = result.nodes || [];
    const edges = result.edges || [];
    
    // Position nodes: conditions at center, others in circle
    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    
    const conditionNodes = nodes.filter((n: any) => n.type === 'condition');
    const otherNodes = nodes.filter((n: any) => n.type !== 'condition');
    
    // Position conditions at center
    conditionNodes.forEach((node: any, index: number) => {
      if (conditionNodes.length === 1) {
        node.x = centerX;
        node.y = centerY;
      } else {
        const spacing = 50;
        const totalWidth = (conditionNodes.length - 1) * spacing;
        node.x = centerX - totalWidth / 2 + index * spacing;
        node.y = centerY;
      }
      node.connections = node.connections || [];
    });
    
    // Arrange other nodes in circle
    otherNodes.forEach((node: any, index: number) => {
      const angle = (index / otherNodes.length) * 2 * Math.PI;
      node.x = Math.round(centerX + radius * Math.cos(angle));
      node.y = Math.round(centerY + radius * Math.sin(angle));
      node.connections = node.connections || [];
    });
    
    const knowledgeGraph = {
      nodes: [...conditionNodes, ...otherNodes],
      edges: edges.map((e: any) => ({ ...e, strength: e.strength || 0.5 }))
    };
    
    console.log(`Extracted ${knowledgeGraph.nodes.length} nodes and ${knowledgeGraph.edges.length} edges`);

    return new Response(
      JSON.stringify(knowledgeGraph),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
