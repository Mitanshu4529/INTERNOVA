import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from "./supabaseClient";

// FIXED: Use exact version match for the worker to prevent "Version Mismatch" errors
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

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

// Extract skills using AI, with fallback to keyword matching
export async function parseResumeWithAI(text: string): Promise<string[]> {
  console.log("Extracting skills from text...");
  
  let extractedSkills: string[] = [];
  
  // Try AI extraction first
  try {
    const { data, error } = await supabase.functions.invoke('openai-resume-api', {
      body: { resumeText: text }
    });

    if (!error && data && !data.error && data.skills) {
      extractedSkills = data.skills || [];
      console.log("AI Extracted Skills:", extractedSkills);
    }
  } catch (error) {
    console.warn("AI extraction failed, using keyword matching:", error);
  }
  
  // Fallback: Extract skills using keyword matching
  if (extractedSkills.length < 5) {
    const textLower = text.toLowerCase();
    const foundSkills: string[] = [];
    
    for (const skill of COMMON_SKILLS) {
      if (textLower.includes(skill.toLowerCase())) {
        foundSkills.push(skill);
        if (foundSkills.length >= 5) break;
      }
    }
    
    // Merge AI skills with keyword-matched skills
    extractedSkills = Array.from(new Set([...extractedSkills, ...foundSkills]));
  }
  
  // Ensure we return exactly 5 skills
  if (extractedSkills.length === 0) {
    // Ultimate fallback: return 5 common skills
    extractedSkills = ['Communication', 'Teamwork', 'Problem Solving', 'Time Management', 'Adaptability'];
  } else if (extractedSkills.length < 5) {
    // If we have less than 5, add some common ones
    const remaining = COMMON_SKILLS.filter(s => !extractedSkills.includes(s)).slice(0, 5 - extractedSkills.length);
    extractedSkills = [...extractedSkills, ...remaining].slice(0, 5);
  } else {
    // If we have more than 5, take the first 5
    extractedSkills = extractedSkills.slice(0, 5);
  }
  
  console.log("Final extracted skills (5):", extractedSkills);
  return extractedSkills;
}