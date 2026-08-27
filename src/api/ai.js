import { store } from "../core/state.js";

/**
 * A standardized helper function to interact with the configured AI provider
 * (Gemini, OpenAI, or Claude). Sends a prompt and returns the text response.
 *
 * @param {string} systemPrompt - The system instruction or context for the AI.
 * @param {string|Array} userPrompt - The user's prompt (can be a string or an array for multimodal like images).
 * @returns {Promise<string>} The extracted text response from the AI.
 */
export async function askAI(systemPrompt, userPrompt) {
  const state = store.state;
  const p = state.ai.provider,
    key = state.ai.keys[p];
  if (!key)
    throw new Error(`Missing API key for ${p}. Please add it in Settings.`);
  let res,
    data,
    text = "";
  if (p === "gemini") {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: { text: systemPrompt } },
          contents: { parts: { text: userPrompt } },
        }),
      },
    );
    data = await res.json();
    if (data.error) throw new Error(data.error.message);
    text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  } else if (p === "openai") {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    data = await res.json();
    if (data.error) throw new Error(data.error.message);
    text = data.choices?.[0]?.message?.content;
  } else if (p === "claude") {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    data = await res.json();
    if (data.error) throw new Error(data.error.message);
    text = data.content?.[0]?.text;
  }
  if (!text) throw new Error("Empty response from AI");
  return text;
}
