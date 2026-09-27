import { GoogleGenAI, Type } from '@google/genai';
import { getAllBooks, getBookById } from '../store';

// AI In-Memory Configuration & Runtime State
let aiEnabled = true;

// Aggregated minimal metrics (No personal data / no full conversations stored)
const aiAnalytics = {
  totalRequests: 0,
  recommendationsCount: 0,
  searchesCount: 0,
  assistantQueriesCount: 0,
  summariesCount: 0,
  readerQueriesCount: 0,
  failedRequests: 0,
  startedAt: new Date().toISOString(),
};

// Rate limiter memory store: IP/UserId -> array of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 35; // Generous for smooth discovery

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(identifier) || []).filter(t => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = timestamps[0];
    const retryAfterSec = Math.ceil((oldestInWindow + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  timestamps.push(now);
  rateLimitMap.set(identifier, timestamps);
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - timestamps.length };
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const active = timestamps.filter(t => t > windowStart);
    if (active.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, active);
    }
  }
}, 5 * 60 * 1000);

let cachedClient: GoogleGenAI | null = null;
let geminiCooldownUntil = 0;

export function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

export function isAIEnabled(): boolean {
  return aiEnabled && isAIConfigured();
}

export function isAIReadyForInference(): boolean {
  if (!isAIEnabled()) return false;
  if (Date.now() < geminiCooldownUntil) {
    return false;
  }
  return true;
}

function handleAIInferenceError(err: any, _featureName: string) {
  aiAnalytics.failedRequests++;
  const errMsg = err?.message || String(err);
  const isQuotaOrRateLimit =
    errMsg.includes('429') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('quota') ||
    errMsg.includes('Quota exceeded');

  if (isQuotaOrRateLimit) {
    // Set 60-second cooldown so subsequent requests seamlessly use fast rule-based engine
    geminiCooldownUntil = Date.now() + 60 * 1000;
  }
}

export function setAIEnabled(enabled: boolean): boolean {
  aiEnabled = Boolean(enabled);
  return aiEnabled;
}

export function getAISettings() {
  return {
    enabled: aiEnabled,
    configured: isAIConfigured(),
    provider: 'Gemini (Google Gen AI)',
    model: 'gemini-3.8-flash',
    status: !isAIConfigured()
      ? 'NOT_CONFIGURED'
      : aiEnabled
      ? 'ACTIVE'
      : 'DISABLED_BY_ADMIN',
  };
}

export function getAIAnalytics() {
  return {
    ...aiAnalytics,
    status: getAISettings(),
  };
}

// ==========================================
// FEATURE 1: BOOK RECOMMENDATIONS
// ==========================================

export interface RecommendationContext {
  userId?: string;
  readBookIds?: string[];
  wishlistBookIds?: string[];
  purchasedBookIds?: string[];
  currentBookId?: string;
  preferredCategories?: string[];
  preferredLanguages?: string[];
  limit?: number;
}

export async function getBookRecommendations(context: RecommendationContext): Promise<{
  recommendations: Array<{
    book: any;
    reason: string;
    affinityScore?: number;
    matchType: 'AI_RANKED' | 'HEURISTIC';
  }>;
  aiPowered: boolean;
}> {
  aiAnalytics.totalRequests++;
  aiAnalytics.recommendationsCount++;

  const allBooks = await getAllBooks({ status: 'ACTIVE' });
  if (allBooks.length === 0) {
    return { recommendations: [], aiPowered: false };
  }

  const limit = Math.max(1, Math.min(context.limit || 6, 12));
  const excludedIds = new Set<string>();

  if (context.currentBookId) excludedIds.add(context.currentBookId);

  // Candidate pool
  const candidateBooks = allBooks.filter(b => !excludedIds.has(b.id));

  // Determine user context profile safely
  const contextBookTitles: string[] = [];
  const contextCategories: string[] = [...(context.preferredCategories || [])];
  const contextTags: string[] = [];

  const historyIds = [
    ...(context.readBookIds || []),
    ...(context.wishlistBookIds || []),
    ...(context.purchasedBookIds || []),
  ];

  for (const hid of historyIds) {
    const b = allBooks.find(item => item.id === hid);
    if (b) {
      contextBookTitles.push(b.title);
      if (b.category && !contextCategories.includes(b.category)) contextCategories.push(b.category);
      if (Array.isArray(b.tags)) contextTags.push(...b.tags);
    }
  }

  if (context.currentBookId) {
    const current = allBooks.find(b => b.id === context.currentBookId);
    if (current) {
      contextBookTitles.push(current.title);
      if (current.category && !contextCategories.includes(current.category)) contextCategories.push(current.category);
      if (Array.isArray(current.tags)) contextTags.push(...current.tags);
    }
  }

  // Attempt Gemini Server-Side AI Ranking
  const ai = getAIClient();
  if (isAIReadyForInference() && ai) {
    try {
      const candidatesPayload = candidateBooks.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        category: b.category,
        language: b.language,
        type: b.bookType || b.type,
        tags: b.tags,
      }));

      const prompt = `You are an expert academic and computer science librarian.
Recommend the top ${limit} most relevant books from the candidate catalog based on the reader's reading history and interests.

Reader Profile Context:
- Engaged/Read/Saved Books: ${contextBookTitles.length > 0 ? contextBookTitles.join(', ') : 'Computer Science & Software Development'}
- Preferred Categories: ${contextCategories.length > 0 ? contextCategories.join(', ') : 'Computer Science, Programming, AI'}
- Preferred Tags: ${contextTags.slice(0, 10).join(', ') || 'algorithms, python, web'}

Candidate Books Catalog (YOU MUST ONLY CHOOSE FROM THESE EXACT IDS):
${JSON.stringify(candidatesPayload, null, 2)}

Return a JSON array where each object has:
- "bookId": Exact string ID of candidate book
- "reason": Short, friendly, non-sensitive reason (1 concise sentence, e.g. "Recommended because you explored Python and Data Science books.")`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                bookId: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['bookId', 'reason'],
            },
          },
        },
      });

      const textOutput = response.text;
      if (textOutput) {
        const parsed = JSON.parse(textOutput) as Array<{ bookId: string; reason: string }>;
        const validRecs: Array<{ book: any; reason: string; matchType: 'AI_RANKED' }> = [];

        for (const item of parsed) {
          const matchedBook = candidateBooks.find(b => b.id === item.bookId);
          if (matchedBook && !validRecs.some(r => r.book.id === matchedBook.id)) {
            validRecs.push({
              book: matchedBook,
              reason: item.reason || `Recommended based on your interest in ${matchedBook.category}.`,
              matchType: 'AI_RANKED',
            });
          }
          if (validRecs.length >= limit) break;
        }

        if (validRecs.length > 0) {
          return { recommendations: validRecs, aiPowered: true };
        }
      }
    } catch (err: any) {
      handleAIInferenceError(err, 'Recommendations');
    }
  }

  // Resilient Heuristic Fallback (Always returns real database books with explanations)
  const ranked = candidateBooks.map(b => {
    let score = 0;
    let reason = `Popular in ${b.category}`;

    if (contextCategories.some(c => c.toLowerCase() === b.category?.toLowerCase())) {
      score += 5;
      reason = `Recommended because you have explored ${b.category} books.`;
    }

    if (Array.isArray(b.tags) && contextTags.length > 0) {
      const matchCount = b.tags.filter((t: string) => contextTags.includes(t)).length;
      if (matchCount > 0) {
        score += matchCount * 2;
        reason = `Matches related topics (${b.tags.slice(0, 2).join(', ')}) from your recent reading.`;
      }
    }

    if (b.featured) score += 2;
    if (b.rating >= 4.8) score += 1;

    return { book: b, score, reason };
  });

  ranked.sort((a, b) => b.score - a.score);
  const fallbackRecs = ranked.slice(0, limit).map(r => ({
    book: r.book,
    reason: r.reason,
    affinityScore: r.score,
    matchType: 'HEURISTIC' as const,
  }));

  return { recommendations: fallbackRecs, aiPowered: false };
}

// ==========================================
// FEATURE 2: SMART NATURAL LANGUAGE SEARCH
// ==========================================

export interface SmartSearchResult {
  books: any[];
  interpretedIntent: {
    query: string;
    topic?: string;
    category?: string;
    language?: string;
    isFree?: boolean;
    maxPrice?: number;
    difficulty?: string;
    explanation: string;
  };
  aiPowered: boolean;
  message?: string;
}

export async function smartSearchBooks(query: string): Promise<SmartSearchResult> {
  aiAnalytics.totalRequests++;
  aiAnalytics.searchesCount++;

  const cleanQuery = query ? query.trim() : '';
  const allBooks = await getAllBooks({ status: 'ACTIVE' });

  if (!cleanQuery) {
    return {
      books: allBooks.slice(0, 8),
      interpretedIntent: {
        query: '',
        explanation: 'Showing trending library titles.',
      },
      aiPowered: false,
    };
  }

  const ai = getAIClient();
  if (isAIReadyForInference() && ai) {
    try {
      const candidateList = allBooks.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        category: b.category,
        language: b.language,
        type: b.bookType || b.type,
        price: b.price,
        tags: b.tags,
        description: b.description.slice(0, 140),
      }));

      const prompt = `You are a multilingual AI search assistant for a Computer Science Book Store.
Interpret the user's natural language search query (which may be in English, Hindi, Hinglish, or Marathi) and match it against the actual books in the catalog.

User Query: "${cleanQuery}"

Catalog of Books (MUST ONLY SELECT FROM THESE IDS):
${JSON.stringify(candidateList, null, 2)}

Instructions:
1. Understand topic, language preference, budget/price limit (e.g. "under ₹200", "free", "beginner level", "cybersecurity", "Python ki book").
2. Select the matching book IDs from the catalog in order of relevance.
3. Provide a brief explanation of how you interpreted the query in friendly, accessible language.
4. If no books in the catalog match the criteria, return an empty array for matchedBookIds.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              category: { type: Type.STRING },
              language: { type: Type.STRING },
              isFree: { type: Type.BOOLEAN },
              maxPrice: { type: Type.NUMBER },
              difficulty: { type: Type.STRING },
              matchedBookIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              explanation: { type: Type.STRING },
            },
            required: ['matchedBookIds', 'explanation'],
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        const matchedIds: string[] = Array.isArray(parsed.matchedBookIds) ? parsed.matchedBookIds : [];

        // Validate strictly against database
        const matchingBooks: any[] = [];
        for (const id of matchedIds) {
          const b = allBooks.find(item => item.id === id);
          if (b && !matchingBooks.some(m => m.id === b.id)) {
            matchingBooks.push(b);
          }
        }

        const message = matchingBooks.length === 0
          ? 'No matching books were found in the current library.'
          : undefined;

        return {
          books: matchingBooks,
          interpretedIntent: {
            query: cleanQuery,
            topic: parsed.topic,
            category: parsed.category,
            language: parsed.language,
            isFree: parsed.isFree,
            maxPrice: parsed.maxPrice,
            difficulty: parsed.difficulty,
            explanation: parsed.explanation || `Interpreted query for ${parsed.topic || cleanQuery}.`,
          },
          aiPowered: true,
          message,
        };
      }
    } catch (err: any) {
      handleAIInferenceError(err, 'Search');
    }
  }

  // Resilient Keyword/Regex Matcher Fallback
  const qLower = cleanQuery.toLowerCase();
  const isFreeSearch = qLower.includes('free') || qLower.includes('muft') || qLower.includes('phat');
  const isHindiSearch = qLower.includes('hindi') || qLower.includes('हिंदी');
  const isMarathiSearch = qLower.includes('marathi') || qLower.includes('मराठी');

  const filtered = allBooks.filter(b => {
    const titleMatch = b.title.toLowerCase().includes(qLower);
    const authorMatch = b.author.toLowerCase().includes(qLower);
    const catMatch = b.category.toLowerCase().includes(qLower);
    const tagMatch = Array.isArray(b.tags) && b.tags.some((t: string) => t.toLowerCase().includes(qLower) || qLower.includes(t.toLowerCase()));
    const langMatch = (isHindiSearch && b.language === 'Hindi') || (isMarathiSearch && b.language === 'Marathi');

    let priceMatch = true;
    if (isFreeSearch) {
      priceMatch = b.bookType === 'FREE' || b.type === 'FREE';
    }

    return (titleMatch || authorMatch || catMatch || tagMatch || langMatch) && priceMatch;
  });

  return {
    books: filtered,
    interpretedIntent: {
      query: cleanQuery,
      explanation: `Showing keyword search results for "${cleanQuery}" from catalog.`,
    },
    aiPowered: false,
    message: filtered.length === 0 ? 'No matching books were found in the current library.' : undefined,
  };
}

// ==========================================
// FEATURE 3: AI BOOK ASSISTANT CHAT
// ==========================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatAboutBook(
  bookId: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<{
  reply: string;
  bookTitle: string;
  aiPowered: boolean;
}> {
  aiAnalytics.totalRequests++;
  aiAnalytics.assistantQueriesCount++;

  const book = await getBookById(bookId);
  if (!book) {
    throw new Error('Book not found in database');
  }

  const ai = getAIClient();
  if (isAIReadyForInference() && ai) {
    try {
      const bookContext = {
        title: book.title,
        author: book.author,
        category: book.category,
        description: book.description,
        language: book.language,
        pages: book.pages,
        publisher: book.publisher,
        publicationYear: book.publicationYear,
        isbn: book.isbn,
        tags: book.tags,
        bookType: book.bookType || book.type,
        price: book.price,
        chapters: book.chapters?.map((c: any) => ({ title: c.title, readTime: c.readTime })),
      };

      const systemInstruction = `You are the dedicated AI Book Assistant for the Book Store.
You are helping a student or reader understand the book: "${book.title}" by ${book.author}.

STRICT GROUNDING & COPYRIGHT RULES:
1. Ground your answers strictly on the available book metadata and description provided below.
2. Do NOT invent or hallucinate facts that are not supported by the book information.
3. If the user asks for information not present in the book's metadata or chapter outlines, politely reply:
   "I don't have enough information in this book's available content to answer that accurately."
4. Respect copyright: Do NOT reproduce entire chapters or pirate book content.
5. Multilingual Support:
   - If the user asks in Hindi, respond in clean Hindi.
   - If the user asks in Hinglish, respond in simple conversational Hinglish.
   - If the user asks in Marathi, respond in Marathi.
   - Otherwise respond in clear, friendly English.
6. Clearly distinguish between confirmed book facts and general educational guidance.

AVAILABLE BOOK METADATA:
${JSON.stringify(bookContext, null, 2)}`;

      // Format contents with conversation turns
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      for (const msg of conversationHistory.slice(-6)) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contents as any,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      const reply = response.text || "I'm ready to answer any questions about this book's topics and structure.";
      return {
        reply,
        bookTitle: book.title,
        aiPowered: true,
      };
    } catch (err: any) {
      handleAIInferenceError(err, 'Book Assistant');
    }
  }

  // Fallback response if AI is unavailable
  const safeTitle = book.title;
  const safeAuthor = book.author;
  const safeCategory = book.category;
  const safeDesc = book.description;

  return {
    reply: `Based on the library catalog, "${safeTitle}" is authored by ${safeAuthor} in the ${safeCategory} category. Summary: ${safeDesc} (Note: AI live reasoning is temporarily running in offline catalog mode).`,
    bookTitle: safeTitle,
    aiPowered: false,
  };
}

// ==========================================
// FEATURE 4: BOOK SUMMARY & KEY TAKEAWAYS
// ==========================================

export interface BookSummaryResult {
  shortSummary: string;
  keyTopics: string[];
  keyTakeaways: string[];
  targetAudience: string;
  prerequisites?: string[];
  aiPowered: boolean;
}

export async function generateBookSummary(bookId: string): Promise<BookSummaryResult> {
  aiAnalytics.totalRequests++;
  aiAnalytics.summariesCount++;

  const book = await getBookById(bookId);
  if (!book) {
    throw new Error('Book not found in database');
  }

  const ai = getAIClient();
  if (isAIReadyForInference() && ai) {
    try {
      const bookContext = {
        title: book.title,
        author: book.author,
        category: book.category,
        description: book.description,
        tags: book.tags,
        language: book.language,
        chapters: book.chapters?.map((c: any) => c.title),
      };

      const prompt = `You are an academic textbook synthesizer.
Generate a high-quality educational summary and key takeaways for the book based strictly on its description and chapter metadata.

Book Information:
${JSON.stringify(bookContext, null, 2)}

Output Requirements:
- shortSummary: 2-3 concise paragraphs synthesizing the core themes.
- keyTopics: 4-6 specific technical topics covered.
- keyTakeaways: 3-5 high-value learning outcomes for students.
- targetAudience: Who benefits most from this title (e.g. undergraduate students, backend engineers, beginners).
- prerequisites: 2-3 foundational concepts helpful before reading.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shortSummary: { type: Type.STRING },
              keyTopics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              keyTakeaways: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              targetAudience: { type: Type.STRING },
              prerequisites: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['shortSummary', 'keyTopics', 'keyTakeaways', 'targetAudience'],
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        return {
          shortSummary: parsed.shortSummary,
          keyTopics: parsed.keyTopics || book.tags || [book.category],
          keyTakeaways: parsed.keyTakeaways || [],
          targetAudience: parsed.targetAudience || 'Computer science students and software developers',
          prerequisites: parsed.prerequisites || ['Basic computer fundamentals'],
          aiPowered: true,
        };
      }
    } catch (err: any) {
      handleAIInferenceError(err, 'Summary');
    }
  }

  // Fallback summary from book description
  return {
    shortSummary: book.description || `Comprehensive guide on ${book.category} authored by ${book.author}.`,
    keyTopics: book.tags && book.tags.length > 0 ? book.tags : [book.category, 'Practical Applications'],
    keyTakeaways: [
      `Understand fundamental concepts of ${book.category}.`,
      `Practical implementations and real-world computer science techniques.`,
      `Self-paced study material curated by ${book.publisher || 'Academic Press'}.`,
    ],
    targetAudience: `Students and professionals seeking knowledge in ${book.category}.`,
    prerequisites: ['Basic programming and computational thinking.'],
    aiPowered: false,
  };
}

// ==========================================
// FEATURE 5: READER AI ASSISTANT
// ==========================================

export interface ReaderAssistantInput {
  bookId: string;
  chapterTitle?: string;
  snippet: string;
  action: 'explain' | 'summarize' | 'simplify' | 'ask';
  userQuestion?: string;
}

export async function askReaderAssistant(input: ReaderAssistantInput): Promise<{
  result: string;
  action: string;
  aiPowered: boolean;
}> {
  aiAnalytics.totalRequests++;
  aiAnalytics.readerQueriesCount++;

  const book = await getBookById(input.bookId);
  const bookTitle = book?.title || 'Selected E-Book';

  const ai = getAIClient();
  if (isAIReadyForInference() && ai) {
    try {
      let promptInstruction = '';
      switch (input.action) {
        case 'explain':
          promptInstruction = 'Explain the key concept in this reading section thoroughly with an intuitive real-world analogy.';
          break;
        case 'summarize':
          promptInstruction = 'Provide 3 concise bullet points summarizing the core insight of this reading snippet.';
          break;
        case 'simplify':
          promptInstruction = 'Simplify this reading section in elementary language (ELI5) so a beginner can grasp it immediately.';
          break;
        case 'ask':
        default:
          promptInstruction = `Answer the user's question specifically about this excerpt: "${input.userQuestion || 'What does this mean?'}"`;
          break;
      }

      const prompt = `You are a patient academic tutor assisting a reader while they read "${bookTitle}".
Current Section: ${input.chapterTitle || 'Chapter Excerpt'}

Selected Reading Snippet:
"""
${input.snippet.slice(0, 1500)}
"""

Task: ${promptInstruction}

Rules:
- Respond in the language of the user question (English, Hindi, Hinglish, or Marathi).
- Ground your answer in the snippet.
- Be concise, educational, and encouraging.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });

      return {
        result: response.text || 'Explanation generated successfully.',
        action: input.action,
        aiPowered: true,
      };
    } catch (err: any) {
      handleAIInferenceError(err, 'Reader Assistant');
    }
  }

  // Fallback explanation
  return {
    result: `[Reader Note for "${bookTitle}"]: ${input.snippet.slice(0, 200)}... (Review this chapter's key formulas and code examples for comprehensive mastery).`,
    action: input.action,
    aiPowered: false,
  };
}
