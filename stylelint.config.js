export default {
    extends: ['stylelint-config-standard'],
    // main.css is registered in manifest.config.ts as the content script's injected stylesheet
    // but is intentionally still empty — no styles needed yet.
    rules: {
        'no-empty-source': null,
    },
};
