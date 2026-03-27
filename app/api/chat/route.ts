const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// --- Fallback Response (used if APIs fail or not configured) ---
function generateFallbackResponse(history: any[]) {
  const last = history?.length ? String(history[history.length - 1].content).toLowerCase() : "";

  // Services fallback
  if (/service|services|what do you do|offer|offerings/.test(last)) {
    return `GoHype Media offers:
- 3D Website Development: Immersive, interactive web experiences.
- Immersive UI/UX Design: Futuristic interfaces that move and engage.
- Web Performance Optimization: High-speed, responsive builds.`;
  }

  // Contact fallback
  if (/contact|phone|email|address/.test(last)) {
    return `You can reach GoHype Media at:
📞 +91-8447788703
✉️ info@gohypemedia.com
📍 New Delhi, India
🕐 Mon–Sat | 10 AM – 6:30 PM`;
  }

  // Default summary fallback
  return `GoHype Media — Experience the Future of the Web in 3D.
We build immersive, next-gen websites powered by motion, 3D, and interactivity.`;
}

// --- Main Chat Logic ---
async function runChat(chatHistory: any[]) {
  // 1️⃣ Try OpenAI (if key exists)
  if (OPENAI_API_KEY) {
    try {
      const messages = chatHistory.map((m: any) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const payload = {
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 800,
      };

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const j = await resp.json();
        const text = j.choices?.[0]?.message?.content || j.choices?.[0]?.text || "";
        if (text) return String(text).trim();
      } else {
        console.error("OpenAI error:", await resp.text());
      }
    } catch (err: any) {
      console.error("OpenAI request failed:", err.message);
    }
  }

  // 2️⃣ Try OpenRouter (if key exists)
  if (OPENROUTER_API_KEY) {
    try {
      const messages = chatHistory.map((m: any) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const payload = {
        model: "deepseek/deepseek-chat-v3.1:free",
        messages,
      };

      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const j = await resp.json();
        const text = j.choices?.[0]?.message?.content || j.choices?.[0]?.text || "";
        if (text) return String(text).trim();
      } else {
        console.error("OpenRouter error:", await resp.text());
      }
    } catch (err: any) {
      console.error("OpenRouter request failed:", err.message);
    }
  }

  // 3️⃣ Try Google Gemini (if key exists)
  if (GOOGLE_API_KEY) {
    try {
      const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = await import("@google/generative-ai");

      const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro-latest",
        systemInstruction:
          'You are "GoHype Bot", a friendly assistant for GoHype Media. Answer naturally and concisely using the company context.',
      });

      const generationConfig = {
        temperature: 0.9,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      };

      const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ];

      const chat = model.startChat({
        generationConfig,
        safetySettings,
        history: chatHistory.map((msg: any) => ({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        })),
      });

      const lastMessage = chatHistory[chatHistory.length - 1]?.content || "";
      const result = await chat.sendMessage(lastMessage);
      const response = result.response;
      return response.text();
    } catch (err: any) {
      console.error("Google SDK error:", err.message);
    }
  }

  // 4️⃣ Fallback (no API keys or all failed)
  console.warn("No AI APIs available — using fallback.");
  return generateFallbackResponse(chatHistory);
}

// --- Route Handler ---
export async function POST(req: Request) {
  try {
    const { history } = await req.json();
    if (!history) {
      return new Response("Error: Chat history is required.", { status: 400 });
    }
    const aiResponse = await runChat(history);
    return new Response(aiResponse, { status: 200 });
  } catch (error: any) {
    console.error("/api/chat error:", error.message);
    return new Response(`Error processing your request: ${error.message}`, { status: 500 });
  }
}
