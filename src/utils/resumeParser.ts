import { supabase } from "./supabaseClient";
import { isDemoMode } from "./mode";

// The PDF reader is large, so it is only downloaded when a PDF is actually
// uploaded. Its worker is bundled with the app (the `?url` import), so the
// worker always matches the library version and nothing is fetched from a CDN.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    // The "legacy" build carries the polyfills older browsers need; the
    // default build only runs in the very latest ones.
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<typeof import('pdfjs-dist')>,
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsLib, worker]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjsLib;
    }).catch(err => {
      pdfjsPromise = null; // a failed download can be retried on the next upload
      throw err;
    });
  }
  return pdfjsPromise;
}

// Common tech skills for fallback extraction
const COMMON_SKILLS = [
  'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'TypeScript', 'HTML', 'CSS',
  'SQL', 'MongoDB', 'PostgreSQL', 'Git', 'Docker', 'AWS', 'Azure', 'Linux',
  'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Swift', 'Kotlin', 'Angular', 'Vue.js',
  'Express.js', 'Django', 'Flask', 'Spring Boot', 'Laravel', 'REST API', 'GraphQL',
  'Machine Learning', 'Data Science', 'AI', 'TensorFlow', 'PyTorch', 'Pandas',
  'Excel', 'Power BI', 'Tableau', 'Photoshop', 'Figma', 'UI/UX Design',
  'Project Management', 'Agile', 'Scrum', 'Communication', 'Leadership', 'Teamwork'
];

// Extract text from any file type
export async function extractTextFromFile(file: File): Promise<string> {
  try {
    // Handle PDF files
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await loadPdfjs();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      return fullText;
    }

    // Handle text files
    if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
      const text = await file.text();
      return text;
    }

    // For other file types, try to read as text (might work for some formats)
    try {
      const text = await file.text();
      // If we get readable text, use it
      if (text && text.length > 50) {
        return text;
      }
    } catch (e) {
      // If text extraction fails, use filename as fallback
      console.warn("Could not extract text from file, using filename:", e);
    }

    // Fallback: use filename and file type
    return `File: ${file.name}\nType: ${file.type || 'Unknown'}`;
  } catch (error) {
    console.error("File Extraction Error:", error);
    // Return filename as fallback
    return `File: ${file.name}`;
  }
}

const MAX_RESUME_CHARS = 20000;

// Matches a skill as a whole term, not as a substring: "Go" must not match
// "google", "Java" must not match "JavaScript", "Git" must not match "digital".
function containsSkill(textLower: string, skill: string): boolean {
  const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9+#])${escaped}(?![a-z0-9+#])`, 'i').test(textLower);
}

export function extractSkillsByKeyword(text: string): string[] {
  const textLower = text.toLowerCase();
  return COMMON_SKILLS.filter(skill => containsSkill(textLower, skill));
}

// Extract skills using AI, with fallback to keyword matching.
// Returns only skills actually found in the text; an empty array means none were found.
export async function parseResumeWithAI(text: string): Promise<string[]> {
  let extractedSkills: string[] = [];

  // The AI function needs a signed-in account (it spends a paid API quota), so
  // the browser-only demo goes straight to keyword matching.
  if (!isDemoMode()) {
    try {
      const { data, error } = await supabase.functions.invoke('parse-resume', {
        body: { resumeText: text.slice(0, MAX_RESUME_CHARS) }
      });

      if (!error && data && !data.error && Array.isArray(data.skills)) {
        extractedSkills = data.skills
          .filter((skill: unknown): skill is string => typeof skill === 'string' && skill.trim().length > 0)
          .map((skill: string) => skill.trim().slice(0, 60));
      } else if (error) {
        console.warn("AI extraction error:", error);
      }
    } catch (error) {
      console.warn("AI extraction failed, using keyword matching:", error);
    }
  }

  if (extractedSkills.length === 0) {
    extractedSkills = extractSkillsByKeyword(text);
  }

  // Deduplicate case-insensitively and keep a reasonable number.
  const seen = new Set<string>();
  const unique = extractedSkills.filter(skill => {
    const key = skill.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(0, 15);
}
