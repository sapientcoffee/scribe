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
      
      let text = "";
      try {
        text = response.text();
      } catch (e) {
        // If text() fails, it's likely a function call
        const calls = response.functionCalls();
        if (calls && calls.length > 0) {
          text = `[Tool Call]: ${calls[0].name}(${JSON.stringify(calls[0].args)})`;
        } else {
          text = "[No Content]"; 
        }
      }
      
      // Extract usage metadata
      const usage = response.usageMetadata || {};
      
      // Calculate Cost (Approximate)
      let cost = 0;
      const promptTokens = usage.promptTokenCount || 0;
      const outputTokens = usage.candidatesTokenCount || 0;
      
      if (this.modelName.includes("flash")) {
        // Flash Pricing: ~$0.075 / 1M Input, ~$0.30 / 1M Output
        cost = (promptTokens / 1_000_000) * 0.075 + (outputTokens / 1_000_000) * 0.30;
      } else {
        // Pro Pricing (Default): ~$3.50 / 1M Input, ~$10.50 / 1M Output
        cost = (promptTokens / 1_000_000) * 3.50 + (outputTokens / 1_000_000) * 10.50;
      }

      return {
        output: text,
        tokenUsage: {
          total: usage.totalTokenCount,
          prompt: usage.promptTokenCount,
          completion: usage.candidatesTokenCount,
        },
        cost: cost
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
