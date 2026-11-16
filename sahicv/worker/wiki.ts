// Looks up a short, citable company description on Wikipedia so the company
// briefing is grounded in a real source instead of the model's memory alone.

export interface CompanyRef {
  title: string;
  extract: string;
  url: string;
}

const UA = { 'user-agent': 'SahiCV/1.0 (resume builder; company briefing)', accept: 'application/json' };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function companyReference(company: string): Promise<CompanyRef | null> {
  const q = encodeURIComponent(`${company} company`);
  const search = await getJson<{ query?: { search?: { title: string }[] } }>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json&origin=*`,
  );
  const hits = search?.query?.search ?? [];
  const words = company.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  // Only accept a page whose title actually mentions the company name.
  const hit = hits.find((h) => words.some((w) => h.title.toLowerCase().includes(w)));
  if (!hit) return null;
  const page = await getJson<{ type?: string; title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } }>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
  );
  if (!page || page.type === 'disambiguation' || !page.extract || page.extract.length < 80) return null;
  return {
    title: page.title ?? hit.title,
    extract: page.extract.slice(0, 2500),
    url: page.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
  };
}
