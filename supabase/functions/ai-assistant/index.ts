import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const GEMINI_MODEL = "gemini-3.5-flash";

// Gemini keeps uploaded files for 48 hours. We stop trusting a cached
// file a bit before that (clock drift + in-flight requests) and just
// re-upload instead.
const EXPIRY_BUFFER_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------
// Look up (and if needed create) a Gemini File API reference for a
// module's teacher PDF, cached in the `modules` table. This means we
// only download + upload the PDF once per ~48 hours instead of on
// every single question — and with the `preload` mode below, this
// upload can happen at admin-upload time instead of on a student's
// first question, so nobody has to wait for it live.
// ---------------------------------------------------------------------
async function getOrCreateGeminiFile(
  moduleId: number | string,
  pdfUrl: string,
  geminiKey: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ uri: string; mimeType: string }> {
  const restHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  // 1. Check for a still-valid cached file reference.
  const lookupResp = await fetch(
    `${supabaseUrl}/rest/v1/modules?id=eq.${moduleId}&select=gemini_file_uri,gemini_file_uri_expires_at,gemini_file_mime_type`,
    { headers: restHeaders },
  );
  const lookupRows = await lookupResp.json();
  const cached = Array.isArray(lookupRows) ? lookupRows[0] : null;

  if (cached?.gemini_file_uri && cached?.gemini_file_uri_expires_at) {
    const expiresAt = new Date(cached.gemini_file_uri_expires_at).getTime();
    if (expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
      console.log("Reusing cached Gemini file for module", moduleId);
      return {
        uri: cached.gemini_file_uri,
        mimeType: cached.gemini_file_mime_type || "application/pdf",
      };
    }
  }

  // 2. No valid cache — download the PDF from Supabase Storage.
  console.log("No valid cached file — uploading PDF to Gemini for module", moduleId);
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Could not download the teacher PDF (status ${pdfResponse.status}).`);
  }
  const pdfBuffer = await pdfResponse.arrayBuffer();
  const mimeType = "application/pdf";
  const numBytes = pdfBuffer.byteLength;

  // 3. Start a resumable upload session with Gemini's File API.
  const startResp = await fetch(GEMINI_UPLOAD_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": geminiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(numBytes),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: `module-${moduleId}` } }),
  });

  const uploadUrl = startResp.headers.get("x-goog-upload-url");
  if (!startResp.ok || !uploadUrl) {
    const text = await startResp.text();
    throw new Error(`Gemini file upload could not start: ${text}`);
  }

  // 4. Send the actual PDF bytes to the URL Gemini just gave us.
  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(numBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: pdfBuffer,
  });

  if (!uploadResp.ok) {
    const text = await uploadResp.text();
    throw new Error(`Gemini file upload failed: ${text}`);
  }

  const uploaded = await uploadResp.json();
  const file = uploaded.file;
  if (!file?.uri) {
    throw new Error("Gemini did not return a file URI after upload.");
  }

  // 5. Wait for Gemini to finish processing (usually instant for PDFs,
  // but poll briefly just in case it reports PROCESSING under load).
  let state = file.state;
  let fileUri = file.uri;
  const fileName = file.name;
  let expirationTime = file.expirationTime;

  for (let attempt = 0; state === "PROCESSING" && attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    const statusResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
      { headers: { "x-goog-api-key": geminiKey } },
    );
    const statusJson = await statusResp.json();
    state = statusJson.state;
    fileUri = statusJson.uri;
    expirationTime = statusJson.expirationTime;
  }

  if (state === "FAILED") {
    throw new Error("Gemini failed to process the uploaded PDF.");
  }

  // 6. Cache the reference in Supabase so future questions (or the next
  // preload) skip all of the above until it expires.
  await fetch(`${supabaseUrl}/rest/v1/modules?id=eq.${moduleId}`, {
    method: "PATCH",
    headers: restHeaders,
    body: JSON.stringify({
      gemini_file_uri: fileUri,
      gemini_file_uri_expires_at:
        expirationTime || new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),
      gemini_file_mime_type: mimeType,
    }),
  });

  return { uri: fileUri, mimeType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, subject, module, module_id, pdf_url, preload } = await req.json();

    if (!module_id) {
      return new Response(
        JSON.stringify({ error: "module_id is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!geminiKey) {
      console.error("GEMINI_API_KEY is missing.");
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is missing.");
      return new Response(
        JSON.stringify({ error: "Supabase service credentials are not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!pdf_url) {
      return new Response(
        JSON.stringify({ error: "No teacher PDF was supplied for this module." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -----------------------------------------------------------------
    // PRELOAD MODE — called from the admin panel right after a teacher
    // PDF is uploaded/replaced. Just warms the Gemini file cache for
    // this module; no question is answered, no generateContent call.
    // This is what moves the "upload to Gemini" cost off the student's
    // first question and onto admin-upload time instead.
    // -----------------------------------------------------------------
    if (preload) {
      console.log("Preload request for module", module_id);
      try {
        const { uri } = await getOrCreateGeminiFile(
          module_id, pdf_url, geminiKey, supabaseUrl, serviceRoleKey,
        );
        return new Response(
          JSON.stringify({ preloaded: true, uri }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err) {
        console.error("Preload failed:", err);
        return new Response(
          JSON.stringify({
            error: "Preload failed.",
            details: err instanceof Error ? err.message : String(err),
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // -----------------------------------------------------------------
    // NORMAL MODE — answering an actual student question.
    // -----------------------------------------------------------------
    if (!question || !question.trim()) {
      return new Response(
        JSON.stringify({ error: "Question is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("AI request received");
    console.log("Subject:", subject);
    console.log("Module:", module, "(id:", module_id, ")");
    console.log("Question:", question);

    const { uri: fileUri, mimeType } = await getOrCreateGeminiFile(
      module_id, pdf_url, geminiKey, supabaseUrl, serviceRoleKey,
    );

    const prompt = `
You are the AI Study Assistant for a college student's Resource Hub.

Subject:
${subject || "Not specified"}

Module:
${module || "Not specified"}

The attached file is the teacher's official notes for this module.

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

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
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
                { fileData: { fileUri, mimeType } },
              ],
            },
          ],
        }),
      },
    );

    const result = await geminiResponse.json();
    console.log("Gemini status:", geminiResponse.status);

    if (!geminiResponse.ok) {
      console.error("Gemini error:", result);
      return new Response(
        JSON.stringify({
          error: "Gemini request failed.",
          details: result?.error?.message || "Unknown Gemini error.",
        }),
        { status: geminiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const answer = result?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text)
      .filter(Boolean)
      .join("\n");

    if (!answer) {
      console.error("No answer text received:", result);
      return new Response(
        JSON.stringify({ error: "Gemini returned no answer." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ answer }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("AI Function Error:", error);
    return new Response(
      JSON.stringify({
        error: "Something went wrong.",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});