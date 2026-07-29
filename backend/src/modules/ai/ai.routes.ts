import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

router.post("/chat", async (req, res) => {
  const { messages } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "AI Assistant isn't configured yet — missing API key on the server.",
    });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required." });
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system:
        "You are DataVerse AI's data analyst assistant. Help users understand their datasets, suggest analyses, and explain statistics clearly and concisely.",
      messages: messages,
    });

    const textBlock = response.content.find((block) => block.type === "text");

    res.json({
      reply: textBlock && "text" in textBlock ? textBlock.text : "",
    });
  } catch (err: any) {
    console.error("AI chat error:", err.message);
    res.status(500).json({ error: "Something went wrong talking to the AI." });
  }
});

export default router;