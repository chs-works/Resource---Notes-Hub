import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // ---------------------------------------------------------
  // CORS
  // ---------------------------------------------------------
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // ---------------------------------------------------------
    // Read request
    // ---------------------------------------------------------
    const {
      question,
      subject,
      module,
      pdf_url,
    } = await req.json();

    if (!question || !question.trim()) {
      return new Response(
        JSON.stringify({
          error: "Question is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // OpenAI API key
    // ---------------------------------------------------------
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      console.error("OPENAI_API_KEY is missing.");

      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY is not configured.",
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

    // ---------------------------------------------------------
    // Check PDF
    // ---------------------------------------------------------
    if (!pdf_url) {
      return new Response(
        JSON.stringify({
          error: "No teacher PDF was supplied for this module.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log("AI request received");
    console.log("Subject:", subject);
    console.log("Module:", module);
    console.log("PDF:", pdf_url);
    console.log("Question:", question);

    // ---------------------------------------------------------
    // Prompt
    // ---------------------------------------------------------
    const prompt = `
You are the AI Study Assistant for a college student's Resource Hub.

Subject:
${subject || "Not specified"}

Module:
${module || "Not specified"}

The attached PDF is the teacher's official notes for this module.

IMPORTANT RULES:
1. Use the attached teacher PDF as the primary source.
2. Answer the student's question based on the PDF.
3. Do not invent syllabus content that is not present in the PDF.
4. If the requested information is not available in the PDF, clearly say so.
5. Explain concepts in simple student-friendly language.
6. Use headings, bullet points and examples where useful.
7. For mathematical topics, show formulas and steps clearly.
8. For exam questions, focus on concepts that appear in the teacher notes.

Student's question:
${question}
`;

    // ---------------------------------------------------------
    // Send PDF + question to OpenAI
    // ---------------------------------------------------------
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },

        body: JSON.stringify({
          model: "gpt-5.6",

          input: [
            {
              role: "user",

              content: [
                {
                  type: "input_text",
                  text: prompt,
                },

                {
                  type: "input_file",
                  file_url: pdf_url,
                  detail: "auto",
                },
              ],
            },
          ],
        }),
      },
    );

    // ---------------------------------------------------------
    // Read OpenAI response
    // ---------------------------------------------------------
    const result = await openaiResponse.json();

    console.log("OpenAI status:", openaiResponse.status);

    if (!openaiResponse.ok) {
      console.error("OpenAI error:", result);

      return new Response(
        JSON.stringify({
          error: "OpenAI request failed.",
          details:
            result?.error?.message ||
            "Unknown OpenAI error.",
        }),
        {
          status: openaiResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Get generated answer
    // ---------------------------------------------------------
    const answer = result?.output_text;

    if (!answer) {
      console.error("No output_text received:", result);

      return new Response(
        JSON.stringify({
          error: "OpenAI returned no answer.",
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

    // ---------------------------------------------------------
    // Return answer to website
    // ---------------------------------------------------------
    return new Response(
      JSON.stringify({
        answer,
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
    console.error("AI Function Error:", error);

    return new Response(
      JSON.stringify({
        error: "Something went wrong.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
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