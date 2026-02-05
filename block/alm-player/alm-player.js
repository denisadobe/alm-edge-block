const DEFAULT_BASE_URL = 'https://captivateprime.adobe.com';
const TOKEN_STORAGE_PREFIX = 'alm-access-token';

const getPlaceholderKey = (obj) => obj?.almAuthUrl
  || obj?.almauthurl
  || obj?.almRuntimeUrl
  || obj?.almruntimeurl
  || null;

const ensureHtmlFormat = (url) => {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('format')) {
      u.searchParams.set('format', 'html');
    }
    return u.href;
  } catch (e) {
    return url;
  }
};

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

const normalizeCourseId = (courseId) => {
  if (!courseId) return courseId;
  return courseId.includes(':') ? courseId : `course:${courseId}`;
};

const buildEmbedUrl = ({ baseUrl, courseId, accessToken }) => {
  const url = new URL('/app/player', baseUrl || DEFAULT_BASE_URL);
  url.searchParams.set('lo_id', normalizeCourseId(courseId));
  if (accessToken) {
    url.searchParams.set('access_token', accessToken);
  }
  return url;
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
  const baseUrl = values[1];
  const inlineAccessToken = values[2];

  if (!courseId) {
    block.textContent = 'Missing courseId for ALM player block.';
    return;
  }

  const storageKey = `${TOKEN_STORAGE_PREFIX}:${courseId}`;
  let storedToken = null;
  try {
    storedToken = sessionStorage.getItem(storageKey);
  } catch (e) {
    storedToken = null;
  }
  const accessToken = inlineAccessToken || storedToken;

  const config = {
    courseId,
    accessToken,
    baseUrl,
  };

  if (!accessToken) {
    block.textContent = '';
    const notice = document.createElement('div');
    notice.className = 'alm-player__notice';
    notice.innerHTML = `
      <p>Access token is missing.</p>
      <p class="alm-player__auth-status">Preparing OAuth login...</p>
    `;
    block.append(notice);

    getAuthUrlFromPlaceholders()
      .then((authUrl) => {
        if (!authUrl) {
          notice.innerHTML = `
            <p>Access token is missing.</p>
            <p class="alm-player__auth-status">
              Missing <code>almAuthUrl</code> placeholder. Configure it to your Runtime action URL.
            </p>
          `;
          return;
        }

        const authUrlValue = ensureHtmlFormat(authUrl);
        notice.innerHTML = `
          <p>Access token is missing.</p>
          <div class="alm-player__auth-actions">
            <button type="button" class="alm-player__auth-button">Open OAuth login</button>
          </div>
          <p class="alm-player__auth-url">URL:</p>
          <code class="alm-player__auth-code">${authUrlValue}</code>
          <p class="alm-player__auth-code-result" hidden></p>
        `;

        const popupButton = notice.querySelector('.alm-player__auth-button');
        const resultEl = notice.querySelector('.alm-player__auth-code-result');
        const onMessage = (event) => {
          const data = event?.data;
          if (!data?.type) return;
          if (data.type === 'alm-oauth-token') {
            const token = data.payload?.access_token || data.payload?.accessToken;
            resultEl.hidden = false;
            resultEl.textContent = token
              ? 'Access token received. Loading player...'
              : 'Received OAuth response, but no access_token found.';
            if (token) {
              try {
                sessionStorage.setItem(storageKey, token);
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
          const popup = window.open(
            authUrlValue,
            'alm-oauth',
            'width=720,height=720'
          );
          if (!popup) {
            resultEl.hidden = false;
            resultEl.textContent = 'Popup blocked. Please allow popups and try again.';
          }
        });
      })
      .catch(() => {
        notice.querySelector('.alm-player__auth-status').textContent = 'Failed to build OAuth URL.';
      });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      renderPlayer(block, config);
    }
  });

  observer.observe(block);
}
