import { createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';

const TARGET_READY_TIMEOUT = 10000;
const TARGET_POLL_INTERVAL = 100;

function getMboxName(block) {
  const config = readBlockConfig(block);
  if (typeof config.mbox === 'string' && config.mbox.trim()) {
    return config.mbox.trim();
  }

  const firstCellText = block.querySelector(':scope > div > div')?.textContent?.trim();
  return firstCellText || '';
}

function normalizeUrlCandidate(value) {
  if (Array.isArray(value)) {
    const firstString = value.find((entry) => typeof entry === 'string' && entry.trim());
    return firstString ? firstString.trim() : '';
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return '';
}

function extractFallbackImageFromMarkup(block) {
  const imageEl = block.querySelector(':scope img');
  if (imageEl?.src) return imageEl.src;

  const linkEl = block.querySelector(':scope a');
  if (linkEl?.href) return linkEl.href;

  const textMatch = block.textContent.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif|svg)/i)
    || block.textContent.match(/\/content\/dam\/\S+\.(?:png|jpe?g|webp|gif|svg)/i);
  return textMatch ? textMatch[0] : '';
}

function getFallbackImage(config, block) {
  const candidates = [
    config['fallback-image'],
    config.fallbackImage,
    config.fallbackimage,
  ];
  const fromConfig = candidates.map(normalizeUrlCandidate).find(Boolean);
  if (fromConfig) return fromConfig;
  return extractFallbackImageFromMarkup(block);
}

function hasOfferContent(offer) {
  if (Array.isArray(offer)) {
    return offer.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const hasAction = typeof item.action === 'string' && item.action.length > 0;
      const hasSelector = typeof item.selector === 'string' && item.selector.length > 0;
      const hasContent = item.content !== undefined && item.content !== null && `${item.content}`.trim() !== '';
      return hasAction || hasSelector || hasContent;
    });
  }
  if (!offer) return false;
  if (typeof offer === 'string') return offer.trim().length > 0;
  if (typeof offer === 'object') return Object.keys(offer).length > 0;
  return true;
}

function renderFallback(block, fallbackImage, mbox, reason) {
  if (!fallbackImage) return;

  const picture = createOptimizedPicture(
    fallbackImage,
    `Fallback content for ${mbox}`,
    false,
    [{ media: '(min-width: 600px)', width: '1200' }, { width: '750' }],
  );

  block.classList.add('target-mbox--fallback');
  block.replaceChildren(picture);

  // eslint-disable-next-line no-console
  console.info(`target-mbox: showing fallback image for "${mbox}" (${reason}).`);
}

function waitForTarget() {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const checkTarget = () => {
      const target = window?.adobe?.target;
      if (target && typeof target.getOffer === 'function' && typeof target.applyOffer === 'function') {
        resolve(target);
        return;
      }

      if (Date.now() - start >= TARGET_READY_TIMEOUT) {
        reject(new Error('Adobe Target was not available within timeout.'));
        return;
      }

      window.setTimeout(checkTarget, TARGET_POLL_INTERVAL);
    };

    checkTarget();
  });
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const mbox = getMboxName(block);
  const fallbackImage = getFallbackImage(config, block);
  block.textContent = '';

  if (!mbox) {
    // eslint-disable-next-line no-console
    console.warn('target-mbox: missing mbox name.');
    renderFallback(block, fallbackImage, 'unknown-mbox', 'missing-mbox');
    return;
  }

  const targetId = (window.crypto?.randomUUID?.())
    ? `target-mbox-${window.crypto.randomUUID()}`
    : `target-mbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const selector = `#${targetId}`;
  block.id = selector.replace('#', '');

  try {
    await waitForTarget();
    window.adobe.target.getOffer({
      mbox,
      success: (offer) => {
        if (!hasOfferContent(offer)) {
          renderFallback(block, fallbackImage, mbox, 'no-offer');
          return;
        }

        block.classList.remove('target-mbox--fallback');
        window.adobe.target.applyOffer({
          mbox,
          selector,
          offer,
        });

        // Some Target responses are technically non-empty but don't render any DOM change.
        window.requestAnimationFrame(() => {
          const rendered = block.textContent.trim().length > 0 || block.children.length > 0;
          if (!rendered) {
            renderFallback(block, fallbackImage, mbox, 'post-apply-empty');
          }
        });
      },
      error: (status, error) => {
        // eslint-disable-next-line no-console
        console.error(`target-mbox: failed to load offer for "${mbox}"`, status, error);
        renderFallback(block, fallbackImage, mbox, 'error');
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`target-mbox: Adobe Target unavailable for "${mbox}"`, error);
    renderFallback(block, fallbackImage, mbox, 'target-unavailable');
  }
}
