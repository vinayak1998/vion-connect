import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Vion's friendly AI assistant on the website. You help visitors with:
- Plan information and recommendations
- Checking service availability by pincode
- Collecting lead details for interested customers
- Answering common questions about internet service

**COMPANY INFO:**
- Company: Vion Internet Services
- Service: High-speed fiber internet for homes

**PLANS:**
1. Vion Basic: ₹499/month, 50 Mbps, 30 days validity
2. Vion Pro: ₹799/month, 100 Mbps, 30 days validity  
3. Vion Ultra: ₹1299/month, 200 Mbps, 30 days validity

All plans include:
- Unlimited data (no FUP)
- 24/7 customer support
- Free router on annual plans

**INSTALLATION:**
- ₹50 booking fee (refundable on cancellation)
- Installation within 2-3 working days
- Free installation for all plans

**COVERAGE:**
- We serve major cities including Delhi, Mumbai, Bangalore, Kolkata
- Service availability varies by pincode

**CONVERSATION GUIDELINES:**
1. Be friendly, helpful, and concise
2. Use simple language, avoid technical jargon
3. When user mentions a location or pincode, use check_serviceability tool
4. If serviceable and user is interested, collect: name, phone, address
5. Once you have all details, use create_lead tool
6. If not serviceable, offer waitlist with add_to_waitlist tool
7. Answer questions naturally, recommend plans based on usage
8. Keep responses short (2-3 sentences max unless explaining plans)

**LEAD CAPTURE FLOW:**
1. Check pincode first
2. If available, ask for name
3. Then ask for 10-digit phone number
4. Then ask for full address
5. Create the lead

Be enthusiastic about helping customers get connected!`;

const tools = [
  {
    type: "function",
    function: {
      name: "check_serviceability",
      description: "Check if Vion fiber internet service is available in a given pincode",
      parameters: {
        type: "object",
        properties: {
          pincode: {
            type: "string",
            description: "6-digit Indian pincode to check"
          }
        },
        required: ["pincode"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Create a new lead when customer provides all required details (name, phone, address, pincode)",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Customer's full name"
          },
          phone: {
            type: "string",
            description: "10-digit mobile phone number"
          },
          address: {
            type: "string",
            description: "Customer's full address"
          },
          pincode: {
            type: "string",
            description: "6-digit pincode"
          }
        },
        required: ["name", "phone", "address", "pincode"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_to_waitlist",
      description: "Add user to waitlist when service is not available in their area",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "10-digit mobile phone number"
          },
          pincode: {
            type: "string",
            description: "6-digit pincode"
          },
          email: {
            type: "string",
            description: "Email address (optional)"
          }
        },
        required: ["phone", "pincode"]
      }
    }
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initial AI call with tools
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process stream and handle tool calls
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let toolCalls: any[] = [];
    let currentToolCall: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        
        try {
          const parsed = JSON.parse(line.slice(6));
          const delta = parsed.choices?.[0]?.delta;
          
          if (delta?.content) {
            fullContent += delta.content;
          }
          
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = { id: tc.id, function: { name: "", arguments: "" } };
                }
                if (tc.function?.name) {
                  toolCalls[tc.index].function.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            }
          }
        } catch {}
      }
    }

    // If no tool calls, return the content directly
    if (toolCalls.length === 0) {
      return new Response(JSON.stringify({ 
        content: fullContent,
        toolResults: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process tool calls
    const toolResults: any[] = [];
    
    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments);
      let result: any;

      console.log(`Executing tool: ${toolCall.function.name}`, args);

      switch (toolCall.function.name) {
        case "check_serviceability": {
          const { data } = await supabase
            .from("serviceable_areas")
            .select("area_name, pincode")
            .eq("pincode", args.pincode)
            .eq("is_active", true)
            .limit(1);
          
          if (data && data.length > 0) {
            result = { 
              available: true, 
              area: data[0].area_name,
              pincode: args.pincode,
              message: `Service is available in ${data[0].area_name} (${args.pincode})!`
            };
          } else {
            result = { 
              available: false, 
              pincode: args.pincode,
              message: `Service is not yet available in ${args.pincode}. We're expanding soon!`
            };
          }
          break;
        }

        case "create_lead": {
          // Create lead
          const { data: lead, error: leadError } = await supabase
            .from("leads")
            .insert({
              name: args.name,
              phone: args.phone,
              address: args.address,
              pincode: args.pincode,
              source: "AI Chatbot",
              stage: "New",
            })
            .select()
            .single();

          if (leadError) {
            console.error("Lead creation error:", leadError);
            result = { success: false, message: "Failed to create booking. Please try again." };
          } else {
            // Create booking
            await supabase
              .from("bookings")
              .insert({
                lead_id: lead.id,
                amount: 50,
                status: "Paid",
              });
            
            result = { 
              success: true, 
              leadId: lead.id,
              message: `Booking created successfully for ${args.name}! Our team will contact you at ${args.phone} within 24 hours.`
            };
          }
          break;
        }

        case "add_to_waitlist": {
          const { error } = await supabase
            .from("waitlist")
            .insert({
              phone: args.phone,
              pincode: args.pincode,
              email: args.email || null,
            });

          if (error) {
            console.error("Waitlist error:", error);
            result = { success: false, message: "Failed to add to waitlist. Please try again." };
          } else {
            result = { 
              success: true, 
              message: `Added to waitlist! We'll notify you at ${args.phone} when we launch in ${args.pincode}.`
            };
          }
          break;
        }

        default:
          result = { error: "Unknown tool" };
      }

      toolResults.push({
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        result
      });
    }

    // Get final response with tool results
    const toolMessages = toolResults.map(tr => ({
      role: "tool",
      tool_call_id: tr.toolCallId,
      content: JSON.stringify(tr.result)
    }));

    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
          { role: "assistant", content: fullContent, tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            type: "function",
            function: { name: tc.function.name, arguments: tc.function.arguments }
          }))},
          ...toolMessages,
        ],
      }),
    });

    if (!finalResponse.ok) {
      const t = await finalResponse.text();
      console.error("Final AI response error:", finalResponse.status, t);
      // Return tool results as fallback
      return new Response(JSON.stringify({ 
        content: toolResults[0]?.result?.message || "Something went wrong.",
        toolResults
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalData = await finalResponse.json();
    const finalContent = finalData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ 
      content: finalContent,
      toolResults
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
