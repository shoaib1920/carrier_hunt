
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult, ReportAiAnalysis, StudentProfile, Project, Internship, Skill } from "../types";
import { apiFetch } from "./api";

const GEMINI_MODEL = 'gemini-2.5-flash';
const ANALYSIS_MODEL = 'gemini-2.5-flash-lite';

function getClientApiKey(): string {
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || '';
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return item.split(/[,;\n]/).map((text) => text.trim()).filter(Boolean);
      if (item && typeof item === 'object' && 'name' in item) return [String((item as any).name).trim()];
      return [];
    }).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[,;\n]/).map((text) => text.trim()).filter(Boolean);
  }
  return [];
}

function normalizeProjects(value: unknown): Project[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((project, index) => {
      if (!project || typeof project === 'string') {
        const title = typeof project === 'string' ? project.trim() : `Untitled Project ${index + 1}`;
        return { id: `proj_${Date.now()}_${index}`, title, description: '', codeUrl: '', isVerified: false, verificationStatus: 'PENDING' as const };
      }
      return {
        id: `proj_${Date.now()}_${index}`,
        title: String((project as any).title || (project as any).name || `Untitled Project ${index + 1}`).trim(),
        description: String((project as any).description || (project as any).desc || '').trim(),
        codeUrl: String((project as any).codeUrl || (project as any).link || (project as any).url || '').trim(),
        isVerified: false,
        verificationStatus: 'PENDING' as const,
      };
    });
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeProjects(parsed);
    } catch {
      return value
        .split(/\n\s*[-*]\s*/)
        .map((line, index) => ({
          id: `proj_${Date.now()}_${index}`,
          title: line.trim(),
          description: '',
          codeUrl: '',
          isVerified: false,
          verificationStatus: 'PENDING' as const,
        }))
        .filter((project) => project.title);
    }
  }
  return [];
}

function normalizeParsedProfile(parsed: Partial<StudentProfile>): Partial<StudentProfile> {
  if (!parsed || typeof parsed !== 'object') return {};
  return {
    ...parsed,
    name: String(parsed.name || '').trim(),
    summary: String(parsed.summary || '').trim(),
    skills: normalizeStringArray(parsed.skills).map((name) => ({ name, isVerified: false })),
    university: String(parsed.university || '').trim(),
    department: String(parsed.department || '').trim(),
    projects: normalizeProjects(parsed.projects),
  };
}

const ai = new GoogleGenAI({ apiKey: getClientApiKey() });

const CV_PARSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    summary: { type: Type.STRING },
    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
    university: { type: Type.STRING },
    department: { type: Type.STRING },
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          codeUrl: { type: Type.STRING },
        },
      },
    },
  },
};

const CV_PARSE_PROMPT = `Act as an expert technical recruiter. Parse this CV and extract professional information.
Extract:
- Full Name
- Summary (Professional background)
- Core Skills (Technical)
- Projects (Title, Description, any links)
- Education (University name, Department)

Focus on quality evidence over buzzwords.`;

async function parseCVWithClient(promptContents: unknown): Promise<Partial<StudentProfile>> {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    throw new Error('No client Gemini API key configured');
  }

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: promptContents as never,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: CV_PARSE_SCHEMA,
    },
  });

  return normalizeParsedProfile(JSON.parse(response.text || '{}') as Partial<StudentProfile>);
}

async function parseCVWithServer(base64Data: string | null, mimeType: string | null, textContent?: string): Promise<Partial<StudentProfile>> {
  if (textContent) {
    return apiFetch<Partial<StudentProfile>>('/api/ai/parse-cv-text', {
      method: 'POST',
      body: JSON.stringify({ textContent }),
    });
  }

  return apiFetch<Partial<StudentProfile>>('/api/ai/parse-cv', {
    method: 'POST',
    body: JSON.stringify({ base64Data, mimeType }),
  });
}

function hasParsedCVData(parsed: Partial<StudentProfile>): boolean {
  return Boolean(
    parsed.name?.trim() ||
    parsed.summary?.trim() ||
    (Array.isArray(parsed.skills) && parsed.skills.length > 0) ||
    normalizeStringArray(parsed.skills).length > 0 ||
    parsed.department?.trim() ||
    (Array.isArray(parsed.projects) && parsed.projects.length > 0)
  );
}

const SYSTEM_INSTRUCTION = `You are a trust-focused AI assistant embedded in the Career Bridge platform. 
Your core objective is to bridge students and companies by clarifying actual evidence.

Rules:
- Act as a Supportive Mentor + Mirror.
- Never judge character, author intent, or label users as dishonest.
- Reason strictly from submitted material (skills and projects provided). 
- Translate technical work into clear signals for reviewers.
- Frame gaps as 'Growth Opportunities' or 'Next Steps', never as failures.
- Optimize for transparency, fairness, and low user fear.
- Do not recommend hiring decisions; inform them with evidence.
- Maintain a professional, non-threatening tone.`;

export const analyzeStudentProfile = async (
  skills: Skill[],
  projects: Project[],
  targetRole: string = "Software Engineer"
): Promise<AIAnalysisResult> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API key not configured, returning default analysis");
    return {
      score: 70,
      roadmap: [{ type: 'PROJECT', title: 'Portfolio Optimization', description: 'Add more verified technical assets.' }],
      compatibility: 60,
      atsKeywords: (skills || []).map(s => s.name),
      industryReadiness: 'Beginner'
    };
  }
  const prompt = `Student Evidence:
  Skills: ${(skills || []).map(s => s.name).join(', ')}
  Projects: ${JSON.stringify((projects || []).map(p => ({ title: p.title, description: p.description, status: p.verificationStatus })))}
  Target Role: ${targetRole}
  
  Please provide a factual, evidence-based analysis:
  1. Industry Readiness Score (0-100) based on observable evidence.
  2. Industry Readiness level (e.g. 'Beginner', 'Intermediate', 'Advanced', 'Industry-Ready').
  3. Growth Roadmap: 3-5 specific courses or project types to reach the next tier of readiness.
  4. ATS keyword suggestions found in current evidence.
  5. Compatibility estimation based on current demonstrated skills.`;

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            roadmap: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  provider: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            compatibility: { type: Type.NUMBER },
            atsKeywords: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            industryReadiness: { type: Type.STRING }
          },
          required: ["score", "roadmap", "compatibility", "atsKeywords", "industryReadiness"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as AIAnalysisResult;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      score: 70,
      roadmap: [{ type: 'PROJECT', title: 'Portfolio Optimization', description: 'Add more verified technical assets.' }],
      compatibility: 60,
      atsKeywords: (skills || []).map(s => s.name),
      industryReadiness: 'Beginner'
    };
  }
};

export const analyzeReport = async (
  report: { reason: string; description?: string; details?: string }
): Promise<ReportAiAnalysis> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('No Gemini API key configured for report analysis');
    return {
      severity: 'LOW',
      summary: 'AI analysis unavailable due to missing API key.',
      suggestedAction: 'DISMISS',
      confidence: 0,
    };
  }

  const prompt = `Review this platform report and return a JSON object with the following fields:
  - severity: LOW, MEDIUM, or HIGH
  - summary: one neutral one-line summary of the claim
  - suggestedAction: WARN, SHADOW_BAN, PERMANENT_BAN, or DISMISS
  - confidence: a numeric confidence score from 0 to 100

  Report Reason: ${report.reason}
  Report Description: ${report.description || report.details || 'No additional description provided.'}

  Only respond with valid JSON matching the requested schema.`;

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            severity: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
            summary: { type: Type.STRING },
            suggestedAction: { type: Type.STRING, enum: ['WARN', 'SHADOW_BAN', 'PERMANENT_BAN', 'DISMISS'] },
            confidence: { type: Type.NUMBER }
          },
          required: ['severity', 'summary', 'suggestedAction', 'confidence']
        }
      }
    });

    return JSON.parse(response.text || '{}') as ReportAiAnalysis;
  } catch (error) {
    console.error('Report analysis failed:', error);
    return {
      severity: 'LOW',
      summary: 'Unable to analyze report at this time.',
      suggestedAction: 'DISMISS',
      confidence: 0,
    };
  }
};

export const compareReportAndDefense = async (
  report: { reason?: string; description?: string; details?: string; reporterId?: string; jobId?: string },
  defense: string
): Promise<{ finalSuggestion: 'WARN' | 'SHADOW_BAN' | 'PERMANENT_BAN' | 'DISMISS'; reasoning: string }> => {
  const apiKey = getClientApiKey();
  if (!apiKey) {
    console.warn('No Gemini API key configured for compareReportAndDefense');
    return { finalSuggestion: 'DISMISS', reasoning: 'AI unavailable - no API key configured.' };
  }

  const prompt = `You are a fair platform moderator assistant. Compare the reporter's claim and the recruiter's defense.

Report Reason: ${report.reason || 'No reason provided.'}
Report Description / Details: ${report.description || report.details || 'No additional details.'}

Recruiter Defense: ${defense || 'No defense provided.'}

Provide a concise JSON object with:
- finalSuggestion: one of WARN, SHADOW_BAN, PERMANENT_BAN, DISMISS
- reasoning: a clear explanation (1-3 sentences) describing why the suggestion was made, focusing only on evidence presented.

Respond ONLY with valid JSON matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            finalSuggestion: { type: Type.STRING, enum: ['WARN', 'SHADOW_BAN', 'PERMANENT_BAN', 'DISMISS'] },
            reasoning: { type: Type.STRING }
          },
          required: ['finalSuggestion', 'reasoning']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      finalSuggestion: (parsed.finalSuggestion as any) || 'DISMISS',
      reasoning: String(parsed.reasoning || '').trim() || 'No reasoning provided.'
    };
  } catch (error) {
    console.error('compareReportAndDefense failed:', error);
    return { finalSuggestion: 'DISMISS', reasoning: 'AI analysis failed.' };
  }
};

export const parseCV = async (base64Data: string, mimeType: string): Promise<Partial<StudentProfile>> => {
  const contents = [
    { inlineData: { data: base64Data, mimeType } },
    { text: CV_PARSE_PROMPT },
  ];

  if (getClientApiKey()) {
    try {
      const parsed = await parseCVWithClient(contents);
      if (hasParsedCVData(parsed)) return parsed;
    } catch (e) {
      console.warn('Client CV parse failed, trying server...', e);
    }
  }

  try {
    const parsed = await parseCVWithServer(base64Data, mimeType);
    if (!hasParsedCVData(parsed)) {
      throw new Error('Could not extract details from this CV. Try a PDF or fill in manually.');
    }
    return parsed;
  } catch (e) {
    const message = (e as Error).message || 'CV scan failed';
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      throw new Error('CV scan unavailable. Start the API server (npm run server) or set VITE_GEMINI_API_KEY.');
    }
    throw new Error(message);
  }
};

export const parseCVText = async (textContent: string): Promise<Partial<StudentProfile>> => {
  const trimmed = textContent.trim();
  if (!trimmed) {
    throw new Error('The file appears to be empty.');
  }

  const contents = [{ text: `${CV_PARSE_PROMPT}\n\nCV TEXT:\n${trimmed}` }];

  if (getClientApiKey()) {
    try {
      const parsed = await parseCVWithClient(contents);
      if (hasParsedCVData(parsed)) return parsed;
    } catch (e) {
      console.warn('Client text CV parse failed, trying server...', e);
    }
  }

  try {
    const parsed = await parseCVWithServer(null, null, trimmed);
    if (!hasParsedCVData(parsed)) {
      throw new Error('Could not extract details from this CV. Please fill in manually.');
    }
    return parsed;
  } catch (e) {
    const message = (e as Error).message || 'CV scan failed';
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      throw new Error('CV scan unavailable. Start the API server (npm run server) or set VITE_GEMINI_API_KEY.');
    }
    throw new Error(message);
  }
};

export const generateCVContent = async (student: StudentProfile, jobDescription?: string): Promise<any> => {
  const prompt = `Generate a high-impact, professional "Master CV" content for the following student.
  Student: ${JSON.stringify(student)}
  ${jobDescription ? `Targeting this Job Description: ${jobDescription}` : ''}
  
  Optimize for:
  1. Professional summary that highlights verified project evidence.
  2. Bullet points for projects that use action verbs and quantify impact.
  3. Skill categorization.
  4. Suggested layout theme (Minimal, Bold, or Creative).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            professionalSummary: { type: Type.STRING },
            suggestedBulletPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            skillCategories: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: { category: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.STRING } } } 
              } 
            },
            theme: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Generate CV Error", e);
    return null;
  }
};

export const generateCandidateSignal = async (student: StudentProfile, internship?: Internship): Promise<string> => {
  const context = internship ? `against the role of ${internship.role || internship.title} at ${internship.companyName}` : "regarding their general verified evidence";
  const prompt = `Generate a concise, factual summary for a recruiter regarding this candidate's verified evidence ${context}.
  Candidate: ${student.name}
  Skills: ${(student.skills || []).map(s => s.name).join(', ')}
  Projects: ${JSON.stringify((student.projects || []).filter(p => p.isVerified).map(p => ({ title: p.title, desc: p.description })))}
  
  Focus on translating technical work into industry signals. How do their specific projects prove they can handle the requirements? Do not use hype.`;

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text || "No summary available.";
  } catch (error) {
    return "Evidence review pending.";
  }
};

export const getRoleRecommendations = async (student: StudentProfile, internships: Internship[]): Promise<{id: string, score: number, reason: string}[]> => {
  const prompt = `Compare this student's profile with the following internships and identify the top 3 best matches.
  Student: ${(student.skills || []).map(s => s.name).join(', ')}
  Projects: ${(student.projects || []).map(p => p.title).join(', ')}
  
  Internships: ${JSON.stringify(internships.map(i => ({ id: i.id, role: i.role, reqs: i.requirements })))}
  
  Return a JSON array of objects with internship id, a match score (0-100), and a short factual reason why (e.g., 'Matches React and Node.js requirements via verified project X').`;

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              score: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ["id", "score", "reason"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    return [];
  }
};

export const generatePreparationKit = async (student: StudentProfile, internship: Internship): Promise<string[]> => {
  const prompt = `Generate 4 highly specific 'Reasoning Prep' questions for this student applying to ${internship.role || internship.title} at ${internship.companyName}.
  The student's verified evidence includes: ${(student.projects || []).map(p => p.title).join(', ')}.
  
  Instructions:
  - Questions must force the student to connect their project architecture to the job's specific requirements (${internship.requirements.join(', ')}).
  - Example: 'Your E-commerce project used Redux; how would you adapt that state management logic for our high-frequency trading dashboard?'
  - No generic trivia. Stay grounded in their actual code and the target role.`;

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["questions"]
        }
      }
    });
    return JSON.parse(response.text || '{"questions":[]}').questions;
  } catch (error) {
    return [];
  }
};

export const getElitePathInsights = async (student: StudentProfile): Promise<any> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API key not configured, returning default elite path insights");
    return {
      cvLoopholes: [{ issue: "Add GitHub profile link", severity: "MEDIUM" }],
      improvements: [{ fix: "Add quantified metrics to project descriptions", impact: "Better ATS matching" }],
      marketTrends: [{ tech: "React", demand: "HOT", context: "89% of frontend roles require React" }],
      bestSkillsToLearnNext: [{ skill: "TypeScript", reason: "Complements your React stack", estimatedTimeToLearn: "3-4 weeks" }]
    };
  }

  const profileSummary = `
Student Profile:
- Name: ${student.name}
- University: ${student.university}
- Department: ${student.department}
- Skills: ${(student.skills || []).map(s => s.name).join(', ')}
- Projects: ${JSON.stringify((student.projects || []).map(p => ({ title: p.title, description: p.description, verified: p.isVerified })))}
- Summary: ${student.summary || 'Not provided'}
- Verified Assets: ${(student.projects || []).filter(p => p.isVerified).length}/${(student.projects || []).length}
`;

  const prompt = `You are an elite career coach analyzing this student's CV and market data to provide personalized, actionable guidance.

${profileSummary}

Provide a comprehensive career development analysis in this exact JSON format:

{
  "cvLoopholes": [
    {
      "issue": "Specific gap found in their CV (e.g., missing GitHub, no project links, weak project descriptions, missing quantified results)",
      "severity": "HIGH | MEDIUM | LOW"
    }
  ],
  "improvements": [
    {
      "fix": "Specific actionable improvement they should make (e.g., 'Add deployment URLs to all projects')",
      "impact": "Expected outcome (e.g., 'Increases recruiter click-through by 40%')"
    }
  ],
  "marketTrends": [
    {
      "tech": "Technology name",
      "demand": "HOT | GROWING | STABLE",
      "context": "Brief explanation from current market data (reference specific stats/trends)"
    }
  ],
  "bestSkillsToLearnNext": [
    {
      "skill": "Skill name",
      "reason": "Why this complements their current stack",
      "estimatedTimeToLearn": "Realistic timeframe (e.g., '2-3 weeks' or '3 months')"
    }
  ]
}

Guidelines:
- Respond in compact JSON with no whitespace, no markdown, no explanation.
- Limit each string value to 100 characters maximum.
- Return at most 5 items per array.
- Base CV loopholes ONLY on what's missing or weak in their profile - be specific.
- Each improvement must be concrete and measurable.
- Use WEB SEARCH data for market trends - reference actual market demand.
- Recommend 3-4 skills, prioritizing technologies that build on their existing stack.
- Be encouraging but honest. Frame gaps as growth opportunities.`;

  const safeParseJSON = (raw: string): any | null => {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const tryParse = (text: string) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    const direct = tryParse(cleaned);
    if (direct !== null) return direct;

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match?.[0]) {
      const extracted = match[0];
      const parsed = tryParse(extracted);
      if (parsed !== null) return parsed;
    }

    console.error('Elite Path Insights JSON parse failed. Raw response:', raw);
    return null;
  };

  const buildGenerateConfig = () => ({
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        cvLoopholes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              issue: { type: Type.STRING },
              severity: { type: Type.STRING }
            },
            required: ["issue", "severity"]
          }
        },
        improvements: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              fix: { type: Type.STRING },
              impact: { type: Type.STRING }
            },
            required: ["fix", "impact"]
          }
        },
        marketTrends: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              tech: { type: Type.STRING },
              demand: { type: Type.STRING },
              context: { type: Type.STRING }
            },
            required: ["tech", "demand", "context"]
          }
        },
        bestSkillsToLearnNext: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skill: { type: Type.STRING },
              reason: { type: Type.STRING },
              estimatedTimeToLearn: { type: Type.STRING }
            },
            required: ["skill", "reason", "estimatedTimeToLearn"]
          }
        }
      },
      required: ["cvLoopholes", "improvements", "marketTrends", "bestSkillsToLearnNext"]
    }
  });

  const sendRequest = async (model: string) => {
    return ai.models.generateContent({
      model,
      contents: prompt,
      config: buildGenerateConfig(),
    });
  };

  const is429Error = (error: any) => {
    const status = error?.status || error?.statusCode || error?.code;
    const message = String(error?.message || '').toUpperCase();
    return status === 429 || String(status) === '429' || message.includes('RESOURCE_EXHAUSTED');
  };

  try {
    const initialModel = ANALYSIS_MODEL;
    const fallbackModel = GEMINI_MODEL;

    let response: any | null = null;
    let didFallback = false;

    try {
      response = await sendRequest(initialModel);
    } catch (error: any) {
      if (is429Error(error)) {
        didFallback = true;
        response = await sendRequest(fallbackModel);
      } else {
        throw error;
      }
    }

    let parsed = safeParseJSON(response.text || '');
    if (parsed !== null) return parsed;

    if (!didFallback) {
      try {
        response = await sendRequest(fallbackModel);
        parsed = safeParseJSON(response.text || '');
        if (parsed !== null) return parsed;
      } catch (fallbackError) {
        console.error('Elite Path Insights fallback error:', fallbackError);
      }
    }

    console.error('Elite Path Insights failed to parse valid JSON from both models.');
    return null;
  } catch (error) {
    console.error("Elite Path Insights Error:", error);
    return null;
  }
};
