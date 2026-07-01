import { GoogleGenAI, Type } from '@google/genai';

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

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.VITE_API_KEY || '';
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return item.split(/[,;\n]/).map((text) => text.trim()).filter(Boolean);
      if (item && typeof item === 'object' && 'name' in item) return [String(item.name).trim()];
      return [];
    }).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[,;\n]/).map((text) => text.trim()).filter(Boolean);
  }
  return [];
}

function normalizeProjects(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((project, index) => {
      if (!project || typeof project === 'string') {
        const title = typeof project === 'string' ? project.trim() : `Untitled Project ${index + 1}`;
        return { id: `proj_${Date.now()}_${index}`, title, description: '', codeUrl: '', isVerified: false, verificationStatus: 'PENDING' };
      }
      return {
        id: `proj_${Date.now()}_${index}`,
        title: String(project.title || project.name || `Untitled Project ${index + 1}`).trim(),
        description: String(project.description || project.desc || '').trim(),
        codeUrl: String(project.codeUrl || project.link || project.url || '').trim(),
        isVerified: false,
        verificationStatus: 'PENDING',
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
          verificationStatus: 'PENDING',
        }))
        .filter((project) => project.title);
    }
  }
  return [];
}

function normalizeParsedProfile(parsed) {
  if (!parsed || typeof parsed !== 'object') return {};
  return {
    name: String(parsed.name || '').trim(),
    summary: String(parsed.summary || '').trim(),
    skills: normalizeStringArray(parsed.skills),
    university: String(parsed.university || '').trim(),
    department: String(parsed.department || '').trim(),
    projects: normalizeProjects(parsed.projects),
  };
}

export async function analyzeStudentProfile(skills, projects, targetRole = 'Software Engineer') {
  const ai = getClient();
  const prompt = `Student Evidence:
  Skills: ${skills.map((s) => s.name).join(', ')}
  Projects: ${JSON.stringify(projects.map((p) => ({ title: p.title, description: p.description, status: p.verificationStatus })))}
  Target Role: ${targetRole}
  
  Please provide a factual, evidence-based analysis:
  1. Industry Readiness Score (0-100) based on observable evidence.
  2. Growth Roadmap: 3-5 specific courses or project types to reach the next tier of readiness.
  3. ATS keyword suggestions found in current evidence.
  4. Compatibility estimation based on current demonstrated skills.`;

  if (!ai) {
    return {
      score: 70,
      roadmap: [{ type: 'PROJECT', title: 'Portfolio Optimization', description: 'Add more verified technical assets.' }],
      compatibility: 60,
      atsKeywords: skills.map((s) => s.name),
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
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
                  description: { type: Type.STRING },
                },
              },
            },
            compatibility: { type: Type.NUMBER },
            atsKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['score', 'roadmap', 'compatibility', 'atsKeywords'],
        },
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error('analyzeStudentProfile', e);
    return {
      score: 70,
      roadmap: [{ type: 'PROJECT', title: 'Portfolio Optimization', description: 'Add more verified technical assets.' }],
      compatibility: 60,
      atsKeywords: skills.map((s) => s.name),
    };
  }
}

export async function parseCVText(textContent) {
  const ai = getClient();
  const prompt = `Act as an expert technical recruiter. Parse this CV and extract professional information.
  Extract:
  - Full Name
  - Summary (Professional background)
  - Core Skills (Technical)
  - Projects (Title, Description, any links)
  - Education (University name, Department)
  
  Focus on quality evidence over buzzwords.

  CV TEXT:
  ${textContent}`;

  if (!ai) {
    throw new Error('No server Gemini API key configured.');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
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
        },
      },
    });
    return normalizeParsedProfile(JSON.parse(response.text || '{}'));
  } catch (e) {
    console.error('parseCVText', e);
    throw e;
  }
}

export async function parseCV(base64Data, mimeType) {
  const ai = getClient();
  const prompt = `Act as an expert technical recruiter. Parse this CV and extract professional information.
  Extract:
  - Full Name
  - Summary (Professional background)
  - Core Skills (Technical)
  - Projects (Title, Description, any links)
  - Education (University name, Department)
  
  Focus on quality evidence over buzzwords.`;

  if (!ai) {
    throw new Error('No server Gemini API key configured.');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { inlineData: { data: base64Data, mimeType } },
        { text: prompt },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
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
        },
      },
    });
    return normalizeParsedProfile(JSON.parse(response.text || '{}'));
  } catch (e) {
    console.error('parseCV', e);
    throw e;
  }
}

export async function generateCVContent(student, jobDescription) {
  const ai = getClient();
  const prompt = `Generate a high-impact, professional "Master CV" content for the following student.
  Student: ${JSON.stringify(student)}
  ${jobDescription ? `Targeting this Job Description: ${jobDescription}` : ''}
  
  Optimize for:
  1. Professional summary that highlights verified project evidence.
  2. Bullet points for projects that use action verbs and quantify impact.
  3. Skill categorization.
  4. Suggested layout theme (Minimal, Bold, or Creative).`;

  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            professionalSummary: { type: Type.STRING },
            suggestedBulletPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            skillCategories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  items: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
            },
            theme: { type: Type.STRING },
          },
        },
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error('generateCVContent', e);
    return null;
  }
}

export async function generateCandidateSignal(student, internship) {
  const ai = getClient();
  const context = internship
    ? `against the role of ${internship.role} at ${internship.companyName}`
    : 'regarding their general verified evidence';
  const prompt = `Generate a concise, factual summary for a recruiter regarding this candidate's verified evidence ${context}.
  Candidate: ${student.name}
  Skills: ${student.skills.map((s) => s.name).join(', ')}
  Projects: ${JSON.stringify(student.projects.filter((p) => p.isVerified).map((p) => ({ title: p.title, desc: p.description })))}
  
  Focus on translating technical work into industry signals. How do their specific projects prove they can handle the requirements? Do not use hype.`;

  if (!ai) return 'Evidence review pending (configure GEMINI_API_KEY on the server).';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });
    return response.text || 'No summary available.';
  } catch {
    return 'Evidence review pending.';
  }
}

export async function getRoleRecommendations(student, internships) {
  const ai = getClient();
  const prompt = `Compare this student's profile with the following internships and identify the top 3 best matches.
  Student: ${student.skills.map((s) => s.name).join(', ')}
  Projects: ${student.projects.map((p) => p.title).join(', ')}
  
  Internships: ${JSON.stringify(internships.map((i) => ({ id: i.id, role: i.role, reqs: i.requirements })))}
  
  Return a JSON array of objects with internship id, a match score (0-100), and a short factual reason why (e.g., 'Matches React and Node.js requirements via verified project X').`;

  if (!ai) return [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              score: { type: Type.NUMBER },
              reason: { type: Type.STRING },
            },
            required: ['id', 'score', 'reason'],
          },
        },
      },
    });
    return JSON.parse(response.text || '[]');
  } catch {
    return [];
  }
}

export async function generatePreparationKit(student, internship) {
  const ai = getClient();
  const prompt = `Generate 4 highly specific 'Reasoning Prep' questions for this student applying to ${internship.role} at ${internship.companyName}.
  The student's verified evidence includes: ${student.projects.map((p) => p.title).join(', ')}.
  
  Instructions:
  - Questions must force the student to connect their project architecture to the job's specific requirements (${internship.requirements.join(', ')}).
  - Example: 'Your E-commerce project used Redux; how would you adapt that state management logic for our high-frequency trading dashboard?'
  - No generic trivia. Stay grounded in their actual code and the target role.`;

  if (!ai) return [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['questions'],
        },
      },
    });
    return JSON.parse(response.text || '{"questions":[]}').questions;
  } catch {
    return [];
  }
}

export async function generateProjectPrepQuestions(title, description) {
  const ai = getClient();
  if (!ai) return [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate 3 professional technical interview questions for a project titled "${title}" described as "${description}". Focus on architectural decisions and problem solving.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { questions: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ['questions'],
        },
      },
    });
    const data = JSON.parse(response.text || '{"questions":[]}');
    return data.questions || [];
  } catch (e) {
    console.error('generateProjectPrepQuestions', e);
    return [];
  }
}
