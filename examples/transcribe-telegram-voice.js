// transcribe-telegram-voice — minimal example for @acegalaxy/voice-gateway
//
// Setup:
//   npm install
//   npm run build
//   node examples/transcribe-telegram-voice.js

const { transcribe } = require("@acegalaxy/voice-gateway");
const { pickAudioSource } = require("@acegalaxy/voice-gateway/sources/telegram");

// In your Telegram message handler:
async function onVoiceMessage(msg, botToken) {
  const source = pickAudioSource(msg, botToken);
  if (!source) return;

  const result = await transcribe({
    source,
    provider: "whisper",
    caller: { service: "my-bot", scope: "public", userId: String(msg.from.id) }
  });

  if (result.ok) console.log("Transcript:", result.text);
  else console.warn("STT denied:", result.reason);
}
