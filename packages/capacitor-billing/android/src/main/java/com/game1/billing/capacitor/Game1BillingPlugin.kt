package com.game1.billing.capacitor

import android.app.Activity
import android.content.Context
import com.game1.billing.HttpPurchaseBackend
import com.game1.billing.play.PlayBillingGateway
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

private const val PURCHASE_EVENT = "purchaseEvent"
private const val NOT_CONFIGURED = "Call configure first."

/**
 * Google Play purchases for the game's web code (NativeBilling in @game1/platform). The device
 * only opens Google Play and passes purchase tokens on: the purchase server verifies, grants
 * and finishes every purchase (see clients/android).
 */
@CapacitorPlugin(name = "Game1Billing")
class Game1BillingPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var bridge: BillingBridge<Activity>? = null
    private var forwarding: Job? = null

    @PluginMethod
    fun configure(call: PluginCall) {
        val baseUrl = call.getString("baseUrl")
        val gameId = call.getString("gameId")
        if (baseUrl == null || gameId == null) return call.reject("baseUrl and gameId are required")
        val configured = try {
            ProcessBilling.bridge(context, baseUrl, gameId)
        } catch (e: IllegalArgumentException) {
            return call.reject(e.message ?: "invalid configuration")
        }
        bridge = configured
        if (forwarding == null) {
            forwarding = scope.launch {
                // Kept until the game listens, so that no outcome is lost while it starts.
                configured.events.collect { notifyListeners(PURCHASE_EVENT, it.toJSObject(), true) }
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun setSessionToken(call: PluginCall) {
        val current = bridge ?: return call.reject(NOT_CONFIGURED)
        current.sessionToken = call.getString("token")?.takeIf { it.isNotEmpty() }
        call.resolve()
    }

    @PluginMethod
    fun queryProducts(call: PluginCall) {
        val current = bridge ?: return call.reject(NOT_CONFIGURED)
        val array = call.getArray("productIds") ?: return call.reject("productIds is required")
        val productIds = (0 until array.length()).mapNotNull { array.opt(it) as? String }
        answer(call) {
            val products = current.products(productIds)
            val list: Any = products?.let { found -> JSArray().also { out -> found.forEach { out.put(it.toJSObject()) } } } ?: JSONObject.NULL
            call.resolve(JSObject().put("products", list))
        }
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val current = bridge ?: return call.reject(NOT_CONFIGURED)
        val productId = call.getString("productId") ?: return call.reject("productId is required")
        answer(call) {
            val host: Activity? = activity
            val reason = if (host == null) "no_activity" else current.purchase(host, productId)
            call.resolve(if (reason == null) JSObject().put("launched", true) else JSObject().put("launched", false).put("reason", reason))
        }
    }

    @PluginMethod
    fun restore(call: PluginCall) {
        val current = bridge ?: return call.reject(NOT_CONFIGURED)
        answer(call) {
            current.restore()
            call.resolve()
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
    }

    /** Runs [block] for [call], rejecting the call rather than crashing the app if it throws. */
    private fun answer(call: PluginCall, block: suspend () -> Unit) {
        scope.launch {
            try {
                block()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                call.reject(e.message ?: e.javaClass.simpleName)
            }
        }
    }
}

private fun Map<String, Any>.toJSObject(): JSObject = JSObject().also { obj -> forEach { (key, value) -> obj.put(key, value) } }

/**
 * One Google Play connection and purchase coordinator per process. Google Play reports a
 * purchase to the billing client that opened it, so a plugin made for a new activity keeps
 * using the same one.
 */
private object ProcessBilling {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var configured: Configured? = null

    private class Configured(val baseUrl: String, val gameId: String, val bridge: BillingBridge<Activity>)

    @Synchronized
    fun bridge(context: Context, baseUrl: String, gameId: String): BillingBridge<Activity> {
        configured?.let {
            require(it.baseUrl == baseUrl && it.gameId == gameId) { "Game1Billing is already configured for another server or game." }
            return it.bridge
        }
        val gateway = PlayBillingGateway(context.applicationContext)
        val bridge = try {
            BillingBridge(PlayStorefront(gateway), gateway, { token -> HttpPurchaseBackend(baseUrl, gameId, token) }, scope)
        } catch (e: IllegalArgumentException) {
            // HttpPurchaseBackend refuses anything but https and a valid game id.
            gateway.close()
            throw e
        }
        configured = Configured(baseUrl, gameId, bridge)
        return bridge
    }
}
