import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  Bars3Icon,
  BriefcaseIcon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  CpuChipIcon,
  DocumentMagnifyingGlassIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import logo from '../assets/Invenia India Logo.png';
import './PublicWebsiteNew.css';

const capabilityCards = [
  {
    icon: DocumentMagnifyingGlassIcon,
    number: '01',
    title: 'Evidence-grounded CV matching',
    copy: 'Every profile is compared with the exact job requirements, responsibilities, skills, and experience evidence.',
    accent: 'coral',
  },
  {
    icon: CpuChipIcon,
    number: '02',
    title: 'Adaptive assessments',
    copy: 'Create role-aware MCQs, coding challenges, and conversational interview questions for every hiring session.',
    accent: 'blue',
  },
  {
    icon: VideoCameraIcon,
    number: '03',
    title: 'Interview intelligence',
    copy: 'Connect consent, readiness checks, recording, transcript, verification photo, and answer-level analysis.',
    accent: 'mint',
  },
  {
    icon: ChartBarSquareIcon,
    number: '04',
    title: 'Decision workspace',
    copy: 'Compare candidates job by job with transparent signals, validation points, stage results, and recordings.',
    accent: 'gold',
  },
];

const workflow = [
  ['Define', 'Create the role and choose only the assessment stages that matter.'],
  ['Discover', 'Candidates find the role, review every detail, and submit their real CV.'],
  ['Validate', 'Invenia evaluates job-specific evidence before recruiter approval.'],
  ['Assess', 'Approved candidates complete configured tests and a secure interview.'],
  ['Decide', 'Recruiters compare the complete evidence trail in one workspace.'],
];

function ProductVisual() {
  return (
    <div className="public-product-visual" aria-label="Invenia AI recruiter decision workspace preview">
      <div className="public-orbit public-orbit-one" />
      <div className="public-orbit public-orbit-two" />
      <div className="public-window">
        <div className="public-window-topbar">
          <div className="public-window-brand"><span>IN</span> Invenia workspace</div>
          <div className="public-window-dots"><i /><i /><i /></div>
        </div>
        <div className="public-window-body">
          <aside className="public-window-sidebar">
            <div className="public-sidebar-mark">I</div>
            {[0, 1, 2, 3].map((item) => <i key={item} className={item === 1 ? 'active' : ''} />)}
          </aside>
          <div className="public-window-content">
            <div className="public-window-heading">
              <div><small>ROLE INTELLIGENCE</small><strong>Senior Product Engineer</strong></div>
              <span>12 candidates</span>
            </div>
            <div className="public-metric-row">
              <div><small>Evidence match</small><strong>87%</strong><em className="public-up">+8.4</em></div>
              <div><small>Assessments</small><strong>9</strong><em>complete</em></div>
              <div><small>Interviews</small><strong>6</strong><em>reviewable</em></div>
            </div>
            <div className="public-candidate-list">
              <div className="public-list-label"><span>Candidate evidence</span><span>Role fit</span></div>
              {[
                ['AM', 'Aarav Mehta', 'Product systems', 92],
                ['SK', 'Sara Khan', 'Platform delivery', 86],
                ['RD', 'Rohan Das', 'Data products', 78],
              ].map(([initials, name, role, score], index) => (
                <div className="public-candidate-row" key={name}>
                  <div className={'public-avatar avatar-' + index}>{initials}</div>
                  <div><strong>{name}</strong><small>{role}</small></div>
                  <div className="public-score-line"><i style={{ width: score + '%' }} /></div>
                  <b>{score}%</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="public-float-card public-float-left">
        <SparklesIcon />
        <div><small>Invenia analysis</small><strong>3 strong signals</strong></div>
      </div>
      <div className="public-float-card public-float-right">
        <ShieldCheckIcon />
        <div><small>Evidence status</small><strong>Validated</strong></div>
      </div>
    </div>
  );
}

export default function PublicWebsite() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const nodes = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="public-site">
      <header className="public-header">
        <a className="public-logo" href="#top" aria-label="Invenia AI home">
          <img src={logo} alt="" />
          <span>Invenia <b>AI</b></span>
        </a>
        <nav className={menuOpen ? 'public-nav is-open' : 'public-nav'} aria-label="Main navigation">
          <a href="#platform" onClick={closeMenu}>Platform</a>
          <a href="#workflow" onClick={closeMenu}>How it works</a>
          <a href="#intelligence" onClick={closeMenu}>Intelligence</a>
          <a href="#security" onClick={closeMenu}>Trust</a>
          <Link className="public-mobile-login" to="/login/recruiter">Recruiter login</Link>
          <Link className="public-mobile-start" to="/login/candidate">Get started</Link>
        </nav>
        <div className="public-header-actions">
          <Link className="public-text-link" to="/login/recruiter">Recruiter login</Link>
          <Link className="public-button public-button-small" to="/login/candidate">Get started <ArrowRightIcon /></Link>
        </div>
        <button className="public-menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation">
          {menuOpen ? <XMarkIcon /> : <Bars3Icon />}
        </button>
      </header>

      <main id="top">
        <section className="public-hero">
          <div className="public-hero-grid" />
          <div className="public-hero-copy" data-reveal>
            <div className="public-eyebrow"><i /> Evidence-led talent intelligence</div>
            <h1>Every hiring signal.<br /><em>One clear decision.</em></h1>
            <p>Invenia AI turns CV evidence, role-specific assessments, and recorded interviews into a transparent hiring story recruiters can trust and candidates can understand.</p>
            <div className="public-hero-actions">
              <Link className="public-button" to="/login/candidate">Explore as candidate <ArrowRightIcon /></Link>
              <Link className="public-button public-button-secondary" to="/login/recruiter">Open recruiter workspace</Link>
            </div>
            <div className="public-hero-proof">
              <span><CheckCircleIcon /> Job-specific evidence</span>
              <span><CheckCircleIcon /> Configurable assessments</span>
              <span><CheckCircleIcon /> Human-led decisions</span>
            </div>
          </div>
          <div className="public-hero-visual" data-reveal><ProductVisual /></div>
        </section>

        <section className="public-signal-strip" aria-label="Platform highlights">
          <div><strong>05</strong><span>connected evidence layers</span></div>
          <div><strong>03</strong><span>adaptive interview turns</span></div>
          <div><strong>01</strong><span>complete decision workspace</span></div>
          <p>CV <i /> Assessment <i /> Interview <i /> Decision</p>
        </section>

        <section className="public-section public-capabilities" id="platform">
          <div className="public-section-heading" data-reveal>
            <div><span className="public-kicker">The platform</span><h2>Designed around evidence,<br />not hiring noise.</h2></div>
            <p>From the first CV scan to the final interview review, every signal stays connected to the role that created it.</p>
          </div>
          <div className="public-card-grid">
            {capabilityCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className={'public-capability-card public-card-' + card.accent} key={card.number} data-reveal>
                  <div className="public-card-top"><span>{card.number}</span><Icon /></div>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                  <i className="public-card-line" />
                </article>
              );
            })}
          </div>
        </section>

        <section className="public-section public-workflow" id="workflow">
          <div className="public-workflow-intro" data-reveal>
            <span className="public-kicker public-kicker-light">One connected workflow</span>
            <h2>From open role to<br /><em>confident decision.</em></h2>
            <p>No disconnected spreadsheets. No hidden score. No lost interview context.</p>
            <Link to="/login/recruiter">See the recruiter experience <ArrowRightIcon /></Link>
          </div>
          <div className="public-workflow-list">
            {workflow.map(([title, copy], index) => (
              <article key={title} data-reveal>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><h3>{title}</h3><p>{copy}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section public-intelligence" id="intelligence">
          <div className="public-intelligence-panel" data-reveal>
            <div className="public-analysis-card">
              <div className="public-analysis-head"><span>CV evidence match</span><b>86%</b></div>
              <div className="public-analysis-ring"><strong>86</strong><span>role fit</span></div>
              <div className="public-analysis-bars">
                {[
                  ['Requirement evidence', 91, '50%'],
                  ['Skill and tool coverage', 84, '20%'],
                  ['Experience alignment', 78, '20%'],
                  ['Responsibility readiness', 88, '10%'],
                ].map(([label, value, weight]) => <div key={label}><p><span>{label}</span><b>{weight} weight</b></p><i><em style={{ width: value + '%' }} /></i></div>)}
              </div>
            </div>
            <div className="public-evidence-note"><ShieldCheckIcon /><div><small>Validated evidence</small><strong>?Led end-to-end platform migration??</strong></div></div>
          </div>
          <div className="public-intelligence-copy" data-reveal>
            <span className="public-kicker">Transparent by design</span>
            <h2>A score should explain itself.</h2>
            <p>Invenia combines semantic analysis with deterministic calculations. Every match is broken into visible components, supported by candidate evidence, and paired with confidence and validation points.</p>
            <ul>
              <li><CheckCircleIcon /> Requirement-by-requirement evidence status</li>
              <li><CheckCircleIcon /> Visible weighting and score contribution</li>
              <li><CheckCircleIcon /> Strong signals, gaps, and follow-up points</li>
              <li><CheckCircleIcon /> Recruiter remains the decision-maker</li>
            </ul>
          </div>
        </section>

        <section className="public-section public-audiences">
          <article className="public-audience-candidate" data-reveal>
            <div className="public-audience-icon"><BriefcaseIcon /></div>
            <span>For candidates</span>
            <h2>Show more than<br />a resume.</h2>
            <p>Discover matching roles, understand your evidence, complete guided assessments, and interview with clarity.</p>
            <Link to="/login/candidate">Enter candidate portal <ArrowRightIcon /></Link>
          </article>
          <article className="public-audience-recruiter" data-reveal>
            <div className="public-audience-icon"><UserGroupIcon /></div>
            <span>For hiring teams</span>
            <h2>See the whole<br />candidate story.</h2>
            <p>Build roles, configure rounds, compare applicants, review recordings, and decide from one evidence trail.</p>
            <Link to="/login/recruiter">Enter recruiter portal <ArrowRightIcon /></Link>
          </article>
        </section>

        <section className="public-section public-security" id="security">
          <div data-reveal>
            <span className="public-kicker">Trust at every stage</span>
            <h2>Structured for serious hiring.</h2>
          </div>
          <div className="public-trust-grid">
            {[
              [ShieldCheckIcon, 'Evidence before inference', 'Generated findings are grounded against submitted CV and profile evidence.'],
              [VideoCameraIcon, 'Consent-led interview capture', 'Candidates complete device checks and review what is captured before recording.'],
              [ChartBarSquareIcon, 'Explainable outcomes', 'Scores, weights, confidence, gaps, and validation points remain visible.'],
              [UserGroupIcon, 'Human-in-the-loop', 'Analysis supports recruiter judgment; it does not make the hiring decision.'],
            ].map(([Icon, title, copy]) => <article key={title} data-reveal><Icon /><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </section>

        <section className="public-final-cta" data-reveal>
          <div className="public-cta-glow" />
          <span>Ready when you are</span>
          <h2>Build a clearer path<br />from talent to decision.</h2>
          <p>Choose your workspace and experience the complete Invenia AI hiring journey.</p>
          <div><Link className="public-button public-button-light" to="/login/candidate">I am a candidate <ArrowRightIcon /></Link><Link className="public-button public-button-outline" to="/login/recruiter">I am a recruiter</Link></div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-logo public-logo-footer"><img src={logo} alt="" /><span>Invenia <b>AI</b></span></div>
        <p>Evidence-led hiring intelligence for candidates and teams.</p>
        <div><a href="#platform">Platform</a><a href="#workflow">Workflow</a><Link to="/login/candidate">Candidate login</Link><Link to="/login/recruiter">Recruiter login</Link></div>
        <small>? 2026 Invenia AI. Human decisions, better evidence.</small>
      </footer>
    </div>
  );
}
