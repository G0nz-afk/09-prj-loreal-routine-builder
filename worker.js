const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function toResponsesInput(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function extractCitations(openAIResponse) {
  const citations = [];
  const seenUrls = new Set();

  for (const item of openAIResponse.output || []) {
    if (item.type !== "message") {
      continue;
    }

    for (const contentPart of item.content || []) {
      for (const annotation of contentPart.annotations || []) {
        const url = annotation.url || annotation.source_url;
        if (!url || seenUrls.has(url)) {
          continue;
        }

        seenUrls.add(url);
        citations.push({
          title: annotation.title || annotation.source_title || url,
          url,
        });
      }
    }
  }

  return citations;
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: { message: "Method not allowed" } }, 405);
  }

  const apiKey = OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: { message: "Missing OPENAI_API_KEY secret" } },
      500,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ error: { message: "Invalid JSON body" } }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return jsonResponse(
      { error: { message: "Missing required parameter: 'messages'." } },
      400,
    );
  }

  const requestMessages = [
    {
      role: "system",
      content:
        "You are a helpful L'Oréal beauty advisor. Use web search for current information when needed. Focus on L'Oréal products, routines, skincare, haircare, makeup, fragrance, and related beauty topics. If you provide product or routine advice, include current links or citations when available. When generating a routine, format it as a clear numbered list with short steps and optional Morning and Evening headings. Keep answers concise and practical.",
    },
    ...toResponsesInput(messages),
  ];

  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      input: requestMessages,
      tools: [{ type: "web_search_preview" }],
      temperature: 0.2,
    }),
  });

  const data = await openAIResponse.json();

  if (!openAIResponse.ok) {
    return jsonResponse(
      {
        error: {
          message:
            data?.error?.message ||
            "OpenAI request failed while searching the web.",
        },
      },
      openAIResponse.status,
    );
  }

  return jsonResponse({
    answer: data.output_text || "",
    citations: extractCitations(data),
    model: data.model || "gpt-4o",
  });
}
