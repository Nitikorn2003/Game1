package com.game1.billing

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.net.InetSocketAddress
import java.net.ServerSocket
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull

class HttpPurchaseBackendTest {
    private lateinit var server: HttpServer
    private val requests = mutableListOf<Recorded>()

    /** The next answer: status and body, or a delay to provoke a timeout. */
    private var status = 200
    private var body = ""
    private var delayMs = 0L
    private var extraHeaders = emptyMap<String, String>()

    private data class Recorded(val method: String, val path: String, val headers: Map<String, String>, val body: String)

    @BeforeTest
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { exchange -> answer(exchange) }
        server.start()
    }

    @AfterTest
    fun stop() {
        server.stop(0)
    }

    private fun answer(exchange: HttpExchange) {
        requests += Recorded(
            exchange.requestMethod,
            exchange.requestURI.path,
            exchange.requestHeaders.mapKeys { it.key.lowercase() }.mapValues { it.value.joinToString(",") },
            exchange.requestBody.readBytes().decodeToString(),
        )
        if (delayMs > 0) Thread.sleep(delayMs)
        val bytes = body.encodeToByteArray()
        extraHeaders.forEach { (k, v) -> exchange.responseHeaders.add(k, v) }
        exchange.responseHeaders.add("Content-Type", "application/json")
        exchange.sendResponseHeaders(status, if (bytes.isEmpty()) -1 else bytes.size.toLong())
        if (bytes.isNotEmpty()) exchange.responseBody.use { it.write(bytes) }
        exchange.close()
    }

    private fun backend(session: String? = "session-token", readTimeoutMs: Int = 2_000, url: String = "http://127.0.0.1:${server.address.port}") =
        HttpPurchaseBackend(url, "game1", { session }, connectTimeoutMs = 2_000, readTimeoutMs = readTimeoutMs, allowCleartextLocalhost = true)

    private fun respond(status: Int, body: String) {
        this.status = status
        this.body = body
    }

    private val walletJson = """{"balances":{"gems":100,"coins":5},"entitlements":["remove_ads"]}"""
    private val wallet = Wallet(mapOf("gems" to 100L, "coins" to 5L), setOf("remove_ads"))

    @Test
    fun `sends only the product id and token, with the player's session`(): Unit = runBlocking {
        respond(200, """{"status":"granted","productId":"gems_100","quantity":1,"wallet":$walletJson}""")

        backend().verify("gems_100", "purchase-token-123")

        val request = requests.single()
        assertEquals("POST", request.method)
        assertEquals("/v1/games/game1/purchases/google-play", request.path)
        assertEquals("Bearer session-token", request.headers["authorization"])
        assertEquals("application/json", request.headers["content-type"])
        val sent = Json.parseToJsonElement(request.body) as JsonObject
        assertEquals(setOf("productId", "purchaseToken"), sent.keys)
        assertEquals(JsonPrimitive("purchase-token-123"), sent["purchaseToken"])
    }

    @Test
    fun `maps the server's purchase states`(): Unit = runBlocking {
        val cases = mapOf(
            "granted" to Verdict.Granted("gems_100", 1, wallet, newlyGranted = true),
            "already_granted" to Verdict.Granted("gems_100", 1, wallet, newlyGranted = false),
            "pending" to Verdict.Pending("gems_100", wallet),
            "canceled" to Verdict.Canceled("gems_100", wallet),
            "revoked" to Verdict.Revoked("gems_100", wallet),
        )
        for ((state, expected) in cases) {
            respond(200, """{"status":"$state","productId":"gems_100","quantity":1,"wallet":$walletJson}""")
            assertEquals(expected, backend().verify("gems_100", "t"), state)
        }
    }

    @Test
    fun `never treats an unexpected or malformed success response as a grant`(): Unit = runBlocking {
        for (bad in listOf(
            """{"status":"paid","productId":"gems_100","wallet":$walletJson}""",
            """{"status":"granted","productId":"gems_100"}""",
            """{"status":"granted","wallet":{"balances":{"gems":"lots"},"entitlements":[]}}""",
            "not json",
            "",
            """["granted"]""",
        )) {
            respond(200, bad)
            assertIs<Verdict.RetryLater>(backend().verify("gems_100", "t"), bad)
        }
    }

    @Test
    fun `maps refusals, sign-in problems and server trouble`(): Unit = runBlocking {
        respond(403, """{"error":{"code":"purchase_not_owned","message":"This purchase belongs to a different player.","retryable":false}}""")
        assertEquals(Verdict.Refused("purchase_not_owned", "This purchase belongs to a different player."), backend().verify("gems_100", "t"))

        respond(422, """{"error":{"code":"invalid_purchase_token","message":"Google Play does not recognise this purchase.","retryable":false}}""")
        assertEquals("invalid_purchase_token", (backend().verify("gems_100", "t") as Verdict.Refused).code)

        respond(400, "")
        assertEquals("http_400", (backend().verify("gems_100", "t") as Verdict.Refused).code)

        respond(401, """{"error":{"code":"unauthorized","message":"","retryable":false}}""")
        assertEquals(Verdict.SignInRequired, backend().verify("gems_100", "t"))

        for (code in listOf(429, 500, 502, 503)) {
            respond(code, """{"error":{"code":"upstream_unavailable","message":"","retryable":true}}""")
            assertIs<Verdict.RetryLater>(backend().verify("gems_100", "t"), "HTTP $code")
        }
    }

    @Test
    fun `does not follow redirects, which could send the session token elsewhere`(): Unit = runBlocking {
        respond(302, "")
        extraHeaders = mapOf("Location" to "http://127.0.0.1:1/steal")
        assertIs<Verdict.RetryLater>(backend().verify("gems_100", "t"))
        assertEquals(1, requests.size)
    }

    @Test
    fun `retries later on timeouts and refused connections`(): Unit = runBlocking {
        respond(200, """{"status":"granted","productId":"gems_100","quantity":1,"wallet":$walletJson}""")
        delayMs = 1_500
        assertIs<Verdict.RetryLater>(backend(readTimeoutMs = 300).verify("gems_100", "t"))

        val closedPort = ServerSocket(0).use { it.localPort }
        assertIs<Verdict.RetryLater>(backend(url = "http://127.0.0.1:$closedPort").verify("gems_100", "t"))
    }

    @Test
    fun `refuses oversized responses`(): Unit = runBlocking {
        respond(200, """{"status":"granted","pad":"${"x".repeat(70_000)}","wallet":$walletJson}""")
        assertIs<Verdict.RetryLater>(backend().verify("gems_100", "t"))
    }

    @Test
    fun `asks for sign-in without calling the server when there is no session`(): Unit = runBlocking {
        assertEquals(Verdict.SignInRequired, backend(session = null).verify("gems_100", "t"))
        assertEquals(AccountIdResult.SignInRequired, backend(session = null).obfuscatedAccountId())
        assertEquals(0, requests.size)
    }

    @Test
    fun `fetches the obfuscated account id for the billing flow`(): Unit = runBlocking {
        respond(200, """{"obfuscatedAccountId":"4bNq0yC1eXQpLrZ8nM2vT5kW7aJ3dF6hG9sU0iO1pE2"}""")
        assertEquals(AccountIdResult.Ok("4bNq0yC1eXQpLrZ8nM2vT5kW7aJ3dF6hG9sU0iO1pE2"), backend().obfuscatedAccountId())
        assertEquals("/v1/games/game1/billing/account", requests.single().path)
        assertEquals("application/json", requests.single().headers["content-type"])

        respond(200, """{"obfuscatedAccountId":"${"a".repeat(65)}"}""")
        assertIs<AccountIdResult.Unavailable>(backend().obfuscatedAccountId())

        respond(503, "")
        assertIs<AccountIdResult.Unavailable>(backend().obfuscatedAccountId())
    }

    @Test
    fun `reads the wallet`(): Unit = runBlocking {
        respond(200, walletJson)
        assertEquals(wallet, backend().wallet())
        respond(500, "")
        assertNull(backend().wallet())
    }

    @Test
    fun `requires https except for explicitly allowed local test servers`() {
        assertFailsWith<IllegalArgumentException> { HttpPurchaseBackend("http://iap.example.com", "game1", { "s" }) }
        assertFailsWith<IllegalArgumentException> {
            HttpPurchaseBackend("http://iap.example.com", "game1", { "s" }, allowCleartextLocalhost = true)
        }
        assertFailsWith<IllegalArgumentException> { HttpPurchaseBackend("https://iap.example.com", "../admin", { "s" }) }
        HttpPurchaseBackend("https://iap.example.com/", "game1", { "s" })
    }
}
