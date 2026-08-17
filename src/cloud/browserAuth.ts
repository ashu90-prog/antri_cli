import http from 'http';
import { exec } from 'child_process';
import chalk from 'chalk';
import { AuthManager, UserAccount } from './auth.js';

export class BrowserAuthServer {
  /**
   * Spawns a temporary local server and opens the browser for Google/Email login
   */
  public static async startLoginFlow(): Promise<UserAccount | null> {
    return new Promise((resolve) => {
      let server: http.Server | null = null;
      let port = 54321;

      server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${port}`);

        // 1. Serve Minimalist Cream-White Web Login UI
        if (url.pathname === '/' || url.pathname === '/login') {
          const { FirestoreSyncManager } = await import('./firestore.js');
          const syncCfg = FirestoreSyncManager.getSyncConfig();
          const projectId = syncCfg.projectId || 'antri-agentic-hackathon';
          const apiKey = syncCfg.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.renderLoginPage(port, projectId, apiKey));
          return;
        }

        // 2. Google OAuth Popup Callback Endpoint
        if (url.pathname === '/api/google/callback') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html><html><body style="background:#fcfbf9;font-family:system-ui;text-align:center;padding:40px;">
            <p>Connecting your Google Account to ANTRI Code...</p>
            <script>
              const hash = window.location.hash.substring(1);
              const params = new URLSearchParams(hash);
              const idToken = params.get('id_token') || '';
              const accessToken = params.get('access_token') || '';

              function parseJwt(token) {
                try {
                  var base64Url = token.split('.')[1];
                  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                  var jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                  return JSON.parse(jsonPayload);
                } catch(e) { return null; }
              }

              async function finish() {
                let email = '';
                if (idToken) {
                  const payload = parseJwt(idToken);
                  if (payload && payload.email) email = payload.email;
                }
                if (!email && accessToken) {
                  try {
                    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                      headers: { Authorization: 'Bearer ' + accessToken }
                    });
                    const d = await r.json();
                    if (d.email) email = d.email;
                  } catch(e) {}
                }

                if (email) {
                  await fetch('/api/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, provider: 'google', googleToken: idToken || accessToken })
                  });
                  if (window.opener) {
                    window.opener.postMessage({ type: 'ANTRI_AUTH_SUCCESS', email: email }, '*');
                    window.close();
                  } else {
                    window.location.href = '/login';
                  }
                } else {
                  document.body.innerHTML = '<p style="color:#dc2626;">Google sign-in completed. Returning to CLI...</p>';
                }
              }
              finish();
            </script>
          </body></html>`);
          return;
        }

        // 3. Auth Callback Endpoint
        if (url.pathname === '/api/callback' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const email = (data.email || '').trim().toLowerCase();
              const provider = data.provider === 'google' ? 'google' : 'email';

              if (!email || !email.includes('@')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Valid email is required.' }));
                return;
              }

              let authResult;
              if (provider === 'google') {
                authResult = await AuthManager.loginWithGoogle(email, data.googleToken);
              } else {
                authResult = await AuthManager.loginWithPassword(email, data.password);
              }

              if (authResult.success && authResult.user) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, user: authResult.user }));

                // Clean up server after responding
                setTimeout(() => {
                  if (server) server.close();
                  resolve(authResult.user || null);
                }, 800);
              } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: authResult.error || 'Login failed.' }));
              }
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        res.writeHead(404);
        res.end('Not Found');
      });

      server.listen(port, () => {
        const loginUrl = `http://localhost:${port}/login`;
        console.log();
        console.log(chalk.bold.hex('#c084fc')('🌐 ANTRI WEB AUTHENTICATION'));
        console.log(chalk.cyan(`Opening browser for authentication: ${chalk.underline.white(loginUrl)}`));
        console.log(chalk.gray('Waiting for sign-in in your browser...'));
        console.log();

        // Open in default browser
        this.openBrowser(loginUrl);
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          port += 1;
          server?.listen(port);
        } else {
          console.error(chalk.red(`Failed to start auth server: ${err.message}`));
          resolve(null);
        }
      });
    });
  }

  private static openBrowser(targetUrl: string): void {
    const platform = process.platform;
    if (platform === 'win32') {
      exec(`cmd.exe /c start "" "${targetUrl}"`, (err) => {
        if (err) {
          exec(`powershell -NoProfile -Command "Start-Process '${targetUrl}'"`);
        }
      });
    } else if (platform === 'darwin') {
      exec(`open "${targetUrl}"`);
    } else {
      exec(`xdg-open "${targetUrl}"`);
    }
  }

  private static renderLoginPage(port: number, projectId: string = 'antri-agentic-hackathon', apiKey: string = ''): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ANTRI Code - Secure Authentication</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <style>
    :root {
      --bg: #fcfbf9;
      --card-bg: #ffffff;
      --border: #e6e0d4;
      --text: #1c1917;
      --subtext: #78716c;
      --subtle: #f7f4ee;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .auth-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      padding: 36px 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
      text-align: center;
    }
    .brand-mark {
      width: 48px;
      height: 48px;
      background: var(--text);
      color: #fff;
      border-radius: 12px;
      font-size: 22px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    p.subtitle {
      font-size: 13px;
      color: var(--subtext);
      margin-bottom: 22px;
    }
    .google-container {
      margin-bottom: 6px;
      display: flex;
      justify-content: center;
    }
    .btn-google {
      width: 100%;
      background: var(--subtle);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 14px;
      font-weight: 700;
      padding: 13px 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-google:hover {
      background: #eeeae0;
      border-color: #d6cfbf;
    }
    .divider {
      display: flex;
      align-items: center;
      margin: 20px 0;
      color: #a8a29e;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .divider span { padding: 0 12px; }
    .input-group {
      text-align: left;
      margin-bottom: 14px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 6px;
    }
    input[type="email"], input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      background: #faf8f5;
      color: var(--text);
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="email"]:focus, input[type="password"]:focus {
      border-color: var(--text);
      background: #ffffff;
    }
    .btn-submit {
      width: 100%;
      background: var(--text);
      color: #fff;
      border: none;
      font-size: 14px;
      font-weight: 700;
      padding: 13px;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.15s;
      margin-top: 6px;
    }
    .btn-submit:hover { opacity: 0.92; }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .success-view {
      display: none;
      padding: 20px 0;
    }
    .success-icon {
      width: 48px;
      height: 48px;
      background: #dcfce7;
      color: #15803d;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 800;
      margin-bottom: 14px;
    }
    .status-msg {
      font-size: 12px;
      color: #dc2626;
      margin-top: 12px;
      display: none;
      line-height: 1.4;
    }
    .auth-hint {
      font-size: 11px;
      color: var(--subtext);
      margin-top: 6px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="auth-card">
    <div id="auth-form-container">
      <div class="brand-mark">A</div>
      <h1>ANTRI CODE</h1>
      <p class="subtitle">Secure authentication for terminal and cloud partition</p>

      <!-- Google Sign In via Google Identity Services -->
      <div class="google-container">
        <button class="btn-google" id="google-btn" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span id="google-btn-text">Sign in with Google</span>
        </button>
      </div>

      <div class="divider"><span>OR PASSWORD LOGIN / REGISTER</span></div>

      <form id="auth-form">
        <div class="input-group">
          <label for="email">Account Email</label>
          <input type="email" id="email" placeholder="e.g. user@gmail.com" required autofocus>
        </div>
        <div class="input-group">
          <label for="password">Password</label>
          <input type="password" id="password" placeholder="••••••••" minlength="6" required>
          <p class="auth-hint">New account will automatically register. Existing accounts will verify password.</p>
        </div>
        <button type="submit" class="btn-submit" id="submit-btn">Login / Register & Unlock CLI</button>
        <div class="status-msg" id="status-msg"></div>
      </form>
    </div>

    <div class="success-view" id="success-view">
      <div class="success-icon">✓</div>
      <h1>Authentication Successful!</h1>
      <p class="subtitle" style="margin-top: 8px;" id="success-desc">Your terminal has been authenticated. You can safely close this browser window and return to your CLI.</p>
    </div>
  </div>

  <script>
    function parseJwt(token) {
      try {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
      } catch (e) {
        return null;
      }
    }

    async function authenticate(email, password = '', provider = 'email', googleToken = '') {
      const statusMsg = document.getElementById('status-msg');
      const submitBtn = document.getElementById('submit-btn');
      const googleBtnText = document.getElementById('google-btn-text');

      statusMsg.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerText = 'Verifying credentials...';
      if (provider === 'google') {
        googleBtnText.innerText = 'Linking Google Account...';
      }

      try {
        const res = await fetch('/api/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, provider, googleToken })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('auth-form-container').style.display = 'none';
          document.getElementById('success-view').style.display = 'block';
          document.getElementById('success-desc').innerText = 'Authenticated as ' + email + '. Private Firestore partition is active. Return to your terminal now.';
        } else {
          statusMsg.innerText = data.error || 'Authentication failed.';
          statusMsg.style.color = '#dc2626';
          statusMsg.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.innerText = 'Login / Register & Unlock CLI';
          googleBtnText.innerText = 'Sign in with Google';
        }
      } catch (err) {
        statusMsg.innerText = 'Connection error: ' + err.message;
        statusMsg.style.color = '#dc2626';
        statusMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerText = 'Login / Register & Unlock CLI';
        googleBtnText.innerText = 'Sign in with Google';
      }
    }

    document.getElementById('auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (email && password) {
        authenticate(email, password, 'email');
      }
    });

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'ANTRI_AUTH_SUCCESS') {
        document.getElementById('auth-form-container').style.display = 'none';
        document.getElementById('success-view').style.display = 'block';
        document.getElementById('success-desc').innerText = 'Authenticated with Google as ' + event.data.email + '. Return to your terminal now.';
      }
    });

    function openGooglePopup() {
      const googleBtnText = document.getElementById('google-btn-text');
      googleBtnText.innerText = 'Opening Google...';

      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: '659424855422-e421p0t9b3qg4kff9e47s9a37gcr38l0.apps.googleusercontent.com',
        redirect_uri: window.location.origin + '/api/google/callback',
        response_type: 'token id_token',
        scope: 'openid email profile',
        nonce: Math.random().toString(36).substring(2),
        prompt: 'select_account'
      });

      const width = 500, height = 640;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);
      const popup = window.open(authUrl, 'google_signin_popup', 'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left);

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = authUrl;
      }
    }

    document.getElementById('google-btn').addEventListener('click', () => {
      openGooglePopup();
    });
  </script>
</body>
</html>`;
  }
}
