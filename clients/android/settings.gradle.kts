pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "game1-billing"

// Platform-independent purchase logic. It is a separate build so that it can be built and
// tested on any JVM without the Android SDK: ./gradlew -p billing-core test
includeBuild("billing-core")

// Google Play Billing Library adapter (needs the Android SDK).
include(":billing-play")
