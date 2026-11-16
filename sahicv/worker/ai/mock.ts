import { normalizeResume } from '../../src/resume/model.ts';
import type { AiRequest } from './providers.ts';

// Stand-in AI used only in development and automated tests (ALLOW_MOCK=true).
// It returns plausible, clearly-labelled replies without calling any provider.

const s = (v: unknown) => (typeof v === 'string' ? v : '');

export function mockReply(req: AiRequest): Record<string, unknown> {
  const input = req.input;
  const role = s(input.role) || 'the role';
  const company = s(input.company) || 'the company';
  const r = input.resume && typeof input.resume === 'object' ? normalizeResume(input.resume) : null;
  const name = r?.basics.name || 'Candidate';

  switch (req.task) {
    case 'health':
      return { ok: true };
    case 'parse-resume': {
      const lines = s(input.text).split('\n').map((l) => l.trim()).filter(Boolean);
      const email = s(input.text).match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)?.[0] ?? '';
      const phone = s(input.text).match(/\+?\d[\d\s-]{8,}\d/)?.[0] ?? '';
      return {
        basics: { name: lines[0] ?? '', headline: lines[1] ?? '', email, phone, location: '', links: [], summary: lines.slice(2, 4).join(' ') },
        experience: [{ title: 'Imported role', company: 'Imported company', start: '', end: '', current: false, bullets: lines.slice(4, 8) }],
        education: [],
        projects: [],
        skills: [],
        certifications: [],
        achievements: [],
        languages: '',
      };
    }
    case 'summary':
      return {
        options: [
          `[Demo] ${r?.basics.headline || 'Professional'} with hands-on experience delivering measurable results, now targeting ${role}.`,
          `[Demo] Detail-focused ${r?.basics.headline || 'professional'} known for clear communication and ownership, seeking ${role}.`,
          `[Demo] ${r?.basics.headline || 'Professional'} who combines technical depth with team leadership, ready for ${role}.`,
        ],
      };
    case 'improve-bullet': {
      const b = s(input.bullet).replace(/^(responsible for|worked on|helped( with)?)\s*/i, '');
      const core = b.charAt(0).toLowerCase() + b.slice(1);
      return { options: [`Delivered ${core}`, `Led ${core}, improving team throughput`, `Built ${core}, reducing turnaround time by [X%]`] };
    }
    case 'tailor': {
      const first = r?.experience[0];
      const bullets = first
        ? first.bullets.slice(0, 2).map((b, i) => ({ entryId: first.id, index: i, text: `${b.replace(/\.$/, '')}, aligned with ${role} requirements.`, reason: 'Uses the wording of the job description.' }))
        : [];
      return {
        headline: `${role}`,
        summary: `[Demo] ${r?.basics.summary?.split('.')[0] ?? 'Experienced professional'}. Focused on the priorities of ${role} at ${company}.`,
        bullets,
        skills: (r?.skills ?? []).map((g) => ({ id: g.id, items: g.items.split(',').map((x) => x.trim()).reverse().join(', ') })),
        missingKeywords: ['GraphQL', 'MongoDB', 'System design'],
        note: '[Demo] Good overlap on core skills; the main gap is the missing keywords listed.',
      };
    }
    case 'cover-letter':
      return {
        letter: `Dear Hiring Manager,\n\n[Demo letter] I am applying for ${role} at ${company}. My recent work maps closely to what this role needs.\n\n${r?.experience[0]?.bullets[0] ?? 'In my current role I have delivered measurable results.'}\n\nI would welcome a conversation about how I can contribute to ${company}.\n\nSincerely,\n${name}`,
      };
    case 'interview-questions': {
      const cats = ['HR & behavioural', 'HR & behavioural', 'HR & behavioural', 'Role & technical', 'Role & technical', 'Role & technical', 'Role & technical', 'From your resume', 'From your resume', 'From your resume', 'Company & motivation', 'Company & motivation'];
      const qs = [
        'Tell me about yourself.',
        'Describe a time you disagreed with a teammate. What happened?',
        'What is your biggest weakness?',
        `What does a typical day look like for ${role}?`,
        'How would you debug a slow API in production?',
        'How do you make sure your work is reliable?',
        'Explain a technical decision you made and its trade-offs.',
        `Walk me through your most recent role${r?.experience[0] ? ` at ${r.experience[0].company}` : ''}.`,
        'Which achievement on your resume are you proudest of, and why?',
        'Why are you looking for a change now?',
        `Why do you want to work at ${company}?`,
        'Where do you see yourself in three years?',
      ];
      return {
        questions: qs.map((question, i) => ({
          category: cats[i],
          question,
          why: '[Demo] Checks clarity, relevance and self-awareness.',
          howToAnswer: 'Use Situation, Task, Action, Result. Keep it under two minutes.',
          sampleAnswer: `[Demo] ${r?.experience[0]?.bullets[0] ?? 'Start with your current role, then one result, then why this job.'}`,
        })),
      };
    }
    case 'mock-question': {
      const asked = Array.isArray(input.asked) ? input.asked.length : 0;
      const qs = ['Tell me about yourself and what brings you to this role.', 'Describe a project you are proud of.', 'How do you handle tight deadlines?', `Why ${company}?`];
      return { question: qs[asked % qs.length] };
    }
    case 'mock-feedback': {
      const len = s(input.answer).trim().split(/\s+/).length;
      const asked = Array.isArray(input.asked) ? input.asked.length : 0;
      const qs = ['Describe a project you are proud of.', 'How do you handle tight deadlines?', `Why ${company}?`, 'What questions do you have for us?'];
      return {
        score: len < 15 ? 3 : len < 60 ? 6 : 8,
        strengths: len < 15 ? [] : ['[Demo] Clear opening that answers the question directly.'],
        improvements: ['[Demo] Add one specific result with a number.', '[Demo] Close by linking back to the role.'],
        betterAnswer: `[Demo] ${s(input.answer).trim().slice(0, 200)} In that work I delivered [your example], which is why this role is a strong fit.`,
        nextQuestion: qs[asked % qs.length],
      };
    }
    case 'company-brief':
      return {
        overview: `[Demo] ${company} is the company you are interviewing with. This demo text stands in for a real briefing.`,
        whatTheyDo: ['[Demo] Core product or service', '[Demo] Main customers and markets'],
        cultureAndValues: ['[Demo] Ownership', '[Demo] Customer focus'],
        talkingPoints: [`[Demo] Link your experience to ${company}'s main product.`],
        questionsToAsk: ['What does success look like in the first 90 days?', 'How is the team structured?'],
        thingsToVerify: ['Recent news and funding', 'Team size and office location'],
      };
    case 'job-kit':
      return {
        linkedinHeadline: [`[Demo] ${r?.basics.headline || role} | Open to ${role}`, `[Demo] ${role} | Delivery-focused`, `[Demo] ${role} | Team player`],
        linkedinAbout: `[Demo] I am ${name}. ${r?.basics.summary ?? ''}`,
        naukriHeadline: [`[Demo] ${role} with relevant experience`, `[Demo] ${r?.basics.headline || role}`, `[Demo] ${role} | Immediate joiner`],
        referralMessage: `[Demo] Hi [Name], I am applying for ${role} at ${company} and would value a referral.`,
        coldEmail: { subject: `[Demo] ${role} application – ${name}`, body: `[Demo] Hello, I am interested in ${role} at ${company}.` },
      };
  }
  return {};
}
