package com.game1.billing

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI

/**
 * Talks to services/iap-server over HTTPS with the player's session token (for example a
 * Firebase ID token). Answers are mapped to [Verdict]s; anything unexpected is treated as
 * "retry later", never as success.
 */
public class HttpPurchaseBackend(
    baseUrl: String,
    private val gameId: String,
    /** The current player session token, or null if the player is signed out. */
    private val sessionToken: suspend () -> String?,
    private val connectTimeoutMs: Int = 10_000,
    private val readTimeoutMs: Int = 20_000,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    /** Only for tests against a local server. */
    allowCleartextLocalhost: Boolean = false,
) : PurchaseBackend {
    private val base: String

    init {
        require(GAME_ID.matches(gameId)) { "invalid game id" }
        val uri = URI(baseUrl.trimEnd('/'))
        val localhost = uri.host == "127.0.0.1" || uri.host == "localhost"
        require(uri.scheme == "https" || (allowCleartextLocalhost && localhost && uri.scheme == "http")) {
            "the purchase server must be reached over https"
        }
        base = uri.toString()
    }

    override suspend fun obfuscatedAccountId(): AccountIdResult =
        when (val res = call("POST", "/v1/games/$gameId/billing/account", JsonObject(emptyMap()))) {
            HttpResult.NoSession -> AccountIdResult.SignInRequired
            is HttpResult.NetworkError -> AccountIdResult.Unavailable(res.reason)
            is HttpResult.Response -> when {
                res.status == 200 -> res.body?.string("obfuscatedAccountId")
                    ?.takeIf { it.isNotEmpty() && it.length <= 64 }
                    ?.let { AccountIdResult.Ok(it) }
                    ?: AccountIdResult.Unavailable("malformed response")
                res.status == 401 -> AccountIdResult.SignInRequired
                else -> AccountIdResult.Unavailable("HTTP ${res.status}")
            }
        }

    override suspend fun verify(productId: String, purchaseToken: String): Verdict {
        val body = buildJsonObject {
            put("productId", productId)
            put("purchaseToken", purchaseToken)
        }
        return when (val res = call("POST", "/v1/games/$gameId/purchases/google-play", body)) {
            HttpResult.NoSession -> Verdict.SignInRequired
            is HttpResult.NetworkError -> Verdict.RetryLater(res.reason)
            is HttpResult.Response -> when {
                res.status == 200 -> res.body?.let { parseVerdict(it, productId) }
                    ?: Verdict.RetryLater("malformed response")
                res.status == 401 -> Verdict.SignInRequired
                res.status == 429 || res.status >= 500 -> Verdict.RetryLater("HTTP ${res.status}")
                res.status in 400..499 -> {
                    val error = res.body?.obj("error")
                    Verdict.Refused(
                        code = error?.string("code") ?: "http_${res.status}",
                        message = error?.string("message") ?: "The purchase was refused.",
                    )
                }
                else -> Verdict.RetryLater("HTTP ${res.status}")
            }
        }
    }

    override suspend fun wallet(): Wallet? =
        when (val res = call("GET", "/v1/games/$gameId/wallet", null)) {
            is HttpResult.Response -> if (res.status == 200) res.body?.let(::parseWallet) else null
            else -> null
        }

    private sealed interface HttpResult {
        data class Response(val status: Int, val body: JsonObject?) : HttpResult
        data class NetworkError(val reason: String) : HttpResult
        data object NoSession : HttpResult
    }

    private suspend fun call(method: String, path: String, body: JsonObject?): HttpResult {
        val token = sessionToken() ?: return HttpResult.NoSession
        return withContext(ioDispatcher) {
            val connection = URI(base + path).toURL().openConnection() as HttpURLConnection
            try {
                connection.requestMethod = method
                connection.connectTimeout = connectTimeoutMs
                connection.readTimeout = readTimeoutMs
                connection.instanceFollowRedirects = false
                connection.useCaches = false
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Accept", "application/json")
                if (body != null) {
                    val bytes = body.toString().encodeToByteArray()
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.setFixedLengthStreamingMode(bytes.size)
                    connection.outputStream.use { it.write(bytes) }
                }
                val status = connection.responseCode
                val stream = if (status >= 400) connection.errorStream else connection.inputStream
                val text = stream?.use { readCapped(it) }
                HttpResult.Response(status, text?.let(::parseObject))
            } catch (e: IOException) {
                HttpResult.NetworkError(e.javaClass.simpleName)
            } finally {
                connection.disconnect()
            }
        }
    }

    private companion object {
        val GAME_ID = Regex("^[a-z0-9][a-z0-9_-]{0,63}$")
        const val MAX_RESPONSE_BYTES = 64 * 1024

        /** Reads at most MAX_RESPONSE_BYTES (null if the body is longer). Avoids APIs missing on old Android versions. */
        fun readCapped(input: InputStream): String? {
            val out = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(8 * 1024)
            while (true) {
                val n = input.read(buffer)
                if (n < 0) break
                out.write(buffer, 0, n)
                if (out.size() > MAX_RESPONSE_BYTES) return null
            }
            return out.toByteArray().decodeToString()
        }

        fun parseObject(text: String): JsonObject? =
            try {
                Json.parseToJsonElement(text) as? JsonObject
            } catch (_: IllegalArgumentException) {
                null
            }

        fun parseVerdict(body: JsonObject, requestedProductId: String): Verdict? {
            val wallet = body.obj("wallet")?.let(::parseWallet) ?: return null
            val productId = body.string("productId") ?: requestedProductId
            val quantity = (body["quantity"] as? JsonPrimitive)?.intOrNull
            return when (body.string("status")) {
                "granted" -> Verdict.Granted(productId, quantity, wallet, newlyGranted = true)
                "already_granted" -> Verdict.Granted(productId, quantity, wallet, newlyGranted = false)
                "pending" -> Verdict.Pending(productId, wallet)
                "canceled" -> Verdict.Canceled(productId, wallet)
                "revoked" -> Verdict.Revoked(productId, wallet)
                else -> null
            }
        }

        fun parseWallet(body: JsonObject): Wallet? {
            val balances = body.obj("balances") ?: return null
            val entitlements = body["entitlements"] as? JsonArray ?: return null
            return Wallet(
                balances = balances.mapValues { (_, v) -> (v as? JsonPrimitive)?.longOrNull ?: return null },
                entitlements = entitlements.map { (it as? JsonPrimitive)?.contentOrNull ?: return null }.toSet(),
            )
        }

        fun JsonObject.obj(key: String): JsonObject? = this[key] as? JsonObject

        fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
    }
}
