plugins {
    id("com.android.library")
}

android {
    namespace = "com.game1.billing.play"
    compileSdk = 36

    defaultConfig {
        // Google Play Billing Library 9 needs Android 6.0 (API 23) or later.
        minSdk = 23
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Included build (../billing-core); Gradle substitutes the project for these coordinates.
    api("com.game1.billing:billing-core:0.1.0")
    api("com.android.billingclient:billing:9.1.0")

    testImplementation(platform("org.junit:junit-bom:5.14.4"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}
