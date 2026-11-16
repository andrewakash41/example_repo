// Vocabulary used by the job-description matcher. Lower-case, canonical names.
// Multi-word phrases are matched as phrases. Keep additions lower-case.

export const SKILLS: string[] = `
javascript, typescript, python, java, kotlin, swift, c++, c#, .net, php, ruby, rust, scala, dart, perl, matlab, bash, shell scripting, sql, pl/sql, t-sql, html, css, sass, graphql, solidity,
react, react native, angular, vue, next.js, nuxt, svelte, redux, jquery, bootstrap, tailwind css, node.js, express, nestjs, django, flask, fastapi, spring boot, spring framework, hibernate, laravel, ruby on rails, asp.net, flutter, android, ios, xamarin, unity,
rest apis, microservices, grpc, websockets, oauth, jwt, api design, system design, design patterns, object-oriented programming, data structures and algorithms, distributed systems, event-driven architecture, multithreading, unit testing, test automation, tdd, code review, agile, scrum, kanban, sdlc, devops, ci/cd, git, github, gitlab, bitbucket, jira, confluence,
aws, azure, google cloud, ec2, s3, lambda, cloudformation, terraform, ansible, docker, kubernetes, helm, jenkins, github actions, linux, unix, nginx, apache, serverless, cloud migration, networking, tcp/ip, dns, load balancing, monitoring, prometheus, grafana, datadog, splunk, elk, site reliability,
mysql, postgresql, oracle, sql server, mongodb, redis, cassandra, dynamodb, elasticsearch, snowflake, bigquery, redshift, databricks, kafka, rabbitmq, airflow, spark, hadoop, hive, etl, data pipelines, data warehousing, data modeling, dbt,
machine learning, deep learning, artificial intelligence, natural language processing, computer vision, generative ai, llm, prompt engineering, rag, tensorflow, pytorch, scikit-learn, keras, pandas, numpy, opencv, hugging face, langchain, mlops, statistics, statistical modeling, a/b testing, forecasting, time series, regression, classification, clustering, recommendation systems,
data analysis, data analytics, data visualization, business intelligence, power bi, tableau, looker, qlik, excel, advanced excel, vlookup, pivot tables, macros, vba, google sheets, google analytics, sas, spss, r programming, reporting, dashboards, mis, mis reporting, data entry, data cleaning, data governance,
selenium, cypress, playwright, appium, junit, testng, postman, jmeter, manual testing, automation testing, api testing, performance testing, regression testing, qa, quality assurance, test cases, bug tracking,
cybersecurity, information security, penetration testing, vulnerability assessment, siem, soc, iso 27001, firewalls, identity and access management, network security, incident response, compliance, risk management, gdpr, audit,
sap, sap fico, sap mm, sap sd, sap abap, sap hana, oracle erp, erp, salesforce, crm, hubspot, zoho, servicenow, workday, tally, tally prime, quickbooks, ms office, powerpoint, word, outlook, sharepoint, power automate, rpa, uipath,
accounting, bookkeeping, accounts payable, accounts receivable, general ledger, reconciliation, bank reconciliation, financial reporting, financial analysis, financial modeling, budgeting, variance analysis, taxation, gst, tds, income tax, payroll, invoicing, auditing, statutory audit, internal audit, ifrs, ind as, gaap, valuation, equity research, investment banking, credit analysis, underwriting, treasury, cost accounting, working capital, kyc, aml, banking operations, mutual funds, wealth management, insurance,
digital marketing, seo, sem, ppc, google ads, meta ads, facebook ads, social media marketing, content marketing, email marketing, marketing automation, copywriting, content writing, brand management, campaign management, market research, lead generation, performance marketing, influencer marketing, affiliate marketing, conversion rate optimization, public relations, event management, product marketing, go-to-market,
sales, b2b sales, b2c sales, inside sales, field sales, business development, account management, key account management, client relationship management, customer success, negotiation, cold calling, pipeline management, upselling, channel sales, retail sales, pre-sales, tendering, revenue growth,
product management, product strategy, roadmap, user research, user stories, wireframing, prototyping, figma, sketch, adobe xd, photoshop, illustrator, indesign, after effects, premiere pro, canva, ui design, ux design, interaction design, design systems, usability testing, graphic design, video editing, motion graphics,
project management, program management, pmp, prince2, stakeholder management, vendor management, resource planning, change management, process improvement, lean, six sigma, kaizen, operations management, supply chain, logistics, procurement, inventory management, warehouse management, demand planning, production planning, quality control, quality management, iso 9001, autocad, solidworks, catia, ansys, plc, scada, maintenance, safety, ehs,
recruitment, talent acquisition, sourcing, screening, onboarding, employee engagement, performance management, compensation and benefits, hr operations, hris, labour laws, training and development, learning and development, employee relations, payroll processing, statutory compliance,
customer service, customer support, technical support, help desk, call center, bpo, ticketing, zendesk, freshdesk, escalation management, sla, csat, nps,
communication, leadership, team management, team leadership, mentoring, problem solving, analytical skills, critical thinking, time management, collaboration, cross-functional, presentation skills, stakeholder communication, decision making, adaptability, attention to detail, teaching, curriculum development, lesson planning, classroom management, research, technical writing, documentation, legal research, drafting, contract management, litigation
`
  .split(/[,\n]/)
  .map((s) => s.trim())
  .filter(Boolean);

/** Different spellings that mean the same skill. Left side is normalised to the right side. */
export const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  golang: 'go',
  reactjs: 'react',
  'react.js': 'react',
  'vue.js': 'vue',
  vuejs: 'vue',
  angularjs: 'angular',
  nodejs: 'node.js',
  nextjs: 'next.js',
  'express.js': 'express',
  expressjs: 'express',
  springboot: 'spring boot',
  dotnet: '.net',
  postgres: 'postgresql',
  mongo: 'mongodb',
  k8s: 'kubernetes',
  'amazon web services': 'aws',
  gcp: 'google cloud',
  'google cloud platform': 'google cloud',
  'microsoft azure': 'azure',
  'ms excel': 'excel',
  'microsoft excel': 'excel',
  'ms office': 'ms office',
  'microsoft office': 'ms office',
  powerbi: 'power bi',
  'rest api': 'rest apis',
  'restful apis': 'rest apis',
  'restful api': 'rest apis',
  restful: 'rest apis',
  api: 'rest apis',
  apis: 'rest apis',
  ml: 'machine learning',
  ai: 'artificial intelligence',
  nlp: 'natural language processing',
  genai: 'generative ai',
  'gen ai': 'generative ai',
  llms: 'llm',
  'large language models': 'llm',
  oop: 'object-oriented programming',
  oops: 'object-oriented programming',
  'object oriented programming': 'object-oriented programming',
  dsa: 'data structures and algorithms',
  'data structures': 'data structures and algorithms',
  algorithms: 'data structures and algorithms',
  'ci cd': 'ci/cd',
  cicd: 'ci/cd',
  'continuous integration': 'ci/cd',
  'ab testing': 'a/b testing',
  'search engine optimization': 'seo',
  'pay per click': 'ppc',
  'business intelligence': 'business intelligence',
  bi: 'business intelligence',
  'quality assurance': 'qa',
  'user experience': 'ux design',
  ux: 'ux design',
  'user interface': 'ui design',
  ui: 'ui design',
  'ui/ux': 'ux design',
  'talent acquisition': 'recruitment',
  recruiting: 'recruitment',
  hiring: 'recruitment',
  'l&d': 'learning and development',
  bd: 'business development',
  'stakeholder engagement': 'stakeholder management',
  'problem-solving': 'problem solving',
  'team player': 'collaboration',
  teamwork: 'collaboration',
  'communication skills': 'communication',
  'goods and services tax': 'gst',
  'tally erp': 'tally',
  'tally erp 9': 'tally',
  'pivot table': 'pivot tables',
};

/** Skills that are also ordinary words; only counted when written exactly like this. */
export const CASE_SENSITIVE: Record<string, string> = {
  Go: 'go',
  R: 'r programming',
  C: 'c',
  Word: 'word',
  Express: 'express',
  Swift: 'swift',
  Rust: 'rust',
  Dart: 'dart',
  Lean: 'lean',
  Unity: 'unity',
  Flask: 'flask',
  Sketch: 'sketch',
  Hive: 'hive',
  Spark: 'spark',
  Helm: 'helm',
  Research: 'research',
  Safety: 'safety',
  Maintenance: 'maintenance',
  Sales: 'sales',
};

/** Soft skills count for less than hard skills in the match score. */
export const SOFT_SKILLS = new Set([
  'communication',
  'leadership',
  'team management',
  'team leadership',
  'mentoring',
  'problem solving',
  'analytical skills',
  'critical thinking',
  'time management',
  'collaboration',
  'cross-functional',
  'presentation skills',
  'stakeholder communication',
  'decision making',
  'adaptability',
  'attention to detail',
]);

export const STOPWORDS = new Set(
  `a an the and or but if then else for to of in on at by with from as is are was were be been being this that these those it its
  you your we our us they their them he she his her will would can could should may might must shall do does did done have has had
  not no nor so such than too very just also into over under about above below between through during before after again more most
  other some any each every all both few own same per via etc eg ie who whom which what when where why how
  experience experienced years year month months work working works worked job role roles position candidate candidates applicant
  ability able strong good excellent great proven track record required requirements requirement preferred plus bonus nice must
  including include includes responsible responsibilities responsibility duties skills skill knowledge understanding familiarity familiar
  team teams company companies organization organisation business client clients customer customers environment culture
  looking seeking join opportunity opportunities apply application equal employer benefits salary ctc lpa location hybrid remote onsite
  full time part fulltime internship intern immediate joiner notice period day days week weeks high highly well best new using use used
  across within along ensure ensuring provide providing support supporting help helping make making take taking need needs needed
  minimum maximum least bachelor bachelors master masters degree diploma graduate graduation qualification qualifications education
  related relevant various multiple different key main primary etc. e.g. i.e. like one two three four five six seven eight nine ten
  description overview summary about us who what why we're you'll you're it's hands on hands-on level senior junior lead mid entry
  develop developing development build building built design designing create creating manage managing management maintain maintaining
  drive driving deliver delivering perform performing implement implementing implementation identify identifying improve improving
  participate collaborate collaborating communicate coordinate coordinating prepare preparing conduct conducting handle handling
  understand follow following based time timely quality effective effectively efficient efficiently successful successfully
  day-to-day daily weekly monthly basis internal external end users user people person someone thrive passionate self motivated
  fast paced fast-paced dynamic growth growing world class leading india indian global bengaluru bangalore mumbai delhi pune hyderabad
  chennai gurgaon gurugram noida kolkata ahmedabad`
    .split(/\s+/)
    .filter(Boolean),
);
