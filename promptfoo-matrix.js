const baseConfig = require('./promptfooconfig.js');

module.exports = {
  ...baseConfig,
  description: 'Scribe Extension - Model Comparison Matrix',
  // Override providers to test multiple models side-by-side
  providers: [
    {
      id: 'scripts/promptfoo-provider.js',
      label: 'Gemini 3 Pro (Baseline)',
      config: {
        model: 'gemini-3-pro-preview',
        temperature: 0.0
      }
    },
    {
      id: 'scripts/promptfoo-provider.js',
      label: 'Gemini 2.0 Flash (Experimental)',
      config: {
        model: 'gemini-2.0-flash-exp', 
        temperature: 0.0
      }
    }
  ],
  // Keep the same tests and assertions
  tests: baseConfig.tests,
  prompts: baseConfig.prompts
};
