
import { GoogleGenAI, Modality } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Gets grammar explanation from Gemini
 */
export async function getGrammarAnalysis(jp: string, zh: string): Promise<string> {
  const ai = getAI();
  const prompt = `你是一位专业的日语老师。请分析以下对话中的句子，并用简体中文简要说明文法重点、重点单词及文化背景：
    日文句子：${jp}
    中文意思：${zh}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "你是一个专业的日语教师，擅长深入浅出地讲解日语语法、词汇和文化背景。请使用友好且鼓励性的语气。",
        temperature: 0.7,
      }
    });
    return response.text || "暂时无法获取解析。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "解析失败，请检查网络或稍后重试。";
  }
}

/**
 * Generates speech for a Japanese sentence
 */
export async function generateJapaneseSpeech(text: string): Promise<string | null> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

/**
 * Base64 decoding helper
 */
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * PCM Decoding helper for 24kHz raw audio from Gemini TTS
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
