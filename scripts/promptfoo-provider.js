const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuration
const DEFAULT_MODEL = "gemini-3-pro-preview"; 

class GeminiProvider {
  constructor(options) {
    console.log("DEBUG: Initializing Custom Gemini Provider");
    this.options = options;
    this.apiKey = process.env.GEMINI_API_KEY;
    
    // Allow model to be passed via config, or fallback to default
    this.modelName = options.config?.model || DEFAULT_MODEL;
    
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
  }

  id() {
    return `custom-gemini:${this.modelName}`;
  }

  async callApi(prompt, context) {
    console.log(`DEBUG: Calling API (${this.modelName}) with prompt length:`, prompt.length);
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      return {
        output: text,
      };
    } catch (error) {
      console.error(`DEBUG: API Error (${this.modelName}):`, error);
      return {
        error: `API Call Failed: ${error.message}`,
      };
    }
  }
}

module.exports = GeminiProvider;
