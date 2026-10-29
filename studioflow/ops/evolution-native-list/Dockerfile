FROM evoapicloud/evolution-api:v2.3.7@sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339
COPY patch.mjs regression-test.mjs /tmp/studioflow-native/
RUN node /tmp/studioflow-native/patch.mjs \
    && node /tmp/studioflow-native/regression-test.mjs \
    && rm -f /tmp/studioflow-native-method.cjs
