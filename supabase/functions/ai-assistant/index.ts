import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Converts binary PDF bytes into a base64 string, in chunks so it doesn't
// blow the call stack on larger files (String.fromCharCode has an argument
// limit, so we can't just spread the whole byte array at once).
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

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
    // Gemini API key
    // ---------------------------------------------------------
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      console.error("GEMINI_API_KEY is missing.");

      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY is not configured.",
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
    // Fetch the PDF and base64-encode it.
    // Gemini's generateContent accepts inline PDF bytes directly for
    // files this size — no separate upload step needed.
    // ---------------------------------------------------------
    const pdfResponse = await fetch(pdf_url);

    if (!pdfResponse.ok) {
      console.error("Failed to fetch PDF:", pdfResponse.status);

      return new Response(
        JSON.stringify({
          error: "Could not download the teacher PDF.",
          details:
            `PDF fetch returned status ${pdfResponse.status}. Make sure the storage bucket serving it is public.`,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = arrayBufferToBase64(pdfBuffer);

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
    // Send PDF + question to Gemini
    // ---------------------------------------------------------
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },

        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: pdfBase64,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    // ---------------------------------------------------------
    // Read Gemini response
    // ---------------------------------------------------------
    const result = await geminiResponse.json();

    console.log("Gemini status:", geminiResponse.status);

    if (!geminiResponse.ok) {
      console.error("Gemini error:", result);

      return new Response(
        JSON.stringify({
          error: "Gemini request failed.",
          details:
            result?.error?.message ||
            "Unknown Gemini error.",
        }),
        {
          status: geminiResponse.status,
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
    const answer = result?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text)
      .filter(Boolean)
      .join("\n");

    if (!answer) {
      console.error("No answer text received:", result);

      return new Response(
        JSON.stringify({
          error: "Gemini returned no answer.",
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
