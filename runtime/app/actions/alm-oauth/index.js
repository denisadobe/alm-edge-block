/*
* <license header>
*/

const fetch = require('node-fetch')
const stateLib = require('@adobe/aio-lib-state')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')

const REFRESH_TOKEN_KEY = 'alm-refresh-token'
const refreshKeyForIdentity = (identity) => `${REFRESH_TOKEN_KEY}:${identity}`

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.info('ALM OAuth action called')
    logger.debug(stringParameters(params))

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }

    if (params.__ow_method === 'options') {
      return { statusCode: 204, headers: corsHeaders, body: '' }
    }

    const requiredParams = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, [])
    if (errorMessage) {
      return errorResponse(400, errorMessage, logger)
    }

    const clientId = params.ALM_CLIENT_ID
    const clientSecret = params.ALM_CLIENT_SECRET
    const baseUrl = (params.ALM_BASE_URL || 'https://captivateprime.adobe.com').replace(/\/$/, '')

    if (!clientId || !clientSecret) {
      return errorResponse(500, 'Missing ALM client credentials in runtime env', logger)
    }

    const code = params.code
    const refreshToken = params.refresh_token || params.refreshToken

    // If no code/refresh_token, redirect to ALM authorize
    if (!code && !refreshToken) {
      const proto = params.__ow_headers?.['x-forwarded-proto'] || 'https'
      const host = params.__ow_headers?.['x-forwarded-host']
        || params.__ow_headers?.['x-original-host']
        || params.__ow_headers?.host
      const forwardedUri = params.__ow_headers?.['x-forwarded-uri']
        || params.__ow_headers?.['x-original-uri']
      const path = forwardedUri
        || params.__ow_headers?.['x-forwarded-path']
        || params.__ow_path
        || '/api/v1/web/alm-runtime/alm-oauth'

      if (!host) {
        return errorResponse(500, 'Missing host header in runtime request', logger)
      }
      const selfUrl = `${proto}://${host}${path}`
      const redirectUri = params.redirect_uri || selfUrl
      const scope = params.scope || 'learner:read,learner:write'
      const state = params.state || 'state1'

      const authorize = new URL('/oauth/o/authorize', baseUrl)
      authorize.searchParams.set('client_id', clientId)
      authorize.searchParams.set('redirect_uri', redirectUri)
      authorize.searchParams.set('scope', scope)
      authorize.searchParams.set('response_type', 'CODE')
      authorize.searchParams.set('state', state)
      if (params.account) authorize.searchParams.set('account', params.account)
      if (params.email) authorize.searchParams.set('email', params.email)

      return {
        statusCode: 302,
        headers: {
          Location: authorize.href
        },
        body: ''
      }
    }

    let endpoint
    const form = new URLSearchParams()
    form.set('client_id', clientId)
    form.set('client_secret', clientSecret)

    if (code) {
      endpoint = `${baseUrl}/oauth/token`
      form.set('code', code)
    } else if (refreshToken) {
      endpoint = `${baseUrl}/oauth/token/refresh`
      form.set('refresh_token', refreshToken)
    } else {
      return errorResponse(400, 'Missing code or refresh_token', logger)
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    })

    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch (e) {
      body = { raw: text }
    }

    if (!res.ok) {
      logger.error(`ALM token exchange failed: ${res.status}`)
      return {
        statusCode: res.status,
        headers: corsHeaders,
        body
      }
    }

    const identity = params.email || body.user_id || null
    if (body.refresh_token && identity) {
      try {
        const state = await stateLib.init()
        await state.put(refreshKeyForIdentity(identity), body.refresh_token, { ttl: 60 * 60 * 24 * 30 })
      } catch (e) {
        logger.warn('Failed to store refresh token')
      }
    }

    const payload = JSON.stringify({
      ...body,
      identity: identity ? { type: params.email ? 'email' : 'user_id', value: identity } : null
    })
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ALM OAuth Token</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      code { display: block; padding: 12px; background: #f4f4f4; border: 1px solid #ddd; word-break: break-all; }
    </style>
  </head>
  <body>
    <h1>Access Token</h1>
    <p>Copy the token below and use it in the ALM block.</p>
    <code id="token">Loading...</code>
    <script>
      const payload = ${payload};
      const tokenEl = document.getElementById('token');
      tokenEl.textContent = payload.access_token || 'No access_token in response';
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage({ type: 'alm-oauth-token', payload }, '*');
          setTimeout(() => {
            try { window.close(); } catch (e) {}
          }, 500);
        } catch (e) {}
      }
    </script>
  </body>
</html>`
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8'
      },
      body: html
    }
  } catch (error) {
    logger.error(error)
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
