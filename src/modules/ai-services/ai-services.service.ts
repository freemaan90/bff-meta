import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  async generateResponse(prompt: string, userMessage: string, rules: any[]) {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash', // GRATIS
    });

    const rulesText = rules
      .map(r => `- Si el mensaje contiene "${r.contains}", responder: "${r.reply}"`)
      .join('\n');

    const fullPrompt = `
${prompt}

Reglas del tenant:
${rulesText}

Si ninguna regla aplica, respondé de forma natural, clara y útil.
    `;

    const result = await model.generateContent({
      contents: [
        {
          role: 'system',
          parts: [{ text: fullPrompt }],
        },
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
    });

    return result.response.text();
  }
}
