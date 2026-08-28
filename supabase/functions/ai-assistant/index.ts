import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle browser CORS request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { question, subject, module, context } = await req.json();

    if (!question || !question.trim()) {
      return new Response(
        JSON.stringify({ error: "Question is required." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY is not configured in Supabase.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const prompt = `
You are the AI Study Assistant for a college student's Resource Hub.

Subject: ${subject || "Not specified"}
Module: ${module || "Not specified"}

Study material/context:
${context || "No additional study material was provided."}

Student's question:
${question}

Answer clearly and simply.
Use headings, bullet points, and examples when useful.
Focus on helping the student understand and study the topic.
Do not invent information that is not supported by the provided context when the context contains relevant material.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input: prompt,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", result);

      return new Response(
        JSON.stringify({
          error: "OpenAI request failed.",
          details: result?.error?.message || "Unknown error",
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        answer: result.output_text || "I couldn't generate an answer.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Function error:", error);

    return new Response(
      JSON.stringify({
        error: "Something went wrong.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});