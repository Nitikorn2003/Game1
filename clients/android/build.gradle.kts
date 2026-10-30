buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        // AGP's built-in Kotlin uses this Kotlin Gradle plugin; it matches billing-core.
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.21")
    }
}

plugins {
    id("com.android.library") version "9.3.2" apply false
}
