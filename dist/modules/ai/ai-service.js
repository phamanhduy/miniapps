import { db } from '../../shared/database/db.js';
import { aiConfigs, aiSuggestions, appSettings, conversations, messages } from '../../shared/database/schema.js';
import { eq, and, gte, desc, count } from 'drizzle-orm';
import { config } from '../../config/index.js';
import { getProviderConfig, getAvailableProviders } from './provider-registry.js';
import { generateWithAnthropic } from './providers/anthropic.js';
import { generateWithGemini } from './providers/gemini.js';
import { generateWithOpenaiCompat } from './providers/openai-compat.js';
import { buildReplyDraftPrompt } from './prompts/reply-draft.js';
import { buildSummaryPrompt } from './prompts/summary.js';
import { buildSentimentPrompt } from './prompts/sentiment.js';
import { v4 as uuidv4 } from 'uuid';
function detectLanguage(text) {
    if (/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text))
        return 'vi';
    const vietnameseHints = [' khách ', ' chào ', ' tư vấn ', ' báo giá ', ' sản phẩm ', ' giúp ', ' nhé ', ' không '];
    return vietnameseHints.some((hint) => (` ${text.toLowerCase()} `).includes(hint)) ? 'vi' : 'en';
}
function escapeXmlBoundary(text) {
    return text.replace(/<\/?conversation_context>/gi, '');
}
function buildConversationContext(messages) {
    return messages
        .map((msg) => {
        const author = msg.senderType === 'self' ? 'staff' : (msg.senderName || 'customer');
        const content = escapeXmlBoundary(msg.content || '(empty)');
        return `[${msg.sentAt.toISOString()}] ${author}: ${content}`;
    })
        .join('\n');
}
async function getProviderApiKey(orgId, provider) {
    /* 1. Check registry (env-based) */
    const providerDef = getProviderConfig(provider);
    if (providerDef?.authToken)
        return providerDef.authToken;
    /* 2. Fallback: per-org DB setting */
    const setting = await db.query.appSettings.findFirst({
        where: and(eq(appSettings.orgId, orgId), eq(appSettings.settingKey, `ai_${provider}_api_key`)),
    });
    return setting?.valuePlain || '';
}
export async function getAiConfig(orgId) {
    let aiConfig = await db.query.aiConfigs.findFirst({ where: eq(aiConfigs.orgId, orgId) });
    if (!aiConfig) {
        await db.insert(aiConfigs).values({
            id: uuidv4(),
            orgId,
            provider: config.aiDefaultProvider,
            model: config.aiDefaultModel,
            maxDaily: 500,
            enabled: true
        });
        aiConfig = await db.query.aiConfigs.findFirst({ where: eq(aiConfigs.orgId, orgId) });
    }
    const availableProviders = getAvailableProviders();
    const hasKey = async (p) => !!(await getProviderApiKey(orgId, p));
    const [hasAnthropicKey, hasGeminiKey] = await Promise.all([hasKey('anthropic'), hasKey('gemini')]);
    return { ...aiConfig, hasAnthropicKey, hasGeminiKey, availableProviders };
}
export async function updateAiConfig(orgId, input) {
    const existing = await db.query.aiConfigs.findFirst({ where: eq(aiConfigs.orgId, orgId) });
    if (existing) {
        return db.update(aiConfigs)
            .set({
            provider: input.provider,
            model: input.model,
            maxDaily: input.maxDaily,
            enabled: input.enabled,
            updatedAt: new Date()
        })
            .where(eq(aiConfigs.orgId, orgId));
    }
    else {
        return db.insert(aiConfigs).values({
            id: uuidv4(),
            orgId,
            provider: input.provider || config.aiDefaultProvider,
            model: input.model || config.aiDefaultModel,
            maxDaily: input.maxDaily ?? 500,
            enabled: input.enabled ?? true,
        });
    }
}
export async function getAiUsage(orgId) {
    const currentConfig = await getAiConfig(orgId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const usedTodayRes = await db.select({ value: count() })
        .from(aiSuggestions)
        .where(and(eq(aiSuggestions.orgId, orgId), gte(aiSuggestions.createdAt, startOfDay)));
    const usedToday = usedTodayRes[0].value;
    return {
        usedToday,
        maxDaily: currentConfig?.maxDaily || 500,
        remaining: Math.max(0, (currentConfig?.maxDaily || 500) - usedToday),
        enabled: currentConfig?.enabled ?? true,
    };
}
async function loadConversation(conversationId, orgId) {
    const conversation = await db.query.conversations.findFirst({
        where: and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)),
        with: {
            contact: { columns: { fullName: true } },
            messages: {
                where: eq(messages.isDeleted, false),
                orderBy: [desc(messages.sentAt)],
                limit: 40,
                columns: { senderType: true, senderName: true, content: true, sentAt: true },
            },
        },
    });
    if (!conversation)
        throw new Error('Conversation not found');
    return { ...conversation, messages: [...conversation.messages].reverse() };
}
async function generateText(provider, apiKey, model, system, prompt) {
    const providerDef = getProviderConfig(provider);
    const baseUrl = providerDef?.baseUrl || '';
    if (provider === 'anthropic')
        return generateWithAnthropic(baseUrl, apiKey, model, system, prompt);
    if (provider === 'gemini')
        return generateWithGemini(baseUrl, apiKey, model, system, prompt);
    /* OpenAI, Qwen, Kimi all use OpenAI-compatible chat/completions API */
    if (provider === 'openai')
        return generateWithOpenaiCompat(`${baseUrl}/v1/chat/completions`, apiKey, model, system, prompt);
    if (provider === 'qwen')
        return generateWithOpenaiCompat(`${baseUrl}/compatible-mode/v1/chat/completions`, apiKey, model, system, prompt);
    if (provider === 'kimi')
        return generateWithOpenaiCompat(`${baseUrl}/v1/chat/completions`, apiKey, model, system, prompt);
    throw new Error(`Unsupported AI provider: ${provider}`);
}
async function saveSuggestion(input) {
    return db.insert(aiSuggestions).values({
        id: uuidv4(),
        orgId: input.orgId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        type: input.type,
        content: input.content,
        confidence: input.confidence,
    });
}
export async function generateAiOutput(input) {
    const [currentConfig, conversation] = await Promise.all([
        getAiConfig(input.orgId),
        loadConversation(input.conversationId, input.orgId),
    ]);
    if (!currentConfig?.enabled || !currentConfig.provider || !currentConfig.model) {
        throw new Error('AI is disabled or not properly configured');
    }
    // Atomic quota check
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const withinQuota = db.transaction((tx) => {
        const usedTodayRes = tx.select({ value: count() })
            .from(aiSuggestions)
            .where(and(eq(aiSuggestions.orgId, input.orgId), gte(aiSuggestions.createdAt, startOfDay)))
            .all();
        return usedTodayRes[0].value < (currentConfig?.maxDaily || 500);
    });
    if (!withinQuota)
        throw new Error('AI daily quota exceeded');
    const apiKey = await getProviderApiKey(input.orgId, currentConfig.provider);
    if (!apiKey)
        throw new Error('AI provider key is not configured');
    const contextText = buildConversationContext(conversation.messages);
    const language = detectLanguage(contextText);
    const customerName = conversation.contact?.fullName || 'customer';
    const userPrompt = [
        `<conversation_context>`,
        `Customer: ${customerName}`,
        contextText,
        `</conversation_context>`,
    ].join('\n');
    const system = input.type === 'reply_draft'
        ? buildReplyDraftPrompt(language)
        : input.type === 'summary'
            ? buildSummaryPrompt(language)
            : buildSentimentPrompt(language);
    const raw = await generateText(currentConfig.provider, apiKey, currentConfig.model, system, userPrompt);
    if (input.type === 'sentiment') {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            parsed = { label: 'neutral', confidence: 0.4, reason: raw };
        }
        const normalized = {
            label: ['positive', 'negative', 'neutral'].includes(parsed.label) ? parsed.label : 'neutral',
            confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0.4,
            reason: parsed.reason || raw,
        };
        await saveSuggestion({
            orgId: input.orgId,
            conversationId: input.conversationId,
            messageId: input.messageId,
            type: 'sentiment',
            content: JSON.stringify(normalized),
            confidence: normalized.confidence,
        });
        return normalized;
    }
    const text = raw.trim();
    await saveSuggestion({
        orgId: input.orgId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        type: input.type,
        content: text,
        confidence: 0.8,
    });
    return { content: text, confidence: 0.8 };
}
//# sourceMappingURL=ai-service.js.map