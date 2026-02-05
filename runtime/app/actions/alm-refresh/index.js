const fetch = require('node-fetch')
const stateLib = require('@adobe/aio-lib-state')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters } = require('../utils')

const REFRESH_TOKEN_KEY = 'alm-refresh-token'

async function main (params) {
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.info('ALM refresh action called')
    logger.debug(stringParameters(params))

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }

    if (params.__ow_method === 'options') {
      return { statusCode: 204, headers: corsHeaders, body: '' }
    }

    const clientId = params.ALM_CLIENT_ID
    const clientSecret = params.ALM_CLIENT_SECRET
    const baseUrl = (params.ALM_BASE_URL || 'https://captivateprime.adobe.com').replace(/\/$/, '')

    if (!clientId || !clientSecret) {
      return errorResponse(500, 'Missing ALM client credentials in runtime env', logger)
    }

    const state = await stateLib.init()
    const refreshToken = await state.get(REFRESH_TOKEN_KEY)

    if (!refreshToken) {
      return errorResponse(401, 'Missing refresh token. Please authenticate again.', logger)
    }

    const endpoint = `${baseUrl}/oauth/token/refresh`
    const form = new URLSearchParams()
    form.set('client_id', clientId)
    form.set('client_secret', clientSecret)
    form.set('refresh_token', refreshToken)

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
      logger.error(`ALM refresh failed: ${res.status}`)
      return { statusCode: res.status, headers: corsHeaders, body }
    }

    if (body.refresh_token) {
      try {
        await state.put(REFRESH_TOKEN_KEY, body.refresh_token, { ttl: 60 * 60 * 24 * 30 })
      } catch (e) {
        logger.warn('Failed to update refresh token')
      }
    }

    return { statusCode: 200, headers: corsHeaders, body }
  } catch (error) {
    logger.error(error)
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
