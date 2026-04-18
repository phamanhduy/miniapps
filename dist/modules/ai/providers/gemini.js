export async function generateWithGemini(baseUrl, apiKey, model, system, prompt) {
    const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            const status = response.status;
            throw new Error(`Gemini request failed with status ${status}`);
        }
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
        if (!text)
            throw new Error('Gemini returned empty content');
        return text;
    }
    finally {
        clearTimeout(timeout);
    }
}
//# sourceMappingURL=gemini.js.map