const DEFAULT_BASE_URL = 'https://captivateprime.adobe.com';
const TOKEN_STORAGE_KEY = 'alm-access-token';
const TOKEN_EXPIRY_KEY = 'alm-access-token-expiry';
const SESSION_ID_KEY = 'alm-session-id';

const getPlaceholderKey = (obj) => obj?.almAuthUrl
  || obj?.almauthurl
  || obj?.almRuntimeUrl
  || obj?.almruntimeurl
  || null;

const extractPlaceholderValue = (json, key) => {
  const entry = json?.data?.find((row) => row?.Key === key);
  return entry?.Text || null;
};

const getAuthorPlaceholdersJsonUrl = () => {
  const { pathname, origin } = window.location;
  const parts = pathname.split('/content/');
  if (parts.length < 2) return null;
  const siteName = parts[1]?.split('/')?.[0];
  if (!siteName) return null;
  return `${origin}/content/${siteName}/placeholders.json`;
};

const getAuthUrlFromPlaceholders = async () => {
  try {
    const { fetchPlaceholders } = await import('../../scripts/aem.js');
    const placeholders = await fetchPlaceholders();
    const directValue = getPlaceholderKey(placeholders);
    if (directValue) return directValue;
    const fromAuthorJson = () => (
      extractPlaceholderValue(json, 'almAuthUrl')
        || extractPlaceholderValue(json, 'almauthurl')
        || extractPlaceholderValue(json, 'almRuntimeUrl')
        || extractPlaceholderValue(json, 'almruntimeurl')
        || null
    );
    // Author fallback: fetch placeholders.json from content path
    if (window?.location?.origin?.includes('author')) {
      const url = getAuthorPlaceholdersJsonUrl();
      if (url) {
        const resp = await fetch(url);
        if (resp.ok) {
          const json = await resp.json();
          return fromAuthorJson(json);
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

const buildRefreshUrl = (authUrl) => {
  try {
    const u = new URL(authUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts[parts.length - 1] = 'alm-refresh';
      u.pathname = `/${parts.join('/')}`;
      u.search = '';
      return u.href;
    }
  } catch (e) {
    // ignore
  }
  return null;
};

const fetchRefreshToken = async (authUrl) => {
  try {
    const refreshUrl = buildRefreshUrl(authUrl);
    if (!refreshUrl) return null;
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    const url = sessionId ? `${refreshUrl}?state=${encodeURIComponent(sessionId)}` : refreshUrl;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) return null;
    const json = await res.json();
    const token = json?.access_token || json?.accessToken || null;
    const expiresIn = Number(json?.expires_in || json?.expiresIn || 0);
    return token ? { token, expiresIn } : null;
  } catch (e) {
    return null;
  }
};

const normalizeCourseId = (courseId) => {
  if (!courseId) return courseId;
  return courseId.includes(':') ? courseId : `course:${courseId}`;
};

const buildEmbedUrl = ({ courseId, accessToken }) => {
  const url = new URL('/app/player', DEFAULT_BASE_URL);
  url.searchParams.set('lo_id', normalizeCourseId(courseId));
  if (accessToken) {
    url.searchParams.set('access_token', accessToken);
  }
  return url;
};

const isTokenValid = async (accessToken) => {
  if (!accessToken) return false;
  try {
    const url = new URL('/oauth/token/check', DEFAULT_BASE_URL);
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url.href, { credentials: 'omit' });
    if (!res.ok) return true;
    const json = await res.json();
    return !json?.error;
  } catch (e) {
    return true;
  }
};

const renderPlayer = (block, config) => {
  if (block.classList.contains('embed-is-loaded')) {
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.src = buildEmbedUrl(config).href;
  iframe.title = `Learning Manager course ${config.courseId}`;
  iframe.loading = 'lazy';
  iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('frameborder', '0');

  block.textContent = '';
  block.append(iframe);
  block.classList.add('embed-is-loaded');
};

export default function decorate(block) {
  const rows = [...block.children];
  const values = rows
    .map((row) => row?.firstElementChild?.textContent?.trim())
    .filter((v) => v !== undefined);

  const courseId = values[0];

  if (!courseId) {
    block.textContent = 'Missing courseId for ALM player block.';
    return;
  }

  let storedToken = null;
  let storedExpiry = null;
  try {
    storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    storedExpiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
  } catch (e) {
    storedToken = null;
    storedExpiry = null;
  }
  const isExpired = storedExpiry && Date.now() > storedExpiry;
  const accessToken = isExpired ? null : storedToken;

  const config = {
    courseId,
    accessToken,
  };

  if (!accessToken) {
    block.textContent = '';
    const notice = document.createElement('div');
    notice.className = 'alm-player__notice';
    notice.innerHTML = `
      <p>Access token is missing.</p>
      <p class="alm-player__auth-status">Preparing login...</p>
    `;
    block.append(notice);

    getAuthUrlFromPlaceholders()
      .then(async (authUrl) => {
        try {
          let authUrlValue = authUrl;
          if (!authUrlValue) {
            const resp = await fetch('/placeholders.json');
            if (resp.ok) {
              const json = await resp.json();
              authUrlValue = extractPlaceholderValue(json, 'almAuthUrl')
                || extractPlaceholderValue(json, 'almauthurl')
                || extractPlaceholderValue(json, 'almRuntimeUrl')
                || extractPlaceholderValue(json, 'almruntimeurl');
            }
          }

          if (!authUrlValue) {
            notice.innerHTML = `
              <p>Access token is missing.</p>
              <p class="alm-player__auth-status">
                Missing <code>almAuthUrl</code> placeholder.
              </p>
            `;
            return;
          }

          const auto = await fetchRefreshToken(authUrlValue);
          if (auto?.token) {
            try {
              localStorage.setItem(TOKEN_STORAGE_KEY, auto.token);
              if (auto.expiresIn) {
                localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + auto.expiresIn * 1000));
              }
            } catch (e) {}
            renderPlayer(block, { ...config, accessToken: auto.token });
            return;
          }

          notice.innerHTML = `
            <p>Access token is missing.</p>
            <div class="alm-player__auth-actions">
              <button type="button" class="alm-player__auth-button">Open OAuth login</button>
            </div>
            <p class="alm-player__auth-code-result" hidden></p>
          `;

          const popupButton = notice.querySelector('.alm-player__auth-button');
          const resultEl = notice.querySelector('.alm-player__auth-code-result');
          const onMessage = (event) => {
            const data = event?.data;
            if (!data?.type) return;
            if (data.type === 'alm-oauth-token') {
              const token = data.payload?.access_token || data.payload?.accessToken;
              const expiresIn = Number(data.payload?.expires_in || data.payload?.expiresIn || 0);
              resultEl.hidden = false;
              resultEl.textContent = token
                ? 'Loading player...'
                : 'Login completed, but no access_token found.';
              if (token) {
                try {
                  localStorage.setItem(TOKEN_STORAGE_KEY, token);
                  if (expiresIn) {
                    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
                  }
                } catch (e) {
                  // ignore storage failures
                }
                renderPlayer(block, { ...config, accessToken: token });
              }
              window.removeEventListener('message', onMessage);
            }
          };
          window.addEventListener('message', onMessage);

          popupButton.addEventListener('click', () => {
            let finalUrl = authUrlValue;
            let sessionId = localStorage.getItem(SESSION_ID_KEY);
            if (!sessionId) {
              sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              localStorage.setItem(SESSION_ID_KEY, sessionId);
            }
            try {
              const u = new URL(finalUrl);
              u.searchParams.set('state', sessionId);
              finalUrl = u.href;
            } catch (e) {
              // ignore
            }
            const popup = window.open(
              finalUrl,
              'alm-oauth',
              'width=720,height=720'
            );
            if (!popup) {
              resultEl.hidden = false;
              resultEl.textContent = 'Popup blocked. Please allow popups.';
              return;
            }

            const startedAt = Date.now();
            const poll = window.setInterval(async () => {
              if (Date.now() - startedAt > 60_000) {
                window.clearInterval(poll);
                return;
              }
              const refreshed = await fetchRefreshToken(authUrlValue);
              if (refreshed?.token) {
                window.clearInterval(poll);
                try {
                  localStorage.setItem(TOKEN_STORAGE_KEY, refreshed.token);
                  if (refreshed.expiresIn) {
                    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + refreshed.expiresIn * 1000));
                  }
                } catch (e) {
                  // ignore
                }
                renderPlayer(block, { ...config, accessToken: refreshed.token });
              }
            }, 1000);
          });
        } catch (e) {
          notice.querySelector('.alm-player__auth-status').textContent = 'Failed to build OAuth URL.';
        }
      })
      .catch(() => {
        notice.querySelector('.alm-player__auth-status').textContent = 'Failed to build OAuth URL.';
      });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    isTokenValid(accessToken).then((valid) => {
      if (valid) {
        renderPlayer(block, config);
        return;
      }
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
      } catch (e) {
        // ignore
      }
      block.textContent = '';
      const notice = document.createElement('div');
      notice.className = 'alm-player__notice';
      notice.innerHTML = `
        <p>Access token expired.</p>
        <p class="alm-player__auth-status">Please login again.</p>
      `;
      block.append(notice);
      decorate(block);
    });
  });

  observer.observe(block);
}
