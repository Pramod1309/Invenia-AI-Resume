import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const FRONTEND_URL = process.env.INVENIA_FRONTEND_URL || 'https://frontend-production-fad4.up.railway.app';
const BACKEND_URL = process.env.INVENIA_BACKEND_URL || 'https://backend-production-359e.up.railway.app';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9223;
const OUT_DIR = join(process.cwd(), 'docs', 'site', 'assets', 'screenshots');

const screenshots = {
  loginSelector: 'login-selector.png',
  candidateLogin: 'candidate-login.png',
  recruiterLogin: 'recruiter-login.png',
  candidateProfile: 'candidate-profile.png',
  candidateApplications: 'candidate-applications.png',
  candidateJobs: 'candidate-jobs.png',
  candidateReport: 'candidate-report.png',
  recruiterJobs: 'recruiter-jobs.png',
  recruiterJobModal: 'recruiter-job-modal.png',
  recruiterCandidateReport: 'recruiter-candidate-report.png',
  recruiterOverview: 'recruiter-overview.png',
  recruiterCandidates: 'recruiter-candidates.png',
  recruiterAnalytics: 'recruiter-analytics.png',
  recruiterJobForm: 'recruiter-job-form.png',
};

const wait = (ms) => delay(ms);

async function retry(fn, attempts = 20, pauseMs = 500) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await wait(pauseMs);
    }
  }
  throw lastError;
}

async function getJson(url) {
  return retry(async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed for ${url}: ${response.status}`);
    }
    return response.json();
  });
}

async function loginToken(email, password, userType) {
  return retry(async () => {
    const body = new URLSearchParams({
      username: email,
      password,
      user_type: userType,
    });
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`Login failed for ${email}: ${response.status}`);
    }
    const data = await response.json();
    return data.access_token;
  });
}

class CdpPage {
  constructor(browserWs) {
    this.browserWs = browserWs;
    this.sessionId = null;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  async init() {
    const target = await this.sendBrowser('Target.createTarget', { url: 'about:blank' });
    const attachment = await this.sendBrowser('Target.attachToTarget', {
      targetId: target.targetId,
      flatten: true,
    });
    this.sessionId = attachment.sessionId;
    await this.sendPage('Page.enable');
    await this.sendPage('Runtime.enable');
    await this.sendPage('DOM.enable');
    await this.sendPage('Network.enable');
    await this.sendPage('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await this.sendPage('Emulation.setEmulatedMedia', { media: 'screen' });
  }

  sendBrowser(method, params = {}) {
    return this._send(method, params);
  }

  sendPage(method, params = {}) {
    return this._send(method, params, this.sessionId);
  }

  _send(method, params = {}, sessionId = null) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    this.browserWs.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  bindEvents() {
    this.browserWs.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message || 'CDP command failed'));
        } else {
          pending.resolve(message.result || {});
        }
        return;
      }

      if (message.method) {
        const key = `${message.sessionId || 'browser'}:${message.method}`;
        const queue = this.events.get(key) || [];
        queue.push(message.params || {});
        this.events.set(key, queue);
      }
    });
  }

  waitFor(method, timeoutMs = 30000) {
    const key = `${this.sessionId}:${method}`;
    const existing = this.events.get(key);
    if (existing && existing.length > 0) {
      return Promise.resolve(existing.shift());
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.browserWs.removeEventListener('message', handler);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);

      const handler = (event) => {
        const message = JSON.parse(event.data);
        if (message.sessionId === this.sessionId && message.method === method) {
          clearTimeout(timer);
          this.browserWs.removeEventListener('message', handler);
          resolve(message.params || {});
        }
      };

      this.browserWs.addEventListener('message', handler);
    });
  }

  async navigate(url) {
    const loadPromise = this.waitFor('Page.loadEventFired');
    await this.sendPage('Page.navigate', { url });
    await loadPromise;
    await wait(1200);
  }

  async evaluate(expression) {
    const result = await this.sendPage('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.result?.value;
  }

  async waitForText(text, timeoutMs = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const body = await this.evaluate('document.body ? document.body.innerText : ""');
      if (body && body.includes(text)) {
        return true;
      }
      await wait(300);
    }
    throw new Error(`Timed out waiting for text: ${text}`);
  }

  async clickByText(text) {
    const encoded = JSON.stringify(text);
    await this.sendPage('Runtime.evaluate', {
      expression: `(() => {
        const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const match = candidates.find((el) => (el.innerText || el.textContent || '').trim().includes(${encoded}));
        if (!match) throw new Error('Could not find clickable element containing: ${text}');
        match.click();
      })()`,
      awaitPromise: true,
    });
    await wait(900);
  }

  async setLocalStorage(key, value) {
    const encodedKey = JSON.stringify(key);
    const encodedValue = JSON.stringify(value);
    await this.sendPage('Runtime.evaluate', {
      expression: `(() => {
        localStorage.setItem(${encodedKey}, ${encodedValue});
      })()`,
      awaitPromise: true,
    });
    await wait(300);
  }

  async clearLocalStorage() {
    await this.sendPage('Runtime.evaluate', {
      expression: '(() => { localStorage.clear(); })()',
      awaitPromise: true,
    });
    await wait(300);
  }

  async capture(fileName, fullPage = false) {
    const capture = await this.sendPage('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: fullPage,
    });
    await writeFile(join(OUT_DIR, fileName), Buffer.from(capture.data, 'base64'));
  }
}

async function openChrome() {
  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--window-size=1600,1000`,
    `--user-data-dir=${join(process.cwd(), '.cache', 'docs-chrome-profile')}`,
    'about:blank',
  ];

  const chrome = spawn(CHROME_PATH, args, { stdio: 'ignore', detached: true });
  chrome.unref();
  return chrome;
}

async function connectBrowser() {
  const version = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  const browserWs = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    browserWs.addEventListener('open', resolve);
    browserWs.addEventListener('error', reject);
  });
  return browserWs;
}

async function prepareCandidateData() {
  const candidateToken = process.env.INVENIA_CANDIDATE_TOKEN || '';
  return { candidateToken };
}

async function prepareRecruiterData() {
  const recruiterToken = process.env.INVENIA_RECRUITER_TOKEN || await loginToken(
    process.env.INVENIA_RECRUITER_EMAIL,
    process.env.INVENIA_RECRUITER_PASSWORD,
    'recruiter',
  );
  return { recruiterToken };
}

async function capturePublicPages(page) {
  await page.navigate(FRONTEND_URL);
  await page.clearLocalStorage();
  await page.waitForText('Choose your login path');
  await page.capture(screenshots.loginSelector, true);

  await page.navigate(`${FRONTEND_URL}/login/candidate`);
  await page.waitForText('Login');
  await page.capture(screenshots.candidateLogin, true);

  await page.navigate(`${FRONTEND_URL}/login/recruiter`);
  await page.waitForText('Login');
  await page.capture(screenshots.recruiterLogin, true);
}

async function captureCandidatePages(page, candidateToken) {
  await page.navigate(FRONTEND_URL);
  await page.setLocalStorage('access_token', candidateToken);
  await page.navigate(`${FRONTEND_URL}/dashboard/candidate?tab=jobs`);
  await page.waitForText('Candidate Dashboard');
  await page.waitForText('Find Your Next Opportunity');
  await wait(2800);
  await page.capture(screenshots.candidateJobs);

  await page.navigate(`${FRONTEND_URL}/dashboard/candidate?tab=profile`);
  await page.waitForText('My Profile');
  await wait(2200);
  await page.capture(screenshots.candidateProfile);

  await page.navigate(`${FRONTEND_URL}/dashboard/candidate?tab=applications`);
  await page.waitForText('Track Your Applications');
  await wait(2200);
  await page.capture(screenshots.candidateApplications);
}

async function captureRecruiterPages(page, recruiterToken) {
  await page.navigate(FRONTEND_URL);
  await page.setLocalStorage('access_token', recruiterToken);
  await page.navigate(`${FRONTEND_URL}/dashboard/recruiter?tab=overview`);
  await page.waitForText('Recruiter Dashboard');
  await page.waitForText('Recruitment Overview');
  await wait(2800);
  await page.capture(screenshots.recruiterOverview);

  await page.navigate(`${FRONTEND_URL}/dashboard/recruiter?tab=jobs`);
  await page.waitForText('Jobs Management');
  await wait(2800);
  await page.capture(screenshots.recruiterJobs);

  await page.navigate(`${FRONTEND_URL}/dashboard/recruiter/jobs/new`);
  await page.waitForText('Create a structured job with smart autofill');
  await wait(1800);
  await page.capture(screenshots.recruiterJobForm);

  await page.navigate(`${FRONTEND_URL}/dashboard/recruiter?tab=candidates`);
  await page.waitForText('Candidates Pipeline');
  await wait(2800);
  await page.capture(screenshots.recruiterCandidates);

  await page.navigate(`${FRONTEND_URL}/dashboard/recruiter?tab=analytics`);
  await page.waitForText('Analytics & Insights');
  await wait(3500);
  await page.capture(screenshots.recruiterAnalytics);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const chrome = await openChrome();
  await retry(async () => getJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`));

  const browserWs = await connectBrowser();
  const page = new CdpPage(browserWs);
  page.bindEvents();
  await page.init();

  const { candidateToken } = await prepareCandidateData();
  const { recruiterToken } = await prepareRecruiterData();

  await capturePublicPages(page);
  if (candidateToken) {
    await captureCandidatePages(page, candidateToken);
  }
  await captureRecruiterPages(page, recruiterToken);

  browserWs.close();
  chrome.kill();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
