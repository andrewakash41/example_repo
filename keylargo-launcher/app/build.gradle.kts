plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Optional stable signing key, supplied through environment variables (see README).
// Without it the APK is signed with the local debug key.
val ksPath: String? = System.getenv("COCKPIT_KEYSTORE")

android {
    namespace = "dev.cockpit.launcher"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.cockpit.launcher"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (ksPath != null) {
            create("release") {
                storeFile = file(ksPath)
                storePassword = System.getenv("COCKPIT_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("COCKPIT_KEY_ALIAS")
                keyPassword = System.getenv("COCKPIT_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName(if (ksPath != null) "release" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

// Deliberately no third-party dependencies: only the Android framework and the Kotlin stdlib.
