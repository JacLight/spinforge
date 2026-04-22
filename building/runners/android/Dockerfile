# SpinBuild Android runner
#
# Handles platform=android. Installs Android SDK 34 + JDK 17 on top of a
# Node base image (agent needs Node; gradle is fetched per-project via the
# gradle-wrapper in the customer workspace).
#
# Tagged as spinforge/builder-android:latest. Referenced by
# DispatchService PLATFORM_PROFILES.android.

FROM node:22-bookworm-slim

ENV ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      openjdk-17-jdk-headless \
      unzip \
  && rm -rf /var/lib/apt/lists/*

# Android SDK: commandline-tools, platforms;android-34, build-tools;34.0.0.
# Version pinned so the image is reproducible. Bump as Android releases.
ARG ANDROID_CMDLINE_TOOLS_VERSION=11076708
ARG ANDROID_PLATFORM=android-34
ARG ANDROID_BUILD_TOOLS=34.0.0

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
  && cd $ANDROID_HOME/cmdline-tools \
  && curl -fsSL -o tools.zip \
       https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip \
  && unzip -q tools.zip \
  && rm tools.zip \
  && mv cmdline-tools latest

RUN yes | sdkmanager --licenses >/dev/null 2>&1 \
  && sdkmanager "platform-tools" "platforms;${ANDROID_PLATFORM}" "build-tools;${ANDROID_BUILD_TOOLS}" >/dev/null

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY agent.js entrypoint.sh ./
COPY lib ./lib
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production

ENTRYPOINT ["/app/entrypoint.sh"]
