import type { ReactNode } from 'react';
import { BRAND, LIMITS, PLANS } from '../../shared/plans.ts';
import { Logo } from '../components/ui.tsx';
import { Link } from '../router.tsx';
import { Footer } from './Landing.tsx';

// Policy pages. Payment providers such as Razorpay require these to be public
// before they activate an account. Review them, and replace the contact details
// in shared/plans.ts, before going live.

const UPDATED = '15 November 2026';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="landing">
      <header className="lnav">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>
        <Link href="/app/resume" className="btn btn-primary btn-md">
          <span>Build my resume</span>
        </Link>
      </header>
      <article className="wrap wrap-narrow legal">
        <h1>{title}</h1>
        <p className="muted small">Last updated: {UPDATED}</p>
        {children}
      </article>
      <Footer />
    </div>
  );
}

const mail = <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>;

export function Privacy() {
  return (
    <Shell title="Privacy policy">
      <p>
        {BRAND.name} is a resume builder with optional AI tools. This page explains, in plain language, what information we handle and why. We collect as little as we can.
      </p>
      <h2>What stays on your device</h2>
      <p>
        Your resumes, job descriptions, cover letters, interview practice and tracker are saved in your own browser's storage. We do not have accounts, and we do not keep a copy of
        this information on our servers. Clearing your browser data, or using a different browser or device, removes or hides it. Use the Backup download to keep your own copy.
      </p>
      <h2>What is sent when you use an AI feature</h2>
      <p>
        When you click an AI feature, the text needed for that request (for example your resume, the job description, or an interview answer) is sent to our server and passed to a
        third-party AI model provider to generate the result. We do not store this text after the response is returned. AI providers process it under their own terms, which may
        include temporary retention for safety and abuse monitoring. Please do not include information you would not put on a resume, such as identity numbers or bank details.
      </p>
      <h2>Payments</h2>
      <p>
        Payments are handled by Razorpay. We never see or store your card, UPI or bank details. Razorpay shares with us the payment ID, amount and status so that we can activate
        your pass and handle refunds. Razorpay's own privacy policy applies to the payment itself.
      </p>
      <h2>Usage limits</h2>
      <p>
        To apply the daily limit on free AI actions, we store a one-way scrambled form of your network address together with a daily count. It cannot be turned back into your
        address and is not linked to your resume.
      </p>
      <h2>Cookies and tracking</h2>
      <p>We do not use advertising cookies or sell data. The site uses browser storage only to save your work and your pass.</p>
      <h2>Children</h2>
      <p>The service is intended for people aged 16 and over.</p>
      <h2>Your choices</h2>
      <p>
        You can delete your data at any time by clearing this site's data in your browser. For any privacy question, or to ask about a payment record, write to {mail}.
      </p>
      <h2>Changes</h2>
      <p>If we change this policy we will update the date at the top of this page.</p>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Terms of use">
      <p>By using {BRAND.name} you agree to these terms. If you do not agree, please do not use the site.</p>
      <h2>The service</h2>
      <p>
        {BRAND.name} provides a resume builder and optional AI tools for job seekers. The resume builder, resume check, job match score, tracker and all downloads are free. AI
        features are available with a small daily free allowance and without that limit to pass holders.
      </p>
      <h2>Passes</h2>
      <p>
        A pass is a one-time purchase that gives access to the AI features for the stated number of days from the time of payment. Passes do not renew automatically. To keep the
        service reliable for everyone, pass holders are limited to {LIMITS.passPerDay} AI actions a day. Current prices are shown on the pricing section of the home page and include
        any applicable taxes unless stated otherwise.
      </p>
      <h2>AI-generated content</h2>
      <p>
        AI suggestions are produced automatically and can be inaccurate, incomplete or out of date, particularly about companies. You are responsible for checking everything before
        you use it and for making sure your resume and applications are truthful. We do not guarantee interviews, job offers or any particular outcome.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not use the service to create false or misleading documents, to process other people's personal information without their permission, to attempt to disrupt or overload
        the service, or to resell access. We may suspend access that breaks these rules.
      </p>
      <h2>Your content</h2>
      <p>You own the resumes and other content you create. We claim no rights over it.</p>
      <h2>Availability and liability</h2>
      <p>
        The service is provided "as is". We work to keep it available but do not promise uninterrupted access. To the extent permitted by law, our total liability for any claim
        relating to the service is limited to the amount you paid us in the three months before the claim.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: {mail}.</p>
    </Shell>
  );
}

export function Refunds() {
  return (
    <Shell title="Refund and cancellation policy">
      <h2>Refunds</h2>
      <p>
        If you are not satisfied with a pass, write to {mail} within 3 days of purchase with your Razorpay payment ID and we will refund the full amount. If a technical problem on
        our side stopped you from using the AI features, we will refund you whenever you report it during the pass period.
      </p>
      <p>Approved refunds are returned to the original payment method. Banks and UPI apps usually take 5 to 7 working days to show the credit.</p>
      <h2>Cancellation</h2>
      <p>
        Passes are one-time payments and never renew automatically, so there is nothing to cancel. Your pass ends on its own after {PLANS.map((p) => p.days).join(', ')} days,
        depending on the pass you chose.
      </p>
      <h2>Delivery</h2>
      <p>{BRAND.name} is a digital service. Your pass is activated in your browser immediately after a successful payment; nothing is shipped.</p>
      <h2>Payment went through but the pass did not activate?</h2>
      <p>
        Open the pricing window, choose "Restore your pass" and enter the payment ID from your Razorpay receipt. If that does not work, email {mail} and we will sort it out.
      </p>
    </Shell>
  );
}

export function Contact() {
  return (
    <Shell title="Contact us">
      <p>We are a small team and read every message.</p>
      <h2>Email</h2>
      <p>{mail}</p>
      <p>We usually reply within one working day. For anything about a payment, include your Razorpay payment ID (it starts with "pay_").</p>
      <h2>Operated by</h2>
      <p>
        {BRAND.legalName}
        <br />
        {BRAND.city}
      </p>
    </Shell>
  );
}
