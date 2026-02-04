// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // Test endpoint
// app.get("/health", (req, res) => res.json({ ok: true }));

// // Main endpoint
// app.get("/api/analyze", async (req, res) => {
//   try {
//     const ingredient = (req.query.ingredient || "").trim();
//     if (!ingredient) {
//       return res.status(400).json({ error: "ingredient is required" });
//     }

//     // Model list is documented by Google (example: Gemini 2.5 Flash). :contentReference[oaicite:5]{index=5}
//     const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

//     // Ask for JSON so frontend can render reliably
//     const prompt = `
// You are a food ingredient explainer.
// Ingredient: "${ingredient}"

// Return ONLY valid JSON with these keys:
// {
//   "ingredient": string,
//   "what_it_is": string,
//   "natural_or_artificial": "natural"|"artificial"|"both"|"unknown",
//   "risk_level": "low"|"medium"|"high"|"unknown",
//   "why_risk_level": string,
//   "who_should_limit_or_avoid": string[],
//   "common_uses": string[],
//   "summary_for_user": string
// }

// Rules:
// - Be balanced and cautious. If unclear, use "unknown".
// - Keep it short, beginner-friendly.
// `;

//     const result = await model.generateContent(prompt);
//     // const text = result.response.text().trim();

//     // // Basic JSON parsing
//     // try {
//     //   const json = JSON.parse(text);
//     //   res.json(json);
//     // } catch {
//     //   // If model returned non-JSON, return raw text
//     //   res.json({ ingredient, raw: text, warning: "Model did not return valid JSON." });
//     // }
//     const text = result.response.text().trim();

//     // Remove ```json ... ``` or ``` ... ``` wrappers if present
//     const cleaned = text
//         .replace(/^```json\s*/i, "")
//         .replace(/^```\s*/i, "")
//         .replace(/\s*```$/i, "")
//         .trim();

//     try {
//         const json = JSON.parse(cleaned);
//         res.json(json);
//     }   catch {
//         res.json({
//             ingredient,
//             raw: text,
//             cleaned_attempt: cleaned,
//             warning: "Could not parse JSON. Model may have returned extra text."
//         });
//     }

//   } catch (err) {
//     res.status(500).json({ error: "server error", detail: String(err.message || err) });
//   }
// });

// app.listen(process.env.PORT || 5000, () => {
//   console.log(`Backend running on http://localhost:${process.env.PORT || 5000}`);
// });



import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing. Check backend/.env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/analyze", async (req, res) => {
  try {
    const ingredient = (req.query.ingredient || "").trim();
    if (!ingredient) {
      return res.status(400).json({ error: "ingredient is required" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are a food ingredient explainer.

IMPORTANT:
Return ONLY raw JSON (no markdown, no backticks, no extra words).

Ingredient: "${ingredient}"

Return ONLY valid JSON with exactly these keys:
{
  "ingredient": string,
  "what_it_is": string,
  "natural_or_artificial": "natural"|"artificial"|"both"|"unknown",
  "risk_level": "low"|"medium"|"high"|"unknown",
  "why_risk_level": string,
  "who_should_limit_or_avoid": string[],
  "common_uses": string[],
  "summary_for_user": string
}

Rules:
- Be balanced and cautious. If unclear, use "unknown".
- Keep it short, beginner-friendly.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Fix 3: Remove code fences
    let candidate = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Fix 3: Extract JSON between first { and last }
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      candidate = candidate.slice(firstBrace, lastBrace + 1);
    }

    try {
      const json = JSON.parse(candidate);
      return res.json(json);
    } catch {
      return res.json({
        ingredient,
        raw: text,
        cleaned_attempt: candidate,
        warning: "Still not valid JSON. Model returned unexpected format.",
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "server error",
      detail: String(err.message || err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});